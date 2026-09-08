CREATE OR REPLACE FUNCTION public.finalizar_ejecucion(p_usuario uuid,p_ejecucion uuid,p_token uuid,p_resultado jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.ejecuciones_orden; estado_tarea public.estado_tarea;
BEGIN
 -- Same order-first locking as enqueue; complete execution/order/source task in one transaction.
 PERFORM 1 FROM ordenes WHERE id=(SELECT orden_id FROM ejecuciones_orden WHERE id=p_ejecucion AND user_id=p_usuario) AND user_id=p_usuario FOR UPDATE;
 SELECT * INTO e FROM ejecuciones_orden WHERE id=p_ejecucion AND user_id=p_usuario FOR UPDATE;
 IF NOT FOUND OR e.bloqueo_token IS DISTINCT FROM p_token OR p_token IS NULL OR e.bloqueo_hasta IS NULL OR e.bloqueo_hasta<=clock_timestamp() OR e.estado NOT IN ('enviando','construyendo','comprobando','publicando') THEN RAISE EXCEPTION 'La ejecución ya no puede finalizar'; END IF;
 IF e.tarea_origen_id IS NOT NULL THEN
   SELECT estado INTO estado_tarea FROM tareas WHERE id=e.tarea_origen_id AND user_id=p_usuario AND proyecto_id=e.proyecto_id FOR UPDATE;
   IF NOT FOUND OR estado_tarea IN ('pausada','cancelada') THEN RAISE EXCEPTION 'La tarea de origen no está activa'; END IF;
 END IF;
 IF coalesce((p_resultado->>'publicada')::boolean,false) AND (coalesce(p_resultado->>'url','') !~ '^https://' OR (p_resultado->>'commit') IS DISTINCT FROM coalesce(e.fusionada_sha,e.commit_sha)::text) THEN RAISE EXCEPTION 'Falta confirmación del commit publicado'; END IF;
 UPDATE ejecuciones_orden SET estado='completada',resumen=coalesce(p_resultado->>'resumen',resumen),respuesta=coalesce(p_resultado->>'respuesta',respuesta),publicado_url=coalesce(p_resultado->>'url',publicado_url),publicacion_confirmada_el=CASE WHEN coalesce((p_resultado->>'publicada')::boolean,false) THEN now() ELSE publicacion_confirmada_el END,terminada_el=now(),error=NULL WHERE id=e.id;
 UPDATE ordenes SET estado='completada',resuelta_el=now(),resuelta_por='NexDeveloper',actualizado_el=now(),comentario=coalesce(p_resultado->>'comentario','Trabajo terminado') WHERE id=e.orden_id AND user_id=p_usuario;
 UPDATE tareas SET estado='completada',progreso=100,completada_el=now(),completada_por='NexDeveloper',requiere_atencion=false,atendida_el=now() WHERE id IN (e.tarea_origen_id,e.tarea_id) AND user_id=p_usuario AND proyecto_id=e.proyecto_id;
END $$;
REVOKE ALL ON FUNCTION public.finalizar_ejecucion(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_ejecucion(uuid,uuid,uuid,jsonb) TO service_role;
