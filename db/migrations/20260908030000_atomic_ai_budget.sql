-- Prices are explicitly verified in EUR; no assumed exchange rate or free provider.
CREATE TABLE public.ia_control (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 habilitado boolean NOT NULL DEFAULT false,
 limite_dia numeric(14,6) NOT NULL DEFAULT 0 CHECK(limite_dia>=0 AND limite_dia<'Infinity'::numeric),
 limite_mes numeric(14,6) NOT NULL DEFAULT 0 CHECK(limite_mes>=0 AND limite_mes<'Infinity'::numeric),
 limite_personal_mes numeric(14,6) NOT NULL DEFAULT 0 CHECK(limite_personal_mes>=0 AND limite_personal_mes<'Infinity'::numeric),
 maximo_llamada numeric(14,6) NOT NULL DEFAULT 0 CHECK(maximo_llamada>=0 AND maximo_llamada<'Infinity'::numeric),
 actualizado_el timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ia_tarifas (
 modelo_id uuid PRIMARY KEY REFERENCES public.modelos_ia(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 entrada_eur_millon numeric(14,6) NOT NULL CHECK(entrada_eur_millon>=0 AND entrada_eur_millon<'Infinity'::numeric),
 salida_eur_millon numeric(14,6) NOT NULL CHECK(salida_eur_millon>=0 AND salida_eur_millon<'Infinity'::numeric),
 fuente text NOT NULL CHECK(length(btrim(fuente))>0),
 verificada_hasta timestamptz NOT NULL,
 max_entrada integer NOT NULL CHECK(max_entrada>0),
 max_salida integer NOT NULL CHECK(max_salida>0)
);
CREATE TABLE public.ia_reservas (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 proyecto_id uuid REFERENCES public.proyectos(id) ON DELETE RESTRICT,
 modelo_id uuid NOT NULL REFERENCES public.modelos_ia(id) ON DELETE RESTRICT,
 ejecucion_id uuid REFERENCES public.ejecuciones_orden(id) ON DELETE RESTRICT,
 ambito text NOT NULL CHECK(ambito IN ('personal','proyecto','cartera')),
 operacion text NOT NULL CHECK(length(operacion) BETWEEN 1 AND 100),
 proveedor text NOT NULL,
 reservado numeric(14,6) NOT NULL CHECK(reservado>=0),
 base_previa_orden numeric(14,6) NOT NULL DEFAULT 0 CHECK(base_previa_orden>=0 AND base_previa_orden<'Infinity'::numeric),
 coste numeric(14,6),
 estado text NOT NULL DEFAULT 'reservada' CHECK(estado IN ('reservada','liquidada','incierta')),
 tokens_entrada integer, tokens_salida integer,
 entrada_eur_millon numeric(14,6) NOT NULL,
 salida_eur_millon numeric(14,6) NOT NULL,
 creada_el timestamptz NOT NULL DEFAULT now(),
 liquidada_el timestamptz,
 consumo_id uuid UNIQUE REFERENCES public.consumos_ia(id),
 CHECK ((ambito='proyecto')=(proyecto_id IS NOT NULL))
);
CREATE INDEX ia_reservas_usuario_fecha ON public.ia_reservas(user_id,creada_el);
ALTER TABLE public.ia_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY ia_control_owner ON public.ia_control FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY ia_tarifas_owner_read ON public.ia_tarifas FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY ia_reservas_owner_read ON public.ia_reservas FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.ia_control,public.ia_tarifas,public.ia_reservas FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ia_control TO authenticated;
GRANT SELECT ON public.ia_tarifas,public.ia_reservas TO authenticated;
GRANT ALL ON public.ia_control,public.ia_tarifas,public.ia_reservas TO service_role;

CREATE OR REPLACE FUNCTION public.ia_reservar(p_id uuid,p_user_id uuid,p_modelo_id uuid,p_ambito text,p_proyecto_id uuid,p_operacion text,p_entrada integer,p_salida integer,p_ejecucion_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cfg public.ia_control; tarifa public.ia_tarifas; proveedor_slug text; importe numeric; mes timestamptz:=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; dia timestamptz:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; gastado numeric; reservado numeric; b record; limite_orden numeric; previo_orden numeric; orden_actual uuid; base_orden numeric:=0; base_existente numeric;
BEGIN
 -- Lock one user before checking any scope, including concurrent different models.
 SELECT * INTO cfg FROM public.ia_control WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR NOT cfg.habilitado THEN RAISE EXCEPTION 'Consumo IA desactivado'; END IF;
 IF p_id IS NULL OR p_entrada IS NULL OR p_salida IS NULL OR p_entrada<0 OR p_salida<1 OR p_ambito NOT IN ('personal','proyecto','cartera') OR p_ambito IS NULL OR ((p_ambito='proyecto')<>(p_proyecto_id IS NOT NULL)) THEN RAISE EXCEPTION 'Reserva no válida'; END IF;
 IF p_proyecto_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.proyectos WHERE id=p_proyecto_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Proyecto no autorizado'; END IF;
 SELECT t.* INTO tarifa FROM public.ia_tarifas t JOIN public.modelos_ia m ON m.id=t.modelo_id AND m.user_id=t.user_id JOIN public.proveedores_ia p ON p.id=m.proveedor_id AND p.user_id=m.user_id WHERE t.modelo_id=p_modelo_id AND t.user_id=p_user_id AND m.activo AND p.activo;
 IF NOT FOUND OR tarifa.verificada_hasta<=now() OR p_entrada>tarifa.max_entrada OR p_salida>tarifa.max_salida THEN RAISE EXCEPTION 'Tarifa caducada, inexistente o contexto no permitido'; END IF;
 SELECT p.clave_slug INTO proveedor_slug FROM public.modelos_ia m JOIN public.proveedores_ia p ON p.id=m.proveedor_id WHERE m.id=p_modelo_id;
 importe:=ceil((p_entrada*tarifa.entrada_eur_millon+p_salida*tarifa.salida_eur_millon)/1000000*1000000)/1000000;
 IF importe>cfg.maximo_llamada THEN RAISE EXCEPTION 'Máximo por llamada superado'; END IF;
 SELECT coalesce(sum(coste),0) INTO gastado FROM public.consumos_ia WHERE user_id=p_user_id AND created_at>=mes;
 SELECT coalesce(sum(r.reservado),0) INTO reservado FROM public.ia_reservas r WHERE user_id=p_user_id AND estado IN ('reservada','incierta');
 -- Unresolved reservations persist across month boundaries, never silently refunded.
 IF gastado+reservado+importe>cfg.limite_mes THEN RAISE EXCEPTION 'Límite mensual superado'; END IF;
 SELECT coalesce(sum(coste),0) INTO gastado FROM public.consumos_ia WHERE user_id=p_user_id AND created_at>=dia;
 IF gastado+reservado+importe>cfg.limite_dia THEN RAISE EXCEPTION 'Límite diario superado'; END IF;
 IF p_ambito='personal' THEN
   SELECT coalesce(sum(c.coste),0) INTO gastado FROM public.consumos_ia c LEFT JOIN public.ia_reservas r ON r.consumo_id=c.id WHERE c.user_id=p_user_id AND c.created_at>=mes AND c.proyecto_id IS NULL AND (r.id IS NULL OR r.ambito='personal');
   SELECT coalesce(sum(r.reservado),0) INTO reservado FROM public.ia_reservas r WHERE r.user_id=p_user_id AND r.ambito='personal' AND r.estado IN ('reservada','incierta');
   IF gastado+reservado+importe>cfg.limite_personal_mes THEN RAISE EXCEPTION 'Límite personal superado'; END IF;
 END IF;
 -- Existing blocking budgets retain effect (including provider and project budgets).
 FOR b IN SELECT * FROM public.presupuestos_ia WHERE user_id=p_user_id AND activo AND accion='bloquear' AND (ambito='global' OR (ambito='proveedor' AND referencia=proveedor_slug) OR (ambito='proyecto' AND referencia=p_proyecto_id::text)) LOOP
   SELECT coalesce(sum(c.coste),0) INTO gastado FROM public.consumos_ia c LEFT JOIN public.modelos_ia m ON m.id=c.modelo_id LEFT JOIN public.proveedores_ia p ON p.id=m.proveedor_id WHERE c.user_id=p_user_id AND c.created_at>=mes AND (b.ambito='global' OR (b.ambito='proyecto' AND c.proyecto_id::text=b.referencia) OR (b.ambito='proveedor' AND p.clave_slug=b.referencia));
   SELECT coalesce(sum(r.reservado),0) INTO reservado FROM public.ia_reservas r WHERE r.user_id=p_user_id AND r.estado IN ('reservada','incierta') AND (b.ambito='global' OR (b.ambito='proyecto' AND r.proyecto_id::text=b.referencia) OR (b.ambito='proveedor' AND r.proveedor=b.referencia));
   IF b.bloqueado OR gastado+reservado+importe>b.limite_mensual THEN RAISE EXCEPTION 'Presupuesto por ámbito superado'; END IF;
 END LOOP;
 IF p_ejecucion_id IS NOT NULL THEN
   SELECT e.coste_ia,coalesce(c.max_coste_ia,3),e.orden_id INTO previo_orden,limite_orden,orden_actual FROM public.ejecuciones_orden e LEFT JOIN public.ejecucion_config c ON c.user_id=e.user_id WHERE e.id=p_ejecucion_id AND e.user_id=p_user_id AND e.proyecto_id=p_proyecto_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Ejecución fuera de contexto'; END IF;
   IF limite_orden IS NULL OR limite_orden<0 OR limite_orden>='Infinity'::numeric THEN RAISE EXCEPTION 'Límite de orden inválido'; END IF;
   SELECT coalesce(sum(coste) FILTER(WHERE estado='liquidada'),0),coalesce(sum(r.reservado) FILTER(WHERE estado IN ('reservada','incierta')),0),max(base_previa_orden) INTO gastado,reservado,base_existente FROM public.ia_reservas r WHERE r.user_id=p_user_id AND (r.ejecucion_id=p_ejecucion_id OR (orden_actual IS NOT NULL AND r.ejecucion_id IN (SELECT id FROM public.ejecuciones_orden WHERE orden_id=orden_actual AND user_id=p_user_id)));
   base_orden:=coalesce(base_existente,greatest(coalesce(previo_orden,0)-gastado,0));
   IF base_orden>='Infinity'::numeric THEN RAISE EXCEPTION 'Coste previo inválido'; END IF;
   IF base_orden+gastado+reservado+importe>limite_orden THEN RAISE EXCEPTION 'Máximo por orden superado'; END IF;
 END IF;
 INSERT INTO public.ia_reservas(id,user_id,proyecto_id,modelo_id,ambito,operacion,proveedor,reservado,entrada_eur_millon,salida_eur_millon,ejecucion_id,base_previa_orden) VALUES(p_id,p_user_id,p_proyecto_id,p_modelo_id,p_ambito,p_operacion,proveedor_slug,importe,tarifa.entrada_eur_millon,tarifa.salida_eur_millon,p_ejecucion_id,base_orden);
 RETURN jsonb_build_object('id',p_id,'reservado',importe);
END $$;

CREATE OR REPLACE FUNCTION public.ia_liquidar(p_id uuid,p_user_id uuid,p_entrada integer DEFAULT NULL,p_salida integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.ia_reservas; total numeric; cid uuid;
BEGIN
 PERFORM 1 FROM public.ia_control WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO r FROM public.ia_reservas WHERE id=p_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva inexistente'; END IF;
 IF r.estado='liquidada' THEN RETURN jsonb_build_object('id',r.id,'coste',r.coste,'estado',r.estado); END IF;
 IF p_entrada IS NULL OR p_salida IS NULL THEN
   UPDATE public.ia_reservas SET estado='incierta' WHERE id=r.id;
   RETURN jsonb_build_object('id',r.id,'reservado',r.reservado,'estado','incierta');
 END IF;
 IF p_entrada<0 OR p_salida<0 THEN RAISE EXCEPTION 'Consumo inválido'; END IF;
 total:=ceil((p_entrada*r.entrada_eur_millon+p_salida*r.salida_eur_millon))/1000000;
 IF total>r.reservado THEN UPDATE public.ia_control SET habilitado=false,actualizado_el=now() WHERE user_id=p_user_id; END IF;
 INSERT INTO public.consumos_ia(user_id,proyecto_id,modelo_id,tokens_entrada,tokens_salida,coste,resultado) VALUES(p_user_id,r.proyecto_id,r.modelo_id,p_entrada,p_salida,total,'ok') RETURNING id INTO cid;
 UPDATE public.ia_reservas SET estado='liquidada',coste=total,tokens_entrada=p_entrada,tokens_salida=p_salida,liquidada_el=now(),consumo_id=cid WHERE id=r.id;
 RETURN jsonb_build_object('id',r.id,'coste',total,'estado','liquidada');
END $$;
REVOKE ALL ON FUNCTION public.ia_reservar(uuid,uuid,uuid,text,uuid,text,integer,integer,uuid),public.ia_liquidar(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ia_reservar(uuid,uuid,uuid,text,uuid,text,integer,integer,uuid),public.ia_liquidar(uuid,uuid,integer,integer) TO service_role;
ALTER TABLE public.personal_config ALTER COLUMN modo SET DEFAULT 'rapido';
ALTER TABLE public.personal_config ALTER COLUMN max_proveedores SET DEFAULT 1;

-- Existing consumption CRUD must not permit lowering metered spend or moving dates.
CREATE OR REPLACE FUNCTION public.ia_proteger_consumo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.ia_reservas WHERE consumo_id=OLD.id) THEN RAISE EXCEPTION 'Consumo contabilizado inmutable'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ia_proteger_consumo() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ia_consumo_inmutable BEFORE UPDATE ON public.consumos_ia FOR EACH ROW EXECUTE FUNCTION public.ia_proteger_consumo();

CREATE OR REPLACE FUNCTION public.ia_resumen() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE usuario uuid:=auth.uid(); cfg jsonb; gasto numeric; reservado numeric; inciertas integer;
BEGIN
 IF usuario IS NULL THEN RAISE EXCEPTION 'Sin sesión'; END IF;
 SELECT to_jsonb(c) INTO cfg FROM public.ia_control c WHERE user_id=usuario;
 SELECT coalesce(sum(coste),0) INTO gasto FROM public.consumos_ia WHERE user_id=usuario AND created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 SELECT coalesce(sum(r.reservado),0),count(*) FILTER(WHERE estado='incierta') INTO reservado,inciertas FROM public.ia_reservas r WHERE user_id=usuario AND estado IN ('reservada','incierta');
 RETURN jsonb_build_object('config',cfg,'calculado_mes',gasto,'reservado',reservado,'inciertas',inciertas,'actualizado_el',now());
END $$;
REVOKE ALL ON FUNCTION public.ia_resumen() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ia_resumen() TO authenticated;
