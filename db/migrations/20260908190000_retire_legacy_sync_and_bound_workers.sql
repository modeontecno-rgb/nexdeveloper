CREATE OR REPLACE FUNCTION public.lanzar_sincronizacion_proyectian(p_accion text DEFAULT 'todo') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN RAISE NOTICE 'Sincronización antigua retirada. Usa enlaces explícitos del intercambio.'; END $$;
REVOKE ALL ON FUNCTION public.lanzar_sincronizacion_proyectian(text) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE j record;BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
 FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('proyectian-pantallas','proyectian-pendientes','proyectian-versiones-salud') AND command LIKE '%lanzar_sincronizacion_proyectian%' LOOP PERFORM cron.unschedule(j.jobid);END LOOP;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.reclamar_ejecucion(p_id uuid,p_user_id uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE limite integer;ocupadas integer;
BEGIN
 IF p_token IS NULL OR p_user_id IS NULL THEN RETURN false; END IF;
 -- One short transaction per user serializes admission across distinct orders.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,4819));
 SELECT max_simultaneas INTO limite FROM ejecucion_config WHERE user_id=p_user_id;
 limite:=coalesce(limite,2);IF limite NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Límite de concurrencia inválido';END IF;
 SELECT count(*) INTO ocupadas FROM ejecuciones_orden WHERE user_id=p_user_id AND id<>p_id AND (estado IN ('enviando','construyendo','comprobando','publicando') OR (bloqueo_hasta>clock_timestamp() AND estado IN ('en_cola','esperando_aprobacion')));
 IF ocupadas>=limite THEN RETURN false;END IF;
 UPDATE ejecuciones_orden SET bloqueo_token=p_token,bloqueo_hasta=clock_timestamp()+interval '120 seconds'
 WHERE id=p_id AND user_id=p_user_id AND estado IN ('en_cola','enviando','construyendo','comprobando','esperando_aprobacion','publicando') AND (bloqueo_hasta IS NULL OR bloqueo_hasta<clock_timestamp());
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.reclamar_ejecucion(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reclamar_ejecucion(uuid,uuid,uuid) TO service_role;
