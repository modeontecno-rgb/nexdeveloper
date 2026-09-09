ALTER TABLE public.modelos_ia ADD COLUMN IF NOT EXISTS desarrollo_estado text NOT NULL DEFAULT 'sin_probar', ADD COLUMN IF NOT EXISTS desarrollo_detalle text, ADD COLUMN IF NOT EXISTS desarrollo_comprobado_el timestamptz;
ALTER TABLE public.ejecucion_config ADD COLUMN IF NOT EXISTS equipo_modelos jsonb NOT NULL DEFAULT '{}'::jsonb;
-- A direct order is an explicit instruction to develop or advise, not a request for a committee.
ALTER TABLE public.ejecuciones_orden ADD COLUMN IF NOT EXISTS equipo_automatico boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.crear_encargo_simple(p_user_id uuid,p_solicitud uuid,p_proyecto uuid,p_texto text,p_contexto text,p_consejo boolean DEFAULT false,p_adjuntos uuid[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.ordenes;e public.ejecuciones_orden;pet public.peticiones_directas;
BEGIN
 IF p_user_id IS NULL OR p_solicitud IS NULL OR length(btrim(p_texto))<3 OR length(p_contexto)>60000 THEN RAISE EXCEPTION 'Encargo no válido';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_solicitud::text,0));
 SELECT * INTO pet FROM peticiones_directas WHERE id=p_solicitud;
 IF FOUND THEN
  IF pet.user_id<>p_user_id OR pet.proyecto_id IS DISTINCT FROM p_proyecto OR pet.texto<>p_texto THEN RAISE EXCEPTION 'Solicitud ya utilizada con otro contenido';END IF;
  SELECT * INTO e FROM ejecuciones_orden WHERE orden_id=pet.orden_id AND user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encargo anterior pendiente de conciliación';END IF;
  IF e.modo<>(CASE WHEN p_consejo THEN 'planificar' ELSE 'construir' END) THEN RAISE EXCEPTION 'Solicitud reutilizada con otra modalidad';END IF;
  RETURN to_jsonb(e);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM proyectos WHERE id=p_proyecto AND user_id=p_user_id) THEN RAISE EXCEPTION 'Proyecto no autorizado';END IF;
 IF NOT p_consejo AND NOT EXISTS(SELECT 1 FROM proyectos WHERE id=p_proyecto AND repositorio IS NOT NULL AND repositorio<>'') THEN RAISE EXCEPTION 'Conecta el repositorio del proyecto antes de encargar el trabajo';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_adjuntos) a WHERE NOT EXISTS(SELECT 1 FROM peticiones_adjuntos f WHERE f.id=a AND f.user_id=p_user_id AND f.peticion_id IS NULL)) THEN RAISE EXCEPTION 'Adjunto ajeno o ya asignado';END IF;
 INSERT INTO ordenes(user_id,proyecto_id,texto,modo,prioridad,estado,ejecutar_con,requiere_aprobacion,requiere_atencion,resuelta_el,resuelta_por,comentario)
 VALUES(p_user_id,p_proyecto,p_contexto,'equilibrado','media','aprobada','claude',false,false,now(),'Usuario','Encargo directo: desarrollar en rama y mostrar resultado antes de publicar') RETURNING * INTO o;
 INSERT INTO peticiones_directas(id,user_id,proyecto_id,texto,origen,destino,estado,orden_id) VALUES(p_solicitud,p_user_id,p_proyecto,p_texto,'texto','proyecto','aprobada',o.id);
 UPDATE peticiones_adjuntos SET peticion_id=p_solicitud WHERE id=ANY(p_adjuntos) AND user_id=p_user_id;
 SELECT * INTO e FROM jsonb_populate_record(NULL::public.ejecuciones_orden,encolar_orden_atomica(p_user_id,o.id,CASE WHEN p_consejo THEN 'planificar' ELSE 'construir' END,'claude'));
 UPDATE ejecuciones_orden SET equipo_automatico=true WHERE id=e.id RETURNING * INTO e;
 RETURN to_jsonb(e);
END $$;
REVOKE ALL ON FUNCTION public.crear_encargo_simple(uuid,uuid,uuid,text,text,boolean,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crear_encargo_simple(uuid,uuid,uuid,text,text,boolean,uuid[]) TO service_role;

-- Preserve the coordinated engine when retrying an eligible execution.
CREATE OR REPLACE FUNCTION public.reintentar_ejecucion(p_user_id uuid,p_ejecucion_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.ejecuciones_orden; nueva public.ejecuciones_orden;
BEGIN
 PERFORM 1 FROM public.ordenes WHERE id=(SELECT orden_id FROM public.ejecuciones_orden WHERE id=p_ejecucion_id AND user_id=p_user_id) AND user_id=p_user_id FOR UPDATE;
 SELECT * INTO e FROM public.ejecuciones_orden WHERE id=p_ejecucion_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ejecución no encontrada'; END IF;
 SELECT * INTO nueva FROM public.ejecuciones_orden WHERE intento_anterior_id=e.id AND user_id=p_user_id;
 IF FOUND THEN RETURN to_jsonb(nueva); END IF;
 IF e.estado NOT IN ('error','cancelada') OR e.bloqueo_hasta>clock_timestamp() THEN RAISE EXCEPTION 'La ejecución no está lista para reintentar'; END IF;
 IF e.mensaje_id IS NOT NULL OR e.pr_numero IS NOT NULL OR e.fusionada_sha IS NOT NULL OR EXISTS(SELECT 1 FROM public.ia_reservas WHERE ejecucion_id=e.id AND estado IN ('reservada','incierta')) THEN RAISE EXCEPTION 'Hay efectos remotos que se deben conciliar antes de repetir'; END IF;
 PERFORM 1 FROM public.ordenes WHERE id=e.orden_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orden de origen no encontrada'; END IF;
 INSERT INTO public.ejecuciones_orden(user_id,orden_id,proyecto_id,tarea_origen_id,texto,modo,motor,estado,intento_anterior_id,estado_agente,cambios,pasos,coste_ia,tokens_entrada,tokens_salida,equipo_automatico)
 VALUES(e.user_id,e.orden_id,e.proyecto_id,e.tarea_origen_id,e.texto,e.modo,e.motor,'en_cola',e.id,e.estado_agente,e.cambios,0,e.coste_ia,e.tokens_entrada,e.tokens_salida,e.equipo_automatico) RETURNING * INTO nueva;
 UPDATE public.ordenes SET ejecucion_id=nueva.id,estado='en_cola',actualizado_el=now() WHERE id=e.orden_id;
 IF e.estado='cancelada' THEN UPDATE public.tareas SET estado='en_cola' WHERE id=e.tarea_origen_id AND user_id=p_user_id AND estado='pausada'; END IF;
 RETURN to_jsonb(nueva);
END $$;
REVOKE ALL ON FUNCTION public.reintentar_ejecucion(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reintentar_ejecucion(uuid,uuid) TO service_role;
