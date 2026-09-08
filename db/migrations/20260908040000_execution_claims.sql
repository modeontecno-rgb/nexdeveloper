ALTER TABLE public.ejecuciones_orden ADD COLUMN bloqueo_token uuid,ADD COLUMN bloqueo_hasta timestamptz,ADD COLUMN tarea_origen_id uuid REFERENCES public.tareas(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.encolar_orden_atomica(p_user_id uuid,p_orden_id uuid,p_modo text DEFAULT 'construir',p_motor text DEFAULT 'auto') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.ordenes; e public.ejecuciones_orden; tid uuid;
BEGIN
 SELECT * INTO o FROM public.ordenes WHERE id=p_orden_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
 IF o.ejecucion_id IS NOT NULL THEN
   SELECT * INTO e FROM public.ejecuciones_orden WHERE id=o.ejecucion_id AND user_id=p_user_id AND orden_id=o.id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Relación de ejecución incoherente'; END IF;
   RETURN to_jsonb(e);
 END IF;
 IF o.estado NOT IN ('aprobada','en_cola') OR o.bloqueada_por_revision OR o.pendiente_confirmar_proyecto OR (o.requiere_aprobacion AND o.resuelta_el IS NULL) THEN RAISE EXCEPTION 'La orden no está aprobada y revisada'; END IF;
 IF p_modo NOT IN ('construir','planificar') OR p_motor NOT IN ('auto','claude','lovable') THEN RAISE EXCEPTION 'Modo o motor inválido'; END IF;
 IF o.proyecto_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.proyectos WHERE id=o.proyecto_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Proyecto no autorizado'; END IF;
 -- Preserve an unambiguous source task; attention tasks remain separate.
 SELECT CASE WHEN count(*)=1 THEN (array_agg(id))[1] END INTO tid FROM public.tareas WHERE orden_id=o.id AND user_id=p_user_id AND NOT coalesce(requiere_atencion,false);
 INSERT INTO public.ejecuciones_orden(user_id,orden_id,proyecto_id,texto,modo,motor,estado,tarea_origen_id) VALUES(p_user_id,o.id,o.proyecto_id,o.texto,p_modo,p_motor,'en_cola',tid) RETURNING * INTO e;
 UPDATE public.ordenes SET ejecucion_id=e.id,estado='en_cola',actualizado_el=now() WHERE id=o.id;
 RETURN to_jsonb(e);
END $$;
CREATE OR REPLACE FUNCTION public.reclamar_ejecucion(p_id uuid,p_user_id uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_token IS NULL THEN RETURN false; END IF;
 UPDATE public.ejecuciones_orden SET bloqueo_token=p_token,bloqueo_hasta=clock_timestamp()+interval '120 seconds'
 WHERE id=p_id AND user_id=p_user_id AND estado IN ('en_cola','enviando','construyendo','comprobando','esperando_aprobacion','publicando') AND (bloqueo_hasta IS NULL OR bloqueo_hasta<clock_timestamp());
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.liberar_ejecucion(p_id uuid,p_user_id uuid,p_token uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 UPDATE public.ejecuciones_orden SET bloqueo_token=NULL,bloqueo_hasta=NULL WHERE id=p_id AND user_id=p_user_id AND bloqueo_token=p_token;
$$;
REVOKE ALL ON FUNCTION public.encolar_orden_atomica(uuid,uuid,text,text),public.reclamar_ejecucion(uuid,uuid,uuid),public.liberar_ejecucion(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.encolar_orden_atomica(uuid,uuid,text,text),public.reclamar_ejecucion(uuid,uuid,uuid),public.liberar_ejecucion(uuid,uuid,uuid) TO service_role;
ALTER TABLE public.ejecuciones_orden ADD COLUMN fusionada_sha text,ADD COLUMN publicacion_confirmada_el timestamptz;
