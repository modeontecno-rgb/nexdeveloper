-- NexDeveloper · Migración 027 · Gestión de usuarios y accesos de los clientes en todos los Supabase · v0.27.0

create table if not exists public.usuarios_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  supabase_ref text not null,
  auth_id uuid not null,
  email text,
  telefono text,
  nombre text,
  rol text,                                  -- de app_metadata/user_metadata si existe
  confirmado boolean,
  bloqueado boolean not null default false,
  bloqueado_hasta timestamptz,
  proveedor text,                             -- email, google…
  creado_en_app timestamptz,
  ultimo_acceso timestamptz,
  metadatos jsonb,
  sincronizado_el timestamptz not null default now(),
  unique (supabase_ref, auth_id)
);
create index if not exists usuarios_clientes_proyecto_idx on public.usuarios_clientes(proyecto_id);
create index if not exists usuarios_clientes_email_idx on public.usuarios_clientes(user_id, lower(email));
alter table public.usuarios_clientes enable row level security;
drop policy if exists "usuarios_clientes propios" on public.usuarios_clientes;
create policy "usuarios_clientes propios" on public.usuarios_clientes for select using (user_id = auth.uid());

create table if not exists public.usuarios_acciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  supabase_ref text,
  accion text not null,                       -- crear | resetear | bloquear | desbloquear | borrar | invitar | sincronizar | actualizar
  email text,
  auth_id uuid,
  resultado text not null default 'ok',       -- ok | error
  detalle text,
  proyectian boolean,                          -- si se reflejó en Proyectian
  creado_el timestamptz not null default now()
);
alter table public.usuarios_acciones enable row level security;
drop policy if exists "usuarios_acciones propias" on public.usuarios_acciones;
create policy "usuarios_acciones propias" on public.usuarios_acciones for select using (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.usuarios_clientes; exception when duplicate_object then null; end $$;

create or replace function public.lanzar_usuarios_clientes(p_accion text default 'programado')
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/usuarios-clientes', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'usuarios-clientes-diario';
select cron.schedule('usuarios-clientes-diario', '15 5 * * *', $$select public.lanzar_usuarios_clientes('programado')$$);
