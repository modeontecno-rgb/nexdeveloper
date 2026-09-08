ALTER TABLE public.documentos_nex ADD COLUMN sha256 text CHECK(sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'), ADD COLUMN bucket text;
CREATE UNIQUE INDEX documento_nex_objeto_unico ON public.documentos_nex(user_id,bucket,ruta_remota) WHERE bucket IS NOT NULL;
ALTER TABLE public.cierres_version ADD COLUMN documento_pdf_id uuid REFERENCES public.documentos_nex(id);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('entregas','entregas',false,20000000,ARRAY['application/pdf','video/webm','audio/mpeg','text/markdown']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY entregas_owner_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='entregas' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE OR REPLACE FUNCTION public.cerrar_documentacion(p_usuario uuid,p_cierre uuid,p_datos jsonb,p_ruta text,p_sha text,p_bytes bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.cierres_version; doc uuid;
BEGIN
 SELECT * INTO c FROM cierres_version WHERE id=p_cierre AND user_id=p_usuario FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM proyectos WHERE id=c.proyecto_id AND user_id=p_usuario) THEN RAISE EXCEPTION 'Cierre no autorizado'; END IF;
 IF c.documento_pdf_id IS NOT NULL THEN RETURN c.documento_pdf_id; END IF;
 IF p_sha IS NULL OR p_sha !~ '^[a-f0-9]{64}$' OR p_bytes IS NULL OR p_bytes NOT BETWEEN 1 AND 20000000 OR p_ruta IS DISTINCT FROM (p_usuario::text||'/'||c.proyecto_id::text||'/'||c.id::text||'/'||p_sha||'.pdf') OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='entregas' AND name=p_ruta) THEN RAISE EXCEPTION 'Falta el PDF almacenado y verificado'; END IF;
 INSERT INTO documentos_nex(user_id,proyecto_id,tipo,titulo,version,nombre_archivo,mime,bytes,ruta_remota,bucket,sha256,origen)
 VALUES(p_usuario,c.proyecto_id,'hoja_cambios','Hoja de cambios '||c.version,c.version,'hoja-de-cambios-'||c.version||'.pdf','application/pdf',p_bytes,p_ruta,'entregas',p_sha,'nexdeveloper') RETURNING id INTO doc;
 UPDATE cierres_version SET documento_pdf_id=doc,estado='cerrada',cerrada_el=now(),titulo=coalesce(p_datos->>'titulo',titulo),resumen=coalesce(p_datos->>'resumen',resumen),cambios=coalesce(p_datos->'cambios',cambios),tecnico=coalesce(p_datos->'tecnico',tecnico),como_probar=coalesce(p_datos->'como_probar',como_probar),pendiente_usuario=coalesce(p_datos->'pendiente_usuario',pendiente_usuario),hoja_md=p_datos->>'hoja_md',hoja_html=p_datos->>'hoja_html',error=NULL WHERE id=c.id;
 INSERT INTO actividad(user_id,proyecto_id,tipo,texto,referencia_tabla,referencia_id) VALUES(p_usuario,c.proyecto_id,'resultado','Cierre documental '||c.version||': PDF guardado. Publicación de producto independiente.','cierres_version',c.id);
 RETURN doc;
END $$;
REVOKE ALL ON FUNCTION public.cerrar_documentacion(uuid,uuid,jsonb,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_documentacion(uuid,uuid,jsonb,text,text,bigint) TO service_role;
