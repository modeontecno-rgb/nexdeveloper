-- NexDeveloper · Migración 030 · Control total de infraestructura · v0.30.0
-- Inventario de servicios, mapa de dependencias por proyecto y módulo, comprobación continua (cada 10 min),
-- incidencias con proyectos afectados, y sincronización GitHub ↔ Supabase ↔ Mac por proyecto (cada hora).

create table if not exists public.infra_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activo boolean not null default true,
  intervalo_min integer not null default 10,                -- comprobación de servicios
  sincronizar_cada_h integer not null default 1,            -- sincronización repos/Supabase
  umbral_lento_ms integer not null default 3000,
  fallos_para_rojo smallint not null default 2,             -- fallos seguidos antes de abrir incidencia
  avisar_push boolean not null default true,
  crear_tareas boolean not null default true,
  dias_sin_commit_ambar integer not null default 30,
  resolver_dns text not null default 'https://dns.google/resolve',
  actualizado_el timestamptz not null default now()
);
alter table public.infra_config enable row level security;
drop policy if exists "infra_config propia" on public.infra_config;
create policy "infra_config propia" on public.infra_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Inventario de servicios (crece con cada contratación: servidores, DNS, APIs, almacenes...)
create table if not exists public.infra_servicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'http',                        -- supabase | github | lovable | dns | http | tcp | s3 | funcion | proveedor_ia | sentry | proyectian | servidor | correo | otro
  proveedor text,                                           -- Supabase, GitHub, Lovable, Hetzner, IONOS, Cloudflare...
  url text,                                                 -- URL o host a comprobar
  referencia text,                                          -- ref de Supabase, repositorio, nombre de función...
  metodo jsonb not null default '{}'::jsonb,                -- parámetros de la comprobación {esperado, puerto, tipo_dns, servicios...}
  ambito text not null default 'proyecto',                  -- global (afecta a todo) | proyecto
  critico boolean not null default true,
  activo boolean not null default true,
  origen text not null default 'manual',                    -- manual | descubierto
  clave_descubrimiento text,                                -- para no duplicar al redescubrir
  estado public.semaforo not null default 'gris',
  fallos_seguidos integer not null default 0,
  ultimo_ms integer,
  ultimo_detalle text,
  ultimo_error text,
  comprobado_el timestamptz,
  ultimo_verde_el timestamptz,
  coste_mensual numeric,
  renovacion_el date,                                       -- caducidad del contrato/servidor (aviso 30 días antes)
  notas text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create unique index if not exists infra_servicios_desc_uidx on public.infra_servicios(user_id, clave_descubrimiento) where clave_descubrimiento is not null;
alter table public.infra_servicios enable row level security;
drop policy if exists "infra_servicios propios" on public.infra_servicios;
create policy "infra_servicios propios" on public.infra_servicios for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Qué proyectos y módulos dependen de cada servicio
create table if not exists public.infra_dependencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  servicio_id uuid not null references public.infra_servicios(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  modulos text[] not null default '{}',                     -- p. ej. {"Acceso de usuarios","Base de datos","Archivos"}
  critica boolean not null default true,                    -- si cae, el proyecto no funciona
  creado_el timestamptz not null default now(),
  unique (servicio_id, proyecto_id)
);
alter table public.infra_dependencias enable row level security;
drop policy if exists "infra_dependencias propias" on public.infra_dependencias;
create policy "infra_dependencias propias" on public.infra_dependencias for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Histórico de comprobaciones (se conservan 30 días)
create table if not exists public.infra_comprobaciones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  servicio_id uuid not null references public.infra_servicios(id) on delete cascade,
  estado public.semaforo not null,
  ms integer,
  detalle text,
  error text,
  comprobado_el timestamptz not null default now()
);
create index if not exists infra_comprobaciones_serv_idx on public.infra_comprobaciones(servicio_id, comprobado_el desc);
alter table public.infra_comprobaciones enable row level security;
drop policy if exists "infra_comprobaciones propias" on public.infra_comprobaciones;
create policy "infra_comprobaciones propias" on public.infra_comprobaciones for select using (user_id = auth.uid());

-- Incidencias: se abren al caer un servicio y se cierran al recuperarse
create table if not exists public.infra_incidencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  servicio_id uuid not null references public.infra_servicios(id) on delete cascade,
  estado text not null default 'abierta',                   -- abierta | resuelta | ignorada
  titulo text not null,
  detalle text,
  proyectos_afectados jsonb not null default '[]'::jsonb,   -- [{proyecto_id, nombre, modulos[], critica}]
  afecta_todo boolean not null default false,
  tarea_id uuid references public.tareas(id) on delete set null,
  abierta_el timestamptz not null default now(),
  resuelta_el timestamptz,
  duracion_min integer,
  notas text
);
create index if not exists infra_incidencias_estado_idx on public.infra_incidencias(user_id, estado, abierta_el desc);
alter table public.infra_incidencias enable row level security;
drop policy if exists "infra_incidencias propias" on public.infra_incidencias;
create policy "infra_incidencias propias" on public.infra_incidencias for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sincronización por proyecto: GitHub ↔ Supabase ↔ copia del Mac
create table if not exists public.infra_sincronizacion (
  proyecto_id uuid primary key references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  semaforo public.semaforo not null default 'gris',
  motivos text[] not null default '{}',
  github_rama text,
  github_sha text,
  github_fecha timestamptz,
  github_autor text,
  commits_7d integer,
  version_repo text,                                        -- package.json del repositorio
  version_app text,                                         -- proyectos.version_actual
  migraciones_repo integer,
  migraciones_aplicadas integer,
  migraciones_pendientes text[] not null default '{}',      -- en el repo y no aplicadas
  migraciones_sin_repo text[] not null default '{}',        -- aplicadas y no en el repo
  funciones_repo text[] not null default '{}',
  funciones_desplegadas text[] not null default '{}',
  funciones_sin_desplegar text[] not null default '{}',
  funciones_sin_repo text[] not null default '{}',
  mac_sha text,                                             -- lo informa el Mac (acción reportar_mac)
  mac_fecha timestamptz,
  mac_reportado_el timestamptz,
  error text,
  comprobado_el timestamptz
);
alter table public.infra_sincronizacion enable row level security;
drop policy if exists "infra_sincronizacion propia" on public.infra_sincronizacion;
create policy "infra_sincronizacion propia" on public.infra_sincronizacion for select using (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.infra_servicios;
  alter publication supabase_realtime add table public.infra_incidencias;
  alter publication supabase_realtime add table public.infra_sincronizacion;
exception when duplicate_object then null; end $$;

alter table public.proyectos add column if not exists semaforo_infra public.semaforo;
alter table public.proyectos add column if not exists semaforo_sincronizacion public.semaforo;

create or replace function public.lanzar_infraestructura(p_accion text default 'programado')
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/infraestructura', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'infra-comprobar';
select cron.schedule('infra-comprobar', '*/10 * * * *', $$select public.lanzar_infraestructura('programado')$$);
select cron.unschedule(jobid) from cron.job where jobname = 'infra-sincronizar';
select cron.schedule('infra-sincronizar', '20 * * * *', $$select public.lanzar_infraestructura('sincronizar_programado')$$);
select cron.unschedule(jobid) from cron.job where jobname = 'infra-limpiar';
select cron.schedule('infra-limpiar', '45 3 * * *', $$delete from public.infra_comprobaciones where comprobado_el < now() - interval '30 days'$$);
