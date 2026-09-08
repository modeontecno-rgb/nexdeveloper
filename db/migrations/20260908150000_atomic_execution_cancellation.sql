CREATE OR REPLACE FUNCTION public.cancelar_ejecucion(p_usuario uuid,p_ejecucion uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.ejecuciones_orden;
BEGIN
 PERFORM 1 FROM ordenes WHERE id=(SELECT orden_id FROM ejecuciones_orden WHERE id=p_ejecucion AND user_id=p_usuario) AND user_id=p_usuario FOR UPDATE;
 SELECT * INTO e FROM ejecuciones_orden WHERE id=p_ejecucion AND user_id=p_usuario FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ejecución no encontrada'; END IF;
 IF e.estado='completada' THEN RAISE EXCEPTION 'No se cancela retroactivamente un trabajo terminado'; END IF;
 IF e.estado='cancelada' THEN RETURN; END IF;
 UPDATE ejecuciones_orden SET estado='cancelada',terminada_el=now(),bloqueo_token=NULL,bloqueo_hasta=NULL WHERE id=e.id;
 UPDATE ordenes SET estado='cancelada',actualizado_el=now(),comentario='No se iniciarán más pasos. Las operaciones externas ya enviadas requieren conciliación.' WHERE id=e.orden_id AND user_id=p_usuario;
 UPDATE tareas SET estado='pausada',ultima_actividad=now() WHERE id=e.tarea_origen_id AND user_id=p_usuario AND proyecto_id=e.proyecto_id AND estado NOT IN ('completada','cancelada');
END $$;
REVOKE ALL ON FUNCTION public.cancelar_ejecucion(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_ejecucion(uuid,uuid) TO service_role;
