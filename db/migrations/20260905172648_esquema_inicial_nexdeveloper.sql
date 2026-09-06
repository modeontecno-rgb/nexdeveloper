-- NexDeveloper · Esquema inicial
-- Todas las tablas de negocio llevan user_id (por defecto auth.uid()) y RLS por propietario.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------
create type public.estado_proyecto as enum
  ('pendiente','planificando','en_cola','ejecutando','esperando_revision','bloqueado','completado');
create type public.estado_tarea as enum
  ('pendiente','en_cola','ejecutando','esperando_revision','bloqueada','completada','cancelada','pausada');
create type public.prioridad as enum ('baja','media','alta','critica');
create type public.modo_ejecucion as enum ('economico','equilibrado','maxima_calidad');
create type public.estado_orden as enum
  ('borrador','pendiente_aprobacion','aprobada','rechazada','en_cola','ejecutando','completada','cancelada');
create type public.nivel_alerta as enum ('info','aviso','critico');
create type public.tipo_actividad as enum
  ('orden','resultado','decision','cambio','actividad','reorganizacion','aprobacion','sistema');
create type public.autor_mensaje as enum ('usuario','agente','sistema');
create type public.rol_agente as enum ('planificar','ejecutar','revisar');
create type public.entorno as enum ('desarrollo','pruebas','produccion');

-- ---------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------
create or replace function public.set_actualizado_el()
returns trigger language plpgsql as $$
begin
  new.actualizado_el = now();
  return new;
end $$;

-- ---------------------------------------------------------------
-- Perfiles (extiende auth.users)
-- ---------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text,
  email text,
  avatar_url text,
  tema text not null default 'oscuro' check (tema in ('claro','oscuro','sistema')),
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
alter table public.perfiles enable row level security;
create policy "perfil propio: leer" on public.perfiles for select to authenticated using (id = auth.uid());
create policy "perfil propio: editar" on public.perfiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger trg_perfiles_actualizado before update on public.perfiles for each row execute function public.set_actualizado_el();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre_completo, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  insert into public.ajustes (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------
-- Ajustes por usuario (umbrales de aprobación y reorganización)
-- ---------------------------------------------------------------
create table public.ajustes (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  umbral_aprobacion_eur numeric(10,2) not null default 150,
  aprobar_si_prioridad_critica boolean not null default true,
  aprobar_si_riesgo_alto boolean not null default true,
  umbral_confianza_reorganizacion numeric(4,3) not null default 0.850,
  reorganizacion_automatica boolean not null default true,
  mesa_expertos_solo_importantes boolean not null default true,
  moneda text not null default 'EUR',
  actualizado_el timestamptz not null default now()
);
alter table public.ajustes enable row level security;
create policy "ajustes propios" on public.ajustes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_ajustes_actualizado before update on public.ajustes for each row execute function public.set_actualizado_el();

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Agentes (catálogo configurable por usuario)
-- ---------------------------------------------------------------
create table public.agentes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo text not null,                       -- claude, chatgpt, gemini, lovable, canva, nano_banana
  nombre text not null,
  proveedor text,
  especialidades text[] not null default '{}',
  coste_relativo smallint not null default 3 check (coste_relativo between 1 and 5),
  calidad smallint not null default 80 check (calidad between 0 and 100),
  rapidez smallint not null default 80 check (rapidez between 0 and 100),
  seguridad smallint not null default 80 check (seguridad between 0 and 100),
  disponibilidad text not null default 'sin_configurar' check (disponibilidad in ('disponible','ocupado','sin_configurar')),
  capacidad smallint not null default 4,
  permisos text[] not null default '{}',
  roles rol_agente[] not null default '{planificar,ejecutar,revisar}',
  conectado boolean not null default false,
  activo boolean not null default true,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),
  unique (user_id, codigo)
);
alter table public.agentes enable row level security;
create policy "agentes propios" on public.agentes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_agentes_actualizado before update on public.agentes for each row execute function public.set_actualizado_el();

-- ---------------------------------------------------------------
-- Proyectos
-- ---------------------------------------------------------------
create table public.proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug text not null,
  nombre text not null,
  descripcion text,
  objetivo text,
  requisitos text,
  tecnologias text,
  estado estado_proyecto not null default 'pendiente',
  prioridad prioridad not null default 'media',
  repositorio text,                            -- p. ej. modeontecno-rgb/nexdeveloper
  espacio_trabajo_url text,
  color text,
  es_favorito boolean not null default false,
  orden integer not null default 0,
  resumen_automatico text,
  resumen_actualizado_el timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),
  unique (user_id, slug)
);
alter table public.proyectos enable row level security;
create policy "proyectos propios" on public.proyectos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_proyectos_actualizado before update on public.proyectos for each row execute function public.set_actualizado_el();
create index idx_proyectos_user on public.proyectos(user_id, estado);

create table public.proyecto_agentes (
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  agente_id uuid not null references public.agentes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rol rol_agente not null default 'ejecutar',
  primary key (proyecto_id, agente_id, rol)
);
alter table public.proyecto_agentes enable row level security;
create policy "proyecto_agentes propios" on public.proyecto_agentes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- Presupuestos y estimaciones
-- ---------------------------------------------------------------
create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  concepto text not null default 'Presupuesto general',
  importe_previsto numeric(12,2) not null default 0,
  importe_consumido numeric(12,2) not null default 0,
  moneda text not null default 'EUR',
  periodo text,                                -- p. ej. 2026-09 o 'total'
  notas text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
alter table public.presupuestos enable row level security;
create policy "presupuestos propios" on public.presupuestos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_presupuestos_actualizado before update on public.presupuestos for each row execute function public.set_actualizado_el();
create index idx_presupuestos_proyecto on public.presupuestos(proyecto_id);

-- ---------------------------------------------------------------
-- Chats y mensajes (siempre dentro de un proyecto; proyecto_id null = Sin clasificar)
-- ---------------------------------------------------------------
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  titulo text not null default 'Chat del proyecto',
  es_principal boolean not null default false,
  proyecto_origen_id uuid references public.proyectos(id) on delete set null,
  reorganizado_el timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
alter table public.chats enable row level security;
create policy "chats propios" on public.chats for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_chats_actualizado before update on public.chats for each row execute function public.set_actualizado_el();
create index idx_chats_proyecto on public.chats(proyecto_id);

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  autor autor_mensaje not null default 'usuario',
  agente_id uuid references public.agentes(id) on delete set null,
  texto text not null,
  adjuntos jsonb not null default '[]',
  tokens_entrada integer,
  tokens_salida integer,
  coste numeric(10,4),
  fecha timestamptz not null default now()
);
alter table public.mensajes enable row level security;
create policy "mensajes propios" on public.mensajes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index idx_mensajes_chat on public.mensajes(chat_id, fecha);
create index idx_mensajes_proyecto on public.mensajes(proyecto_id, fecha);

-- ---------------------------------------------------------------
-- Órdenes (lo que el usuario pide; pasa por aprobación si procede)
-- ---------------------------------------------------------------
create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,   -- null = Sin clasificar
  chat_id uuid references public.chats(id) on delete set null,
  texto text not null,
  modo modo_ejecucion not null default 'equilibrado',
  prioridad prioridad not null default 'media',
  agente_id uuid references public.agentes(id) on delete set null,
  equipo uuid[] not null default '{}',
  estado estado_orden not null default 'pendiente_aprobacion',
  coste_estimado numeric(12,2) not null default 0,
  horas_estimadas numeric(8,2) not null default 0,
  riesgo text not null default 'Medio' check (riesgo in ('Bajo','Medio','Alto')),
  calidad_prevista smallint check (calidad_prevista between 0 and 100),
  requiere_aprobacion boolean not null default false,
  motivo_aprobacion text,
  resuelta_el timestamptz,
  resuelta_por text,
  comentario text,
  -- organización inteligente
  proyecto_origen_id uuid references public.proyectos(id) on delete set null,
  confianza_clasificacion numeric(4,3),
  reorganizada_el timestamptz,
  pendiente_confirmar_proyecto boolean not null default false,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
alter table public.ordenes enable row level security;
create policy "ordenes propias" on public.ordenes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_ordenes_actualizado before update on public.ordenes for each row execute function public.set_actualizado_el();
create index idx_ordenes_proyecto on public.ordenes(proyecto_id, estado);

-- ---------------------------------------------------------------
-- Tareas y subtareas (plan de trabajo)
-- ---------------------------------------------------------------
create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  orden_id uuid references public.ordenes(id) on delete set null,
  tarea_padre_id uuid references public.tareas(id) on delete cascade,
  titulo text not null,
  descripcion text,
  estado estado_tarea not null default 'pendiente',
  prioridad prioridad not null default 'media',
  agente_id uuid references public.agentes(id) on delete set null,
  enviada_el timestamptz not null default now(),
  estimacion_horas numeric(8,2) not null default 0,
  horas_consumidas numeric(8,2) not null default 0,
  coste_estimado numeric(12,2) not null default 0,
  coste_consumido numeric(12,2) not null default 0,
  progreso smallint not null default 0 check (progreso between 0 and 100),
  completada_por text,
  completada_el timestamptz,
  bloqueada_motivo text,
  ultima_actividad timestamptz not null default now(),
  proyecto_origen_id uuid references public.proyectos(id) on delete set null,
  orden integer not null default 0,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
alter table public.tareas enable row level security;
create policy "tareas propias" on public.tareas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_tareas_actualizado before update on public.tareas for each row execute function public.set_actualizado_el();
create index idx_tareas_proyecto on public.tareas(proyecto_id, estado);
create index idx_tareas_agente on public.tareas(agente_id) where estado in ('en_cola','ejecutando');

-- Al completar una tarea se guarda quién y cuándo
create or replace function public.tarea_completada()
returns trigger language plpgsql as $$
begin
  if new.estado = 'completada' and (old.estado is distinct from 'completada') then
    new.progreso := 100;
    new.completada_el := coalesce(new.completada_el, now());
    new.completada_por := coalesce(new.completada_por, (select coalesce(nombre_completo, email) from public.perfiles where id = auth.uid()));
    new.horas_consumidas := greatest(new.horas_consumidas, new.estimacion_horas);
  end if;
  new.ultima_actividad := now();
  return new;
end $$;
create trigger trg_tareas_completada before update on public.tareas for each row execute function public.tarea_completada();

-- Estimaciones históricas (para aprender por agente)
create table public.estimaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  tarea_id uuid references public.tareas(id) on delete cascade,
  orden_id uuid references public.ordenes(id) on delete cascade,
  agente_id uuid references public.agentes(id) on delete set null,
  modo modo_ejecucion not null default 'equilibrado',
  horas_estimadas numeric(8,2) not null default 0,
  coste_estimado numeric(12,2) not null default 0,
  calidad_prevista smallint,
  riesgo text check (riesgo in ('Bajo','Medio','Alto')),
  horas_reales numeric(8,2),
  coste_real numeric(12,2),
  calidad_real smallint,
  creado_el timestamptz not null default now()
);
alter table public.estimaciones enable row level security;
create policy "estimaciones propias" on public.estimaciones for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index idx_estimaciones_agente on public.estimaciones(agente_id);

-- ---------------------------------------------------------------
-- Actividad (línea temporal)
-- ---------------------------------------------------------------
create table public.actividad (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  tipo tipo_actividad not null default 'actividad',
  texto text not null,
  referencia_tabla text,
  referencia_id uuid,
  agente_id uuid references public.agentes(id) on delete set null,
  datos jsonb not null default '{}',
  fecha timestamptz not null default now()
);
alter table public.actividad enable row level security;
create policy "actividad propia" on public.actividad for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index idx_actividad_proyecto on public.actividad(proyecto_id, fecha desc);

-- ---------------------------------------------------------------
-- Alertas y decisiones pendientes
-- ---------------------------------------------------------------
create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  texto text not null,
  nivel nivel_alerta not null default 'info',
  requiere_decision boolean not null default false,
  resuelta boolean not null default false,
  resuelta_el timestamptz,
  referencia_tabla text,
  referencia_id uuid,
  creado_el timestamptz not null default now()
);
alter table public.alertas enable row level security;
create policy "alertas propias" on public.alertas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index idx_alertas_user on public.alertas(user_id) where resuelta = false;

-- ---------------------------------------------------------------
-- Integraciones y referencias a credenciales (NUNCA valores en claro)
-- ---------------------------------------------------------------
create table public.integraciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo text not null,                        -- supabase, github, anthropic, openai, google, lovable, canva
  nombre text not null,
  tipo text not null check (tipo in ('codigo','modelo','diseno','datos','despliegue','otro')),
  conectada boolean not null default false,
  requiere_aprobacion boolean not null default true,
  cuenta text,                                 -- identificador visible (usuario/organización), sin secretos
  configuracion jsonb not null default '{}',   -- solo datos no sensibles
  ultima_comprobacion timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),
  unique (user_id, codigo)
);
alter table public.integraciones enable row level security;
create policy "integraciones propias" on public.integraciones for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_integraciones_actualizado before update on public.integraciones for each row execute function public.set_actualizado_el();

create table public.integracion_proyectos (
  integracion_id uuid not null references public.integraciones(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  permisos text[] not null default '{}',
  primary key (integracion_id, proyecto_id)
);
alter table public.integracion_proyectos enable row level security;
create policy "integracion_proyectos propios" on public.integracion_proyectos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.credenciales_ref (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  integracion_id uuid references public.integraciones(id) on delete cascade,
  referencia text not null,                    -- nombre del secreto, p. ej. ANTHROPIC_API_KEY
  ubicacion text not null default 'vault' check (ubicacion in ('vault','supabase_secret','externo')),
  configurado boolean not null default false,
  pista text,                                  -- últimos 4 caracteres, opcional
  ultima_rotacion timestamptz,
  caduca_el date,
  notas text,
  creado_el timestamptz not null default now(),
  unique (user_id, referencia)
);
alter table public.credenciales_ref enable row level security;
create policy "credenciales_ref propias" on public.credenciales_ref for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- Previews y archivos
-- ---------------------------------------------------------------
create table public.previews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  titulo text not null,
  url text not null,
  entorno entorno not null default 'desarrollo',
  creado_el timestamptz not null default now()
);
alter table public.previews enable row level security;
create policy "previews propias" on public.previews for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.archivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  tarea_id uuid references public.tareas(id) on delete set null,
  mensaje_id uuid references public.mensajes(id) on delete set null,
  nombre text not null,
  ruta_storage text,                           -- {user_id}/{proyecto_id}/{archivo}
  url_externa text,
  tipo_mime text,
  bytes bigint,
  creado_el timestamptz not null default now()
);
alter table public.archivos enable row level security;
create policy "archivos propios" on public.archivos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index idx_archivos_proyecto on public.archivos(proyecto_id);

-- Bucket privado
insert into storage.buckets (id, name, public) values ('archivos','archivos', false) on conflict (id) do nothing;
create policy "archivos: leer propios" on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "archivos: subir propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "archivos: actualizar propios" on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "archivos: borrar propios" on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------
-- Configuración de la aplicación (Powered by, WhatsApp, versión) — lectura para autenticados
-- ---------------------------------------------------------------
create table public.configuracion_app (
  clave text primary key,
  valor text not null,
  descripcion text,
  actualizado_el timestamptz not null default now()
);
alter table public.configuracion_app enable row level security;
create policy "configuracion: leer" on public.configuracion_app for select to authenticated using (true);
insert into public.configuracion_app (clave, valor, descripcion) values
  ('powered_by', 'Modeontecno S.L.', 'Leyenda de autoría. Valores: Modeontecno S.L. | Soluciones EvoluteIA S.L.'),
  ('whatsapp_url', 'https://wa.me/', 'Enlace de WhatsApp para comunicación con socios'),
  ('version_app', '0.1.0', 'Versión actual de NexDeveloper'),
  ('nombre_app', 'NexDeveloper', 'Nombre comercial');

-- ---------------------------------------------------------------
-- Vistas de apoyo
-- ---------------------------------------------------------------
create or replace view public.v_resumen_proyecto with (security_invoker = true) as
select
  p.id as proyecto_id,
  p.user_id,
  count(t.id) as total_tareas,
  count(t.id) filter (where t.estado = 'completada') as completadas,
  count(t.id) filter (where t.estado = 'ejecutando') as ejecutando,
  count(t.id) filter (where t.estado not in ('completada','ejecutando','cancelada')) as pendientes,
  coalesce(sum(t.estimacion_horas),0) as esfuerzo_total,
  coalesce(sum(greatest(0, t.estimacion_horas - t.horas_consumidas)) filter (where t.estado <> 'completada'),0) as esfuerzo_restante,
  coalesce(max(greatest(0, t.estimacion_horas - t.horas_consumidas) * case when t.estado = 'bloqueada' then 2 else 1 end) filter (where t.estado <> 'completada'),0) as cuello_botella_horas,
  coalesce(sum(t.coste_estimado),0) as coste_estimado,
  coalesce(sum(t.coste_consumido),0) as coste_consumido
from public.proyectos p
left join public.tareas t on t.proyecto_id = p.id and t.tarea_padre_id is null
group by p.id, p.user_id;

create or replace view public.v_carga_agentes with (security_invoker = true) as
select
  a.id as agente_id, a.user_id, a.nombre, a.capacidad,
  count(t.id) filter (where t.estado in ('en_cola','ejecutando')) as tareas_activas,
  a.capacidad - count(t.id) filter (where t.estado in ('en_cola','ejecutando')) as capacidad_libre
from public.agentes a
left join public.tareas t on t.agente_id = a.id
group by a.id, a.user_id, a.nombre, a.capacidad;

-- ---------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------
alter publication supabase_realtime add table public.proyectos, public.tareas, public.ordenes, public.mensajes, public.actividad, public.alertas, public.agentes;
