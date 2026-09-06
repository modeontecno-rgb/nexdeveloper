-- NexDeveloper · Migración 028 · Modo cliente: portal de solo lectura por proyecto · v0.28.0

create table if not exists public.portales_cliente (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  token text not null unique,
  nombre_cliente text,
  contacto_email text,
  marca jsonb not null default '{}'::jsonb,            -- {nombre, color, logo_url, powered_by, mensaje_bienvenida}
  secciones jsonb not null default '{"version":true,"cambios":true,"documentos":true,"peticiones":true,"estado":true,"contacto":true}'::jsonb,
  activo boolean not null default true,
  expira_el timestamptz,
  visitas integer not null default 0,
  ultimo_acceso timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists portales_cliente_proyecto_idx on public.portales_cliente(proyecto_id);
alter table public.portales_cliente enable row level security;
drop policy if exists "portales propios" on public.portales_cliente;
create policy "portales propios" on public.portales_cliente for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.portal_peticiones (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.portales_cliente(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  texto text not null,
  contacto text,
  tipo text not null default 'peticion',               -- peticion | incidencia | pregunta
  estado text not null default 'nueva',                -- nueva | vista | en_curso | hecha | descartada
  respuesta text,
  respondida_el timestamptz,
  tarea_id uuid references public.tareas(id) on delete set null,
  creado_el timestamptz not null default now()
);
create index if not exists portal_peticiones_portal_idx on public.portal_peticiones(portal_id, creado_el desc);
alter table public.portal_peticiones enable row level security;
drop policy if exists "peticiones propias" on public.portal_peticiones;
create policy "peticiones propias" on public.portal_peticiones for all using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.portal_peticiones; exception when duplicate_object then null; end $$;
