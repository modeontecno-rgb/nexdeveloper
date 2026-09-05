/** SQL que hay que ejecutar una sola vez en la base de datos para habilitar acciones reales,
 *  el bloque «requiere tu atención» y las vistas previas incrustadas. */
export const SQL_ACCIONES_Y_ATENCION = `-- NexDeveloper · acciones reales, atención y vistas previas
create type tipo_accion as enum (
  'supabase_sql','supabase_migracion','supabase_listar_tablas','supabase_secreto',
  'github_crear_repo','github_subir_archivo','github_crear_issue','github_listar_ramas','http_generica');

create type estado_accion as enum (
  'borrador','pendiente_aprobacion','aprobada','ejecutando','completada','error','cancelada');

alter table public.tareas
  add column if not exists requiere_atencion boolean not null default false,
  add column if not exists instrucciones text,
  add column if not exists motivo_atencion text,
  add column if not exists atendida_el timestamptz;

alter table public.ordenes
  add column if not exists requiere_atencion boolean not null default false;

alter table public.previews
  add column if not exists es_principal boolean not null default false,
  add column if not exists ultima_verificacion timestamptz,
  add column if not exists resultado_verificacion text not null default 'sin_verificar',
  add column if not exists detalle_verificacion text,
  add column if not exists captura_path text,
  add column if not exists posicion jsonb;

alter table public.integraciones
  add column if not exists url_panel text,
  add column if not exists url_docs text,
  add column if not exists descripcion text,
  add column if not exists icono text,
  add column if not exists es_predefinida boolean not null default false,
  add column if not exists capacidades text[] default '{}';

create table if not exists public.integracion_proyectos (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  integracion_id uuid not null references public.integraciones(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  permisos text[] not null default '{}',
  primary key (integracion_id, proyecto_id));

grant select, insert, update, delete on public.integracion_proyectos to authenticated;
grant all on public.integracion_proyectos to service_role;
alter table public.integracion_proyectos enable row level security;
create policy "propias" on public.integracion_proyectos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.acciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  tarea_id uuid references public.tareas(id) on delete set null,
  integracion_id uuid references public.integraciones(id) on delete set null,
  tipo tipo_accion not null,
  titulo text not null,
  parametros jsonb not null default '{}',
  requiere_aprobacion boolean not null default true,
  estado estado_accion not null default 'borrador',
  resultado jsonb,
  error text,
  aprobada_el timestamptz,
  aprobada_por text,
  ejecutada_el timestamptz,
  creado_el timestamptz not null default now());

grant select, insert, update, delete on public.acciones to authenticated;
grant all on public.acciones to service_role;
alter table public.acciones enable row level security;
create policy "propias" on public.acciones for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.plantillas_accion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo tipo_accion not null,
  nombre text not null,
  descripcion text,
  parametros_por_defecto jsonb not null default '{}',
  requiere_aprobacion boolean not null default true,
  orden integer not null default 0);

grant select, insert, update, delete on public.plantillas_accion to authenticated;
grant all on public.plantillas_accion to service_role;
alter table public.plantillas_accion enable row level security;
create policy "propias" on public.plantillas_accion for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace view public.v_tareas_atencion as
  select t.id, t.proyecto_id, p.nombre as proyecto_nombre, a.nombre as agente_nombre,
         t.titulo, t.descripcion, t.estado, t.prioridad, t.agente_id,
         t.requiere_atencion, t.instrucciones, t.motivo_atencion, t.atendida_el,
         case when t.requiere_atencion then 'requiere_atencion' else 'desatendida' end as bloque,
         t.estimacion_horas, t.horas_consumidas, t.coste_estimado, t.coste_consumido,
         t.progreso, t.ultima_actividad
    from public.tareas t
    left join public.proyectos p on p.id = t.proyecto_id
    left join public.agentes a on a.id = t.agente_id
   where t.estado not in ('completada','cancelada');

grant select on public.v_tareas_atencion to authenticated;
`;
