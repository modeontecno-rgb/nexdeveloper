-- NexDeveloper · Migración 020 · Ejecución real de órdenes por la IA (API de Lovable)  · v0.20.0
-- Conexión OAuth con Lovable (token cifrado), ejecuciones de órdenes, configuración y lanzador programado.

alter table public.proyectos add column if not exists lovable_project_id text;

-- Conexión con Lovable (una por usuario)
create table if not exists public.lovable_conexion (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id text,
  cuenta text,
  estado text not null default 'desconectada',           -- desconectada | conectada | error
  secreto_cifrado text,                                   -- refresh token (cifrado)
  acceso_cifrado text,                                    -- access token (cifrado)
  expira_el timestamptz,
  ultimo_error text,
  ultima_comprobacion timestamptz,
  actualizado_el timestamptz not null default now()
);
alter table public.lovable_conexion enable row level security;
drop policy if exists "lovable_conexion propia" on public.lovable_conexion;
create policy "lovable_conexion propia" on public.lovable_conexion for select using (user_id = auth.uid());

-- Estados temporales del OAuth (PKCE)
create table if not exists public.oauth_estados (
  state text primary key,
  user_id uuid not null,
  proveedor text not null default 'lovable',
  verifier text not null,
  creado_el timestamptz not null default now()
);
alter table public.oauth_estados enable row level security;

-- Configuración de la ejecución automática (una por usuario)
create table if not exists public.ejecucion_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auto_ejecutar boolean not null default true,          -- las órdenes aprobadas que no requieren atención se envían solas
  auto_publicar boolean not null default false,         -- publicar sin pasar por «Aprobar y publicar»
  comprobar_preview boolean not null default true,      -- comprobar que la vista previa responde antes de pedir aprobación
  max_simultaneas smallint not null default 2,
  modo_max boolean not null default false,              -- Max mode de Lovable (2,5x créditos)
  aviso_creditos numeric not null default 20,           -- avisar si una ejecución consume más de N créditos
  actualizado_el timestamptz not null default now()
);
alter table public.ejecucion_config enable row level security;
drop policy if exists "ejecucion_config propia" on public.ejecucion_config;
create policy "ejecucion_config propia" on public.ejecucion_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$ begin
  create type public.estado_ejecucion as enum ('en_cola','enviando','construyendo','comprobando','esperando_aprobacion','publicando','completada','error','cancelada');
exception when duplicate_object then null; end $$;

create table if not exists public.ejecuciones_orden (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  orden_id uuid references public.ordenes(id) on delete set null,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  tarea_id uuid references public.tareas(id) on delete set null,
  estado public.estado_ejecucion not null default 'en_cola',
  modo text not null default 'construir',               -- construir | planificar
  texto text not null,
  mensaje_id text,
  thread_id text,
  commit_sha text,
  respuesta text,
  resumen text,
  coste_creditos numeric,
  preview_url text,
  preview_ok boolean,
  publicado_url text,
  error text,
  intentos smallint not null default 0,
  iniciada_el timestamptz,
  terminada_el timestamptz,
  aprobada_el timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists ejecuciones_orden_estado_idx on public.ejecuciones_orden(user_id, estado);
create index if not exists ejecuciones_orden_orden_idx on public.ejecuciones_orden(orden_id);
alter table public.ejecuciones_orden enable row level security;
drop policy if exists "ejecuciones propias" on public.ejecuciones_orden;
create policy "ejecuciones propias" on public.ejecuciones_orden for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.ordenes add column if not exists ejecucion_id uuid references public.ejecuciones_orden(id) on delete set null;
alter table public.ordenes add column if not exists ejecutar_con text not null default 'lovable';   -- lovable | manual

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.ejecuciones_orden;
exception when duplicate_object then null; end $$;

-- Secretos cifrados de la conexión Lovable
create or replace function public.guardar_secreto_lovable(p_user_id uuid, p_refresh text, p_acceso text, p_expira timestamptz)
returns boolean language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  if v_key is null or v_key = '' then raise exception 'No hay clave de cifrado configurada'; end if;
  update public.lovable_conexion set
    secreto_cifrado = case when p_refresh is null then secreto_cifrado when p_refresh = '' then null else encode(pgp_sym_encrypt(p_refresh, v_key),'base64') end,
    acceso_cifrado  = case when p_acceso  is null then acceso_cifrado  when p_acceso  = '' then null else encode(pgp_sym_encrypt(p_acceso,  v_key),'base64') end,
    expira_el = coalesce(p_expira, expira_el), actualizado_el = now()
  where user_id = p_user_id;
  if not found then raise exception 'Conexión no encontrada'; end if;
  return true;
end $$;

create or replace function public.leer_secretos_lovable(p_user_id uuid)
returns table(refresh_token text, access_token text, expira_el timestamptz, client_id text)
language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  return query select
    case when c.secreto_cifrado is null then null else pgp_sym_decrypt(decode(c.secreto_cifrado,'base64'), v_key) end,
    case when c.acceso_cifrado  is null then null else pgp_sym_decrypt(decode(c.acceso_cifrado,'base64'),  v_key) end,
    c.expira_el, c.client_id
  from public.lovable_conexion c where c.user_id = p_user_id;
end $$;
revoke all on function public.guardar_secreto_lovable(uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.leer_secretos_lovable(uuid) from public, anon, authenticated;

-- Lanzador programado (cada 2 minutos): envía las órdenes en cola y sondea las que están construyendo
create or replace function public.lanzar_ejecucion_ordenes()
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  if not exists (select 1 from public.ejecuciones_orden where estado in ('en_cola','enviando','construyendo','comprobando','publicando'))
     and not exists (select 1 from public.ordenes o join public.ejecucion_config c on c.user_id = o.user_id and c.auto_ejecutar
                     where o.estado = 'aprobada' and o.ejecucion_id is null and o.ejecutar_con = 'lovable' and coalesce(o.requiere_atencion,false) = false) then
    return;
  end if;
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/ordenes-ejecutar',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion','programado'));
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'ordenes-ejecutar';
select cron.schedule('ordenes-ejecutar', '*/2 * * * *', $$select public.lanzar_ejecucion_ordenes()$$);

-- Identificadores de proyecto en Lovable (workspace de Javier)
update public.proyectos p set lovable_project_id = v.id from (values
 ('hostelecor','76b4feb4-b8a7-482c-8521-aba7fbef204a'),('nexdeveloper','81a8f50b-39bc-47ac-8b9f-b3b0aa7f701d'),('movetoclass','8d794004-2b3e-4c9b-a4d8-fd24f83efa80'),
 ('qsvista','e6461670-e9b2-4d01-950c-983338aa2d57'),('proyectian','1b2d3c2b-8332-417b-b508-8873a511ff08'),('evoluteia','6461218c-b074-4ac0-80ad-9999c8cae4b0'),
 ('ofigesti','183bcca4-be33-4636-8864-107a506fc7dc'),('wabox','dd22ac13-1e81-4c37-af3a-2a866a1da315'),('pidemetu','e42833e9-d97e-4095-aafe-4b7e0949556f'),
 ('rastrelead','6bb6903b-3215-415d-a435-26b21d609f77'),('tallecar','be5343d4-059a-48e0-a80a-fd1de1ca8af1'),('nivelaconta','b01a1fa0-e1fb-4e17-b5d3-5f7bbc2bc192'),
 ('mioficonta','4defdb3a-f499-4510-83f5-d383350fe7f1'),('puntualink','0e7144f3-8fd1-4455-b95b-79d7771f9b79'),('gericentro','0c97919f-8af7-482c-8b7d-44221933d571'),
 ('micontafacil','23665dc1-1110-4234-8474-4ec3b025b606'),('konectian','8ed0a9ee-37a1-4579-b35f-b0e7c7fe8c9d'),('lotescam','f55ddfca-ffa7-4cc8-82f5-88cc0820a0a2'),
 ('agrogesti','174f85c1-107c-4295-89a6-e4e13c1bf52e'),('afiliacrm','03d22ce9-b998-46f6-b638-3eac9bca5ecc'),('ctacordoba','52f4a339-d0a3-46f2-9dc7-038564a8ac1a')
) as v(slug,id) where p.slug = v.slug;

-- 020b · Segundo motor de ejecución: Claude + GitHub (rama y solicitud de cambios), además de Lovable
alter table public.ejecuciones_orden
  add column if not exists motor text not null default 'lovable',      -- lovable | claude
  add column if not exists estado_agente jsonb,                        -- conversación y progreso del agente (reanudable)
  add column if not exists cambios jsonb,                              -- archivos modificados {ruta: contenido}
  add column if not exists rama text,
  add column if not exists pr_url text,
  add column if not exists pr_numero integer,
  add column if not exists pasos integer not null default 0,
  add column if not exists tokens_entrada integer not null default 0,
  add column if not exists tokens_salida integer not null default 0,
  add column if not exists coste_ia numeric not null default 0,
  add column if not exists comprobar_desde timestamptz;
alter table public.ejecucion_config
  add column if not exists motor_preferido text not null default 'auto',   -- auto | lovable | claude
  add column if not exists modelo_claude text not null default 'claude-sonnet-4-5',
  add column if not exists max_pasos smallint not null default 40,
  add column if not exists max_coste_ia numeric not null default 3;        -- € por orden con el motor Claude
