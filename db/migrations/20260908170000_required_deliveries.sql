CREATE TABLE public.entregas_requeridas(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),proyecto_id uuid NOT NULL REFERENCES proyectos(id),orden_id uuid NOT NULL REFERENCES ordenes(id),
 titulo text NOT NULL CHECK(length(trim(titulo)) BETWEEN 1 AND 160),documento_id uuid REFERENCES documentos_nex(id),creado_el timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE entregas_requeridas ENABLE ROW LEVEL SECURITY;
CREATE POLICY entregas_requeridas_owner ON entregas_requeridas FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON entregas_requeridas FROM PUBLIC,anon,authenticated;
GRANT SELECT ON entregas_requeridas TO authenticated;
GRANT ALL ON entregas_requeridas TO service_role;
CREATE OR REPLACE FUNCTION public.configurar_entrega(p_orden uuid,p_titulo text,p_entrega uuid DEFAULT NULL,p_documento uuid DEFAULT NULL,p_eliminar boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.ordenes;r uuid;
BEGIN
 SELECT * INTO o FROM ordenes WHERE id=p_orden AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR o.estado IN ('completada','cancelada') THEN RAISE EXCEPTION 'Orden no editable'; END IF;
 IF p_entrega IS NULL THEN
   IF p_eliminar OR p_documento IS NOT NULL THEN RAISE EXCEPTION 'Falta entrega'; END IF;
   INSERT INTO entregas_requeridas(user_id,proyecto_id,orden_id,titulo) VALUES(o.user_id,o.proyecto_id,o.id,p_titulo) RETURNING id INTO r;
   RETURN r;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM entregas_requeridas WHERE id=p_entrega AND orden_id=o.id AND user_id=o.user_id) THEN RAISE EXCEPTION 'Entrega no autorizada'; END IF;
 IF p_eliminar THEN
   IF EXISTS(SELECT 1 FROM ejecuciones_orden WHERE orden_id=o.id) THEN RAISE EXCEPTION 'No se eliminan requisitos después de iniciar el trabajo'; END IF;
   DELETE FROM entregas_requeridas WHERE id=p_entrega;RETURN p_entrega;
 END IF;
 IF p_documento IS NULL OR NOT EXISTS(SELECT 1 FROM documentos_nex d JOIN storage.objects s ON s.bucket_id=d.bucket AND s.name=d.ruta_remota WHERE d.id=p_documento AND d.user_id=o.user_id AND d.proyecto_id=o.proyecto_id AND d.bucket='entregas' AND d.sha256 IS NOT NULL AND d.bytes>0) THEN RAISE EXCEPTION 'Adjunta un archivo verificado del mismo proyecto'; END IF;
 UPDATE entregas_requeridas SET documento_id=p_documento WHERE id=p_entrega;RETURN p_entrega;
END $$;
REVOKE ALL ON FUNCTION public.configurar_entrega(uuid,text,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configurar_entrega(uuid,text,uuid,uuid,boolean) TO authenticated;
-- Guard all completion paths, including legacy direct updates.
CREATE OR REPLACE FUNCTION public.comprobar_entregas_orden() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.estado='completada' AND OLD.estado IS DISTINCT FROM NEW.estado AND EXISTS(
 SELECT 1 FROM entregas_requeridas r LEFT JOIN documentos_nex d ON d.id=r.documento_id AND d.user_id=NEW.user_id AND d.proyecto_id=NEW.proyecto_id AND d.bucket='entregas' AND d.sha256 IS NOT NULL
 LEFT JOIN storage.objects s ON s.bucket_id=d.bucket AND s.name=d.ruta_remota
 WHERE r.orden_id=NEW.id AND (d.id IS NULL OR s.id IS NULL)) THEN RAISE EXCEPTION 'Faltan entregas obligatorias verificadas'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER comprobar_entregas_orden BEFORE UPDATE ON ordenes FOR EACH ROW EXECUTE FUNCTION comprobar_entregas_orden();
REVOKE ALL ON FUNCTION public.comprobar_entregas_orden() FROM PUBLIC,anon,authenticated;
-- The proof is written only by server-side storage validation, never by a browser client.
CREATE OR REPLACE FUNCTION public.proteger_archivo_verificado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user IN ('anon','authenticated') AND (to_jsonb(NEW)->>'bucket'='entregas' OR to_jsonb(OLD)->>'bucket'='entregas') THEN RAISE EXCEPTION 'Los archivos verificados se registran a través del servidor'; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER proteger_archivo_verificado BEFORE INSERT OR UPDATE OR DELETE ON documentos_nex FOR EACH ROW EXECUTE FUNCTION proteger_archivo_verificado();
