-- 008_repositorios.sql
-- Repositorios de GitHub por proyecto e historial de subidas.
-- Este guion es repetible: se puede ejecutar varias veces sin romper nada.

/* --------------------------------- Tipos ---------------------------------- */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_repositorio') then
    create type estado_repositorio as enum ('pendiente', 'creado', 'con_codigo', 'error');
  end if;
  if not exists (select 1 from pg_type where typname = 'origen_codigo_repositorio') then
    create type origen_codigo_repositorio as enum ('vacio', 'carpeta_subida', 'lovable', 'externo');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_subida_repositorio') then
    create type estado_subida_repositorio as enum ('subiendo', 'ok', 'error');
  end if;
end
$$;

/* ------------------------------ Repositorios ------------------------------- */

create table if not exists public.repositorios (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id      uuid not null references public.proyectos(id) on delete cascade,
  nombre_completo  text not null,
  url              text not null default '',
  privado          boolean not null default true,
  rama_por_defecto text not null default 'main',
  estado           estado_repositorio not null default 'pendiente',
  origen_codigo    origen_codigo_repositorio not null default 'vacio',
  ultimo_commit_sha text,
  ultimo_push_el   timestamptz,
  error            text,
  creado_el        timestamptz not null default now()
);

create unique index if not exists repositorios_proyecto_idx on public.repositorios (proyecto_id);
create index if not exists repositorios_user_idx on public.repositorios (user_id, creado_el desc);

grant select, insert, update, delete on public.repositorios to authenticated;
grant all on public.repositorios to service_role;

alter table public.repositorios enable row level security;
drop policy if exists "repositorios propios" on public.repositorios;
create policy "repositorios propios" on public.repositorios
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

/* --------------------------- Historial de subidas -------------------------- */

create table if not exists public.repositorio_subidas (
  id              uuid primary key default gen_random_uuid(),
  repositorio_id  uuid not null references public.repositorios(id) on delete cascade,
  archivos        integer not null default 0,
  bytes           bigint not null default 0,
  commit_sha      text,
  mensaje         text not null default '',
  estado          estado_subida_repositorio not null default 'subiendo',
  detalle         text,
  creado_el       timestamptz not null default now()
);

create index if not exists repositorio_subidas_repo_idx on public.repositorio_subidas (repositorio_id, creado_el desc);

grant select, insert, update, delete on public.repositorio_subidas to authenticated;
grant all on public.repositorio_subidas to service_role;

alter table public.repositorio_subidas enable row level security;
drop policy if exists "subidas propias" on public.repositorio_subidas;
create policy "subidas propias" on public.repositorio_subidas
  for all to authenticated
  using (exists (select 1 from public.repositorios r where r.id = repositorio_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.repositorios r where r.id = repositorio_id and r.user_id = auth.uid()));

/* ------- Al crear el repositorio, rellenar proyectos.repositorio ----------- */

create or replace function public.sincronizar_repositorio_proyecto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.proyectos
  set repositorio = new.nombre_completo
  where id = new.proyecto_id
    and (repositorio is null or btrim(repositorio) = '');
  return new;
end
$$;

drop trigger if exists repositorios_sincronizar on public.repositorios;
create trigger repositorios_sincronizar
  after insert or update of nombre_completo on public.repositorios
  for each row execute function public.sincronizar_repositorio_proyecto();
