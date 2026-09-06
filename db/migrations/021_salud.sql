-- NexDeveloper · Migración 021 · Panel de salud de todos los Supabase + Sentry · v0.21.0

create table if not exists public.salud_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activo boolean not null default true,
  avisar_solo_rojo boolean not null default true,          -- tarea «Requiere tu atención» solo con semáforo rojo
  umbral_bd_mb numeric not null default 400,               -- ámbar por encima (plan gratuito 500 MB)
  umbral_bd_rojo_mb numeric not null default 480,
  umbral_errores_ambar integer not null default 5,         -- errores 5xx/BD en 24 h
  umbral_errores_rojo integer not null default 50,
  sentry_org text,                                          -- slug de la organización de Sentry (se detecta si está vacío)
  incluir_rendimiento boolean not null default true,
  actualizado_el timestamptz not null default now()
);
alter table public.salud_config enable row level security;
drop policy if exists "salud_config propia" on public.salud_config;
create policy "salud_config propia" on public.salud_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$ begin create type public.semaforo as enum ('verde','ambar','rojo','gris'); exception when duplicate_object then null; end $$;

create table if not exists public.salud_informes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origen text not null default 'programado',               -- programado | manual
  estado text not null default 'en_curso',                 -- en_curso | terminado | error
  total integer not null default 0,
  verdes integer not null default 0,
  ambar integer not null default 0,
  rojos integer not null default 0,
  grises integer not null default 0,
  resumen text,
  error text,
  iniciado_el timestamptz not null default now(),
  terminado_el timestamptz
);
alter table public.salud_informes enable row level security;
drop policy if exists "salud_informes propios" on public.salud_informes;
create policy "salud_informes propios" on public.salud_informes for select using (user_id = auth.uid());

create table if not exists public.salud_proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  informe_id uuid not null references public.salud_informes(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  supabase_ref text,
  nombre text,
  semaforo public.semaforo not null default 'gris',
  pendiente boolean not null default true,
  estado_supabase text,                                    -- ACTIVE_HEALTHY, INACTIVE (pausado), COMING_UP, ...
  servicios jsonb,                                         -- salud por servicio (auth, db, realtime, rest, storage)
  advisors_seguridad integer,
  advisors_rendimiento integer,
  advisors jsonb,                                          -- lista {nivel, nombre, titulo, detalle, url}
  tablas_sin_rls integer,
  tablas_sin_rls_lista text[],
  funciones_sin_search_path integer,
  errores_api_24h integer,
  errores_bd_24h integer,
  errores_funciones_24h integer,
  bd_mb numeric,
  usuarios integer,
  ultimo_acceso timestamptz,
  sentry_errores_24h integer,
  sentry_incidencias jsonb,                                -- {titulo, nivel, veces, url}
  motivos text[],                                          -- razones del semáforo, en español
  error text,
  comprobado_el timestamptz
);
create index if not exists salud_proyectos_informe_idx on public.salud_proyectos(informe_id);
alter table public.salud_proyectos enable row level security;
drop policy if exists "salud_proyectos propios" on public.salud_proyectos;
create policy "salud_proyectos propios" on public.salud_proyectos for select using (user_id = auth.uid());

alter table public.proyectos add column if not exists semaforo_salud public.semaforo;
alter table public.proyectos add column if not exists salud_comprobada_el timestamptz;
alter table public.proyectos add column if not exists sentry_slug text;               -- proyecto en Sentry (si difiere del slug)

do $$ begin
  alter publication supabase_realtime add table public.salud_informes;
  alter publication supabase_realtime add table public.salud_proyectos;
exception when duplicate_object then null; end $$;

-- Lanzador diario 05:00 UTC (07:00 en Madrid) y continuación por tandas
create or replace function public.lanzar_salud(p_accion text default 'programado', p_informe uuid default null)
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/salud',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion', p_accion, 'informe_id', p_informe));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'salud-diario';
select cron.schedule('salud-diario', '0 5 * * *', $$select public.lanzar_salud('programado')$$);
