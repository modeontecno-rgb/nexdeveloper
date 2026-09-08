-- Owner supplies an explicit EUR quote and its source. No automatic FX or guessed free tier.
CREATE TABLE public.ia_tarifas_historial (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id), modelo_id uuid NOT NULL REFERENCES public.modelos_ia(id),
 anterior jsonb, nueva jsonb NOT NULL, creada_el timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ia_tarifas_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY tarifas_historial_owner ON public.ia_tarifas_historial FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.ia_tarifas_historial FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ia_tarifas_historial TO authenticated;
GRANT ALL ON public.ia_tarifas_historial TO service_role;
CREATE OR REPLACE FUNCTION public.ia_configurar_tarifa(p_modelo_id uuid,p_entrada numeric,p_salida numeric,p_fuente text,p_hasta timestamptz,p_max_entrada integer,p_max_salida integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid(); vieja jsonb; nueva jsonb;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM modelos_ia m JOIN proveedores_ia p ON p.id=m.proveedor_id AND p.user_id=m.user_id WHERE m.id=p_modelo_id AND m.user_id=uid) THEN RAISE EXCEPTION 'Modelo no autorizado'; END IF;
 IF p_entrada IS NULL OR p_salida IS NULL OR p_entrada<0 OR p_salida<0 OR p_entrada>='Infinity'::numeric OR p_salida>='Infinity'::numeric OR p_fuente IS NULL OR length(btrim(p_fuente)) NOT BETWEEN 12 AND 2000 OR p_hasta IS NULL OR p_hasta<=now() OR p_hasta>now()+interval '31 days' OR p_max_entrada IS NULL OR p_max_salida IS NULL OR p_max_entrada NOT BETWEEN 1 AND 2000000 OR p_max_salida NOT BETWEEN 1 AND 200000 THEN RAISE EXCEPTION 'Tarifa inválida: documenta euros, fuente y vigencia máxima de 31 días'; END IF;
 PERFORM 1 FROM modelos_ia WHERE id=p_modelo_id FOR UPDATE;
 SELECT to_jsonb(t) INTO vieja FROM ia_tarifas t WHERE modelo_id=p_modelo_id;
 INSERT INTO ia_tarifas(modelo_id,user_id,entrada_eur_millon,salida_eur_millon,fuente,verificada_hasta,max_entrada,max_salida) VALUES(p_modelo_id,uid,p_entrada,p_salida,btrim(p_fuente),p_hasta,p_max_entrada,p_max_salida)
 ON CONFLICT(modelo_id) DO UPDATE SET entrada_eur_millon=EXCLUDED.entrada_eur_millon,salida_eur_millon=EXCLUDED.salida_eur_millon,fuente=EXCLUDED.fuente,verificada_hasta=EXCLUDED.verificada_hasta,max_entrada=EXCLUDED.max_entrada,max_salida=EXCLUDED.max_salida;
 SELECT to_jsonb(t) INTO nueva FROM ia_tarifas t WHERE modelo_id=p_modelo_id;
 INSERT INTO ia_tarifas_historial(user_id,modelo_id,anterior,nueva) VALUES(uid,p_modelo_id,vieja,nueva);
END $$;
REVOKE ALL ON FUNCTION public.ia_configurar_tarifa(uuid,numeric,numeric,text,timestamptz,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ia_configurar_tarifa(uuid,numeric,numeric,text,timestamptz,integer,integer) TO authenticated;
