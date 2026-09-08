CREATE TABLE public.personal_memoria_historial (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 instrucciones text,perfil_estilo text,creada_el timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_memoria_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY personal_memoria_owner ON public.personal_memoria_historial FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.personal_memoria_historial FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.personal_memoria_historial TO authenticated;
GRANT ALL ON public.personal_memoria_historial TO service_role;
CREATE OR REPLACE FUNCTION public.personal_registrar_memoria() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.instrucciones IS DISTINCT FROM OLD.instrucciones OR NEW.perfil_estilo IS DISTINCT FROM OLD.perfil_estilo THEN
   INSERT INTO personal_memoria_historial(user_id,instrucciones,perfil_estilo) VALUES(NEW.user_id,NEW.instrucciones,NEW.perfil_estilo);
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.personal_registrar_memoria() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER personal_memoria_revision AFTER INSERT OR UPDATE ON public.personal_config FOR EACH ROW EXECUTE FUNCTION public.personal_registrar_memoria();
INSERT INTO personal_memoria_historial(user_id,instrucciones,perfil_estilo) SELECT user_id,instrucciones,perfil_estilo FROM personal_config;
CREATE OR REPLACE FUNCTION public.personal_restaurar_memoria(p_revision bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.personal_memoria_historial;
BEGIN
 SELECT * INTO r FROM personal_memoria_historial WHERE id=p_revision AND user_id=auth.uid();IF NOT FOUND THEN RAISE EXCEPTION 'Revisión no autorizada'; END IF;
 UPDATE personal_config SET instrucciones=r.instrucciones,perfil_estilo=r.perfil_estilo,actualizado_el=now() WHERE user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Configuración inexistente'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.personal_restaurar_memoria(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.personal_restaurar_memoria(bigint) TO authenticated;
