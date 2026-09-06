-- 009_copias.sql — NexDeveloper 0.9.0 «Copias de seguridad»
-- Reconstrucción del esquema aplicado en eqyuodrmlbclobaverdb el 6/09/2026 (referencia para el archivo del proyecto).
-- Requiere: extensión pgcrypto, esquema private con clave_cifrado() y claves_sistema, pg_cron y pg_net (migración 006).

CREATE TABLE public.copias_destinos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nombre text NOT NULL,
  tipo text NOT NULL,                       -- 's3' | 'webdav'
  url_servidor text NOT NULL,
  bucket text,
  region text DEFAULT 'eu-central-1',
  ruta_prefijo text DEFAULT '',
  usuario text,
  secreto_cifrado text,                     -- pgp_sym_encrypt con private.clave_cifrado()
  activo boolean NOT NULL DEFAULT true,
  es_predeterminado boolean NOT NULL DEFAULT false,
  ultima_prueba timestamptz,
  resultado_prueba text,
  notas text,
  creado_el timestamptz NOT NULL DEFAULT now(),
  actualizado_el timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.copias_config (
  user_id uuid NOT NULL DEFAULT auth.uid() PRIMARY KEY,
  destino_id uuid REFERENCES public.copias_destinos(id),
  auto_activa boolean NOT NULL DEFAULT false,
  diaria boolean NOT NULL DEFAULT true,
  hora_diaria smallint NOT NULL DEFAULT 3,
  semanal boolean NOT NULL DEFAULT true,
  dia_semanal smallint NOT NULL DEFAULT 0,
  retener_diarias smallint NOT NULL DEFAULT 7,
  retener_semanales smallint NOT NULL DEFAULT 4,
  bases_datos_todas boolean NOT NULL DEFAULT true,
  bases_datos_seleccion text[] NOT NULL DEFAULT '{}',
  repositorios_todos boolean NOT NULL DEFAULT true,
  repositorios_seleccion text[] NOT NULL DEFAULT '{}',
  aviso_dias smallint NOT NULL DEFAULT 2,
  ultima_auto timestamptz,
  actualizado_el timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.copias_origenes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tipo text NOT NULL,                       -- 'base_datos' | 'repositorio'
  objetivo text NOT NULL,                   -- ref de Supabase o "propietario/repo"
  nombre text NOT NULL,
  detalle jsonb DEFAULT '{}',
  proyecto_id uuid,
  actualizado_el timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.copias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  destino_id uuid,
  lote_id uuid NOT NULL,
  tipo text NOT NULL,
  origen text NOT NULL DEFAULT 'manual',    -- manual | diaria | semanal
  objetivo text NOT NULL,
  nombre text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente', -- pendiente | en_curso | ok | error
  ruta_remota text,
  bytes bigint,
  num_tablas integer,
  num_filas bigint,
  error text,
  iniciada_el timestamptz,
  terminada_el timestamptz,
  creado_el timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW public.v_copias_destinos AS
  SELECT id, user_id, nombre, tipo, url_servidor, bucket, region, ruta_prefijo, usuario,
         (secreto_cifrado IS NOT NULL) AS tiene_secreto, activo, es_predeterminado,
         ultima_prueba, resultado_prueba, notas, creado_el, actualizado_el
  FROM public.copias_destinos;

ALTER TABLE public.copias_destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copias_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copias_origenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copias          ENABLE ROW LEVEL SECURITY;
CREATE POLICY copias_destinos_propietario ON public.copias_destinos FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY copias_config_propietario   ON public.copias_config   FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY copias_origenes_propietario ON public.copias_origenes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY copias_propietario          ON public.copias          FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guardar_secreto_copias(p_destino_id uuid, p_secreto text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_key text := private.clave_cifrado();
begin
  if v_key is null or v_key = '' then raise exception 'No hay clave de cifrado configurada'; end if;
  update public.copias_destinos
     set secreto_cifrado = case when p_secreto is null or p_secreto = '' then null else encode(pgp_sym_encrypt(p_secreto, v_key),'base64') end,
         actualizado_el = now()
   where id = p_destino_id and user_id = auth.uid();
  if not found then raise exception 'Destino no encontrado'; end if;
  return true;
end $$;

-- lanzar_copias(user, origen, tipos) crea las filas del histórico y llama por pg_net a la Edge Function copias-generar
-- con la cabecera x-cron-token (private.claves_sistema.cron_token). lanzar_mis_copias es la envoltura para el usuario.
CREATE OR REPLACE FUNCTION public.lanzar_mis_copias(p_tipos text[] DEFAULT ARRAY['base_datos','repositorio'])
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  select public.lanzar_copias(auth.uid(), 'manual', p_tipos);
$$;

-- Programación (copias_auto_dispatch comprueba copias_config de cada usuario y lanza las que tocan)
SELECT cron.schedule('copias-diaria',  '0 1 * * 1-6', $$select public.copias_auto_dispatch('diaria')$$);
SELECT cron.schedule('copias-semanal', '0 1 * * 0',   $$select public.copias_auto_dispatch('semanal')$$);
