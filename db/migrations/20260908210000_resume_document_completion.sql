ALTER TABLE ejecuciones_orden ADD COLUMN resultado_pendiente jsonb;
CREATE OR REPLACE FUNCTION public.cerrar_o_esperar_entregas(p_usuario uuid,p_ejecucion uuid,p_token uuid,p_resultado jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.ejecuciones_orden;
BEGIN
 PERFORM 1 FROM ordenes WHERE id=(SELECT orden_id FROM ejecuciones_orden WHERE id=p_ejecucion AND user_id=p_usuario) AND user_id=p_usuario FOR UPDATE;
 SELECT * INTO e FROM ejecuciones_orden WHERE id=p_ejecucion AND user_id=p_usuario FOR UPDATE;
 IF NOT FOUND OR p_token IS NULL OR e.bloqueo_token IS DISTINCT FROM p_token OR e.bloqueo_hasta IS NULL OR e.bloqueo_hasta<=clock_timestamp() OR (e.estado NOT IN ('enviando','construyendo','comprobando','publicando') AND NOT(e.estado='esperando_aprobacion' AND e.resultado_pendiente IS NOT NULL)) THEN RAISE EXCEPTION 'Ejecución no disponible para cerrar';END IF;
 IF EXISTS(SELECT 1 FROM entregas_requeridas r LEFT JOIN documentos_nex d ON d.id=r.documento_id AND d.user_id=e.user_id AND d.proyecto_id=e.proyecto_id AND d.bucket='entregas' AND d.sha256 IS NOT NULL LEFT JOIN storage.objects s ON s.bucket_id=d.bucket AND s.name=d.ruta_remota WHERE r.orden_id=e.orden_id AND (d.id IS NULL OR s.id IS NULL)) THEN
   UPDATE ejecuciones_orden SET resultado_pendiente=coalesce(resultado_pendiente,p_resultado),estado='esperando_aprobacion',error=NULL WHERE id=e.id;
   RETURN false;
 END IF;
 IF e.estado='esperando_aprobacion' THEN UPDATE ejecuciones_orden SET estado='comprobando' WHERE id=e.id;END IF;
 PERFORM finalizar_ejecucion(p_usuario,e.id,p_token,coalesce(e.resultado_pendiente,p_resultado));
 UPDATE ejecuciones_orden SET resultado_pendiente=NULL WHERE id=e.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cerrar_o_esperar_entregas(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_o_esperar_entregas(uuid,uuid,uuid,jsonb) TO service_role;
