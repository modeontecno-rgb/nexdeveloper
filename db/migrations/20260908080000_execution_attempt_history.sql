ALTER TABLE public.ejecuciones_orden ADD COLUMN intento_anterior_id uuid UNIQUE REFERENCES public.ejecuciones_orden(id) ON DELETE RESTRICT;
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
 INSERT INTO public.ejecuciones_orden(user_id,orden_id,proyecto_id,tarea_origen_id,texto,modo,motor,estado,intento_anterior_id,estado_agente,cambios,pasos,coste_ia,tokens_entrada,tokens_salida)
 VALUES(e.user_id,e.orden_id,e.proyecto_id,e.tarea_origen_id,e.texto,e.modo,e.motor,'en_cola',e.id,e.estado_agente,e.cambios,0,e.coste_ia,e.tokens_entrada,e.tokens_salida) RETURNING * INTO nueva;
 UPDATE public.ordenes SET ejecucion_id=nueva.id,estado='en_cola',actualizado_el=now() WHERE id=e.orden_id;
 IF e.estado='cancelada' THEN UPDATE public.tareas SET estado='en_cola' WHERE id=e.tarea_origen_id AND user_id=p_user_id AND estado='pausada'; END IF;
 RETURN to_jsonb(nueva);
END $$;
REVOKE ALL ON FUNCTION public.reintentar_ejecucion(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reintentar_ejecucion(uuid,uuid) TO service_role;
