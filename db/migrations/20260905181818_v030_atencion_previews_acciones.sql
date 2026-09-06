-- 0.3.0 · Tareas en dos bloques, vista previa verificable, acciones directas, integraciones ampliadas (aplicada desde Lovable)

-- Tareas: ¿requiere la atención/conformidad del usuario? + instrucciones claras
alter table public.tareas
  add column if not exists requiere_atencion boolean not null default false,
  add column if not exists instrucciones text,
  add column if not exists motivo_atencion text,
  add column if not exists atendida_el timestamptz;
create index if not exists idx_tareas_atencion on public.tareas(user_id, requiere_atencion) where estado not in ('completada','cancelada');

-- Órdenes: también se puede marcar al crearlas
alter table public.ordenes add column if not exists requiere_atencion boolean not null default false;

-- Vista previa verificable
alter table public.previews
  add column if not exists es_principal boolean not null default false,
  add column if not exists ultima_verificacion timestamptz,
  add column if not exists resultado_verificacion text check (resultado_verificacion in ('correcto','error','sin_verificar')) default 'sin_verificar',
  add column if not exists detalle_verificacion text,
  add column if not exists captura_path text,
  add column if not exists posicion jsonb not null default '{}';

-- Integraciones: dar de alta cualquier proveedor desde la app
alter table public.integraciones
  add column if not exists url_panel text,
  add column if not exists url_docs text,
  add column if not exists descripcion text,
  add column if not exists icono text,
  add column if not exists es_predefinida boolean not null default false,
  add column if not exists capacidades text[] not null default '{}';
update public.integraciones set es_predefinida = true where codigo in ('supabase','github','anthropic','openai','google','lovable','canva');

-- Acciones directas (Supabase / GitHub / otras) lanzadas desde una tarea o proyecto
create type public.tipo_accion as enum
  ('supabase_sql','supabase_migracion','supabase_listar_tablas','supabase_secreto','github_crear_repo','github_subir_archivo','github_crear_issue','github_listar_ramas','http_generica');
create type public.estado_accion as enum ('borrador','pendiente_aprobacion','aprobada','ejecutando','completada','error','cancelada');

create table public.acciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  tarea_id uuid references public.tareas(id) on delete set null,
  integracion_id uuid references public.integraciones(id) on delete set null,
  tipo tipo_accion not null,
  titulo text not null,
  parametros jsonb not null default '{}',          -- p. ej. {"project_ref":"...","sql":"..."} / {"repo":"...","ruta":"...","contenido":"..."}
  requiere_aprobacion boolean not null default true,
  estado estado_accion not null default 'pendiente_aprobacion',
  resultado jsonb,
  error text,
  aprobada_el timestamptz,
  aprobada_por text,
  ejecutada_el timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
alter table public.acciones enable row level security;
create policy "acciones propias" on public.acciones for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_acciones_actualizado before update on public.acciones for each row execute function public.set_actualizado_el();
create index idx_acciones_proyecto on public.acciones(proyecto_id, estado);
alter publication supabase_realtime add table public.acciones;

-- Plantillas de acciones (lo que Claude suele pedir), para que sea sencillo
create table public.plantillas_accion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo tipo_accion not null,
  nombre text not null,
  descripcion text,
  parametros_por_defecto jsonb not null default '{}',
  requiere_aprobacion boolean not null default true,
  orden integer not null default 0
);
alter table public.plantillas_accion enable row level security;
create policy "plantillas propias" on public.plantillas_accion for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Siembra de plantillas para el usuario actual y para los nuevos
create or replace function public.sembrar_plantillas_accion(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.plantillas_accion (user_id, tipo, nombre, descripcion, parametros_por_defecto, requiere_aprobacion, orden) values
    (p_user, 'supabase_migracion', 'Aplicar migración SQL en Supabase', 'Ejecuta un bloque SQL como migración en el proyecto de Supabase indicado.', '{"project_ref":"","nombre":"","sql":""}', true, 1),
    (p_user, 'supabase_sql', 'Consulta SQL de solo lectura', 'Lanza una consulta SELECT y devuelve el resultado.', '{"project_ref":"","sql":"select now();"}', false, 2),
    (p_user, 'supabase_listar_tablas', 'Listar tablas del proyecto', 'Devuelve las tablas del esquema public.', '{"project_ref":""}', false, 3),
    (p_user, 'supabase_secreto', 'Guardar secreto en Edge Functions', 'Crea o actualiza un secreto (el valor se pide en el momento y no se guarda).', '{"project_ref":"","nombre":""}', true, 4),
    (p_user, 'github_crear_repo', 'Crear repositorio privado', 'Crea un repositorio privado en la cuenta de GitHub conectada.', '{"nombre":"","descripcion":""}', true, 5),
    (p_user, 'github_subir_archivo', 'Subir o actualizar un archivo', 'Escribe un archivo en una rama del repositorio.', '{"repo":"","rama":"main","ruta":"","contenido":"","mensaje":""}', true, 6),
    (p_user, 'github_crear_issue', 'Crear incidencia en GitHub', 'Abre una issue en el repositorio.', '{"repo":"","titulo":"","cuerpo":""}', false, 7),
    (p_user, 'github_listar_ramas', 'Listar ramas', 'Devuelve las ramas del repositorio.', '{"repo":""}', false, 8)
  on conflict do nothing;
end $$;
revoke execute on function public.sembrar_plantillas_accion(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre_completo, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  insert into public.ajustes (user_id) values (new.id) on conflict (user_id) do nothing;
  perform public.sembrar_catalogos(new.id);
  perform public.sembrar_plantillas_accion(new.id);
  return new;
end $$;

do $$ declare u record; begin
  for u in select id from auth.users loop perform public.sembrar_plantillas_accion(u.id); end loop;
end $$;

-- Vista: tareas agrupadas por atención
create or replace view public.v_tareas_atencion with (security_invoker = true) as
select t.*, p.nombre as proyecto_nombre, a.nombre as agente_nombre,
  case when t.requiere_atencion then 'requiere_atencion' else 'desatendida' end as bloque
from public.tareas t
join public.proyectos p on p.id = t.proyecto_id
left join public.agentes a on a.id = t.agente_id
where t.estado not in ('completada','cancelada');

update public.configuracion_app set valor = '0.3.0', actualizado_el = now() where clave = 'version_app';
