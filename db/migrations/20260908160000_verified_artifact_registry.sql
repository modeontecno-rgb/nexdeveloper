-- Only server-verified objects enter the delivery registry. Authenticated clients read via RLS.
CREATE OR REPLACE FUNCTION public.registrar_entrega(p_usuario uuid,p_proyecto uuid,p_tipo text,p_titulo text,p_nombre text,p_mime text,p_ruta text,p_sha text,p_bytes bigint,p_version text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE doc uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM proyectos WHERE id=p_proyecto AND user_id=p_usuario) THEN RAISE EXCEPTION 'Proyecto no autorizado'; END IF;
 IF p_tipo NOT IN ('hoja_cambios','manual','comercial','informe','video','imagen','otro') OR length(p_titulo) NOT BETWEEN 1 AND 300 OR p_titulo IS NULL OR p_sha IS NULL OR p_sha !~ '^[a-f0-9]{64}$' OR p_bytes IS NULL OR p_bytes NOT BETWEEN 1 AND 20000000 OR p_ruta NOT LIKE p_usuario::text||'/'||p_proyecto::text||'/%' OR position(p_sha in p_ruta)=0 OR p_ruta IS NULL OR p_nombre IS NULL OR length(p_nombre)>300 THEN RAISE EXCEPTION 'Archivo inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='entregas' AND name=p_ruta AND (metadata->>'size')::bigint=p_bytes AND metadata->>'mimetype'=p_mime) THEN RAISE EXCEPTION 'Archivo no verificado en almacén'; END IF;
 INSERT INTO documentos_nex(user_id,proyecto_id,tipo,titulo,nombre_archivo,mime,bytes,ruta_remota,bucket,sha256,version,origen)
 VALUES(p_usuario,p_proyecto,p_tipo,p_titulo,p_nombre,p_mime,p_bytes,p_ruta,'entregas',p_sha,p_version,'nexdeveloper')
 ON CONFLICT(user_id,bucket,ruta_remota) WHERE bucket IS NOT NULL DO UPDATE SET sha256=EXCLUDED.sha256 RETURNING id INTO doc;
 RETURN doc;
END $$;
REVOKE ALL ON FUNCTION public.registrar_entrega(uuid,uuid,text,text,text,text,text,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_entrega(uuid,uuid,text,text,text,text,text,text,bigint,text) TO service_role;
