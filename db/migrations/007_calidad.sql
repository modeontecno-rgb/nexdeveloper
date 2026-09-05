-- 007_calidad.sql
-- Control de calidad: catálogo de controles, ejecuciones, resultados,
-- revisión previa de las órdenes y semáforo por proyecto.
-- Este guion es repetible: se puede ejecutar varias veces sin romper nada.

/* --------------------------------- Tipos ---------------------------------- */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'momento_control') then
    create type momento_control as enum ('antes', 'despues', 'continuo');
  end if;
  if not exists (select 1 from pg_type where typname = 'origen_ejecucion_calidad') then
    create type origen_ejecucion_calidad as enum ('github_actions', 'manual', 'revision_orden');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_ejecucion_calidad') then
    create type estado_ejecucion_calidad as enum ('en_cola', 'ejecutando', 'verde', 'ambar', 'rojo', 'error');
  end if;
  if not exists (select 1 from pg_type where typname = 'resultado_control') then
    create type resultado_control as enum ('ok', 'aviso', 'fallo', 'omitido');
  end if;
  if not exists (select 1 from pg_type where typname = 'semaforo_calidad') then
    create type semaforo_calidad as enum ('verde', 'ambar', 'rojo', 'sin_datos');
  end if;
end
$$;

/* ---------------------------- Catálogo de controles ------------------------ */

create table if not exists public.controles_calidad (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nombre      text not null,
  descripcion text not null default '',
  herramienta text not null default '',
  que_evita   text not null default '',
  momento     momento_control not null default 'despues',
  bloqueante  boolean not null default false,
  orden       integer not null default 0
);

grant select on public.controles_calidad to authenticated;
grant all on public.controles_calidad to service_role;

alter table public.controles_calidad enable row level security;
drop policy if exists "controles visibles" on public.controles_calidad;
create policy "controles visibles" on public.controles_calidad
  for select to authenticated using (true);

insert into public.controles_calidad (codigo, nombre, descripcion, herramienta, que_evita, momento, bloqueante, orden)
values
  ('tipos', 'Tipos de TypeScript', 'Comprueba que no hay errores de tipos en todo el proyecto.', 'tsc --noEmit',
   'Errores que solo aparecerían con la aplicación ya publicada.', 'despues', true, 1),
  ('compilacion', 'Compilación', 'Genera la versión de producción para asegurar que compila.', 'npm run build',
   'Publicar una versión que no arranca.', 'despues', true, 2),
  ('eslint', 'Revisión de estilo', 'Revisa el código con las reglas del proyecto.', 'eslint',
   'Código descuidado y errores frecuentes.', 'despues', false, 3),
  ('vitest', 'Pruebas unitarias', 'Ejecuta las pruebas unitarias del proyecto.', 'vitest',
   'Romper cosas que antes funcionaban.', 'despues', true, 4),
  ('playwright_humo', 'Pruebas de humo', 'Recorre las pantallas principales en un navegador real.', 'playwright',
   'Pantallas en blanco o rutas rotas.', 'despues', false, 5),
  ('i18n', 'Textos e idiomas', 'Compara las claves de traducción entre idiomas.', 'script propio',
   'Textos sin traducir o en el idioma equivocado.', 'despues', false, 6),
  ('advisors_seguridad', 'Avisos de seguridad de la base de datos', 'Consulta los avisos de seguridad de Supabase.', 'API de Supabase',
   'Tablas sin protección o datos expuestos.', 'continuo', true, 7),
  ('advisors_rendimiento', 'Avisos de rendimiento de la base de datos', 'Consulta los avisos de rendimiento de Supabase.', 'API de Supabase',
   'Consultas lentas y falta de índices.', 'continuo', false, 8),
  ('secretos_codigo', 'Claves en el código', 'Busca claves y tokens escritos en el código.', 'grep',
   'Publicar una clave privada por descuido.', 'despues', true, 9),
  ('lighthouse', 'Rendimiento y accesibilidad', 'Mide la web publicada con Lighthouse.', 'lighthouse',
   'Páginas lentas o poco accesibles.', 'despues', false, 10),
  ('npm_audit', 'Dependencias con fallos conocidos', 'Revisa las dependencias con avisos de seguridad.', 'npm audit',
   'Arrastrar librerías vulnerables.', 'despues', false, 11),
  ('reglas_fabricante', 'Reglas fijas del fabricante', 'Comprueba «Powered by», WhatsApp, CHANGELOG y número de versión.', 'script propio',
   'Entregar una versión sin las marcas y el registro obligatorios.', 'despues', true, 12)
on conflict (codigo) do update set
  nombre      = excluded.nombre,
  descripcion = excluded.descripcion,
  herramienta = excluded.herramienta,
  que_evita   = excluded.que_evita,
  momento     = excluded.momento,
  bloqueante  = excluded.bloqueante,
  orden       = excluded.orden;

/* ----------------------------- Ejecuciones -------------------------------- */

create table if not exists public.ejecuciones_calidad (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id    uuid not null references public.proyectos(id) on delete cascade,
  version        text not null default '',
  origen         origen_ejecucion_calidad not null default 'github_actions',
  run_id_github  bigint,
  url_run        text,
  estado         estado_ejecucion_calidad not null default 'en_cola',
  iniciada_el    timestamptz not null default now(),
  terminada_el   timestamptz,
  duracion_seg   integer,
  resumen        jsonb not null default '{}'::jsonb,
  creado_el      timestamptz not null default now()
);

create index if not exists ejecuciones_calidad_proyecto_idx on public.ejecuciones_calidad (proyecto_id, creado_el desc);

grant select, insert, update, delete on public.ejecuciones_calidad to authenticated;
grant all on public.ejecuciones_calidad to service_role;

alter table public.ejecuciones_calidad enable row level security;
drop policy if exists "ejecuciones propias" on public.ejecuciones_calidad;
create policy "ejecuciones propias" on public.ejecuciones_calidad
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

/* ----------------------------- Resultados --------------------------------- */

create table if not exists public.resultados_calidad (
  id             uuid primary key default gen_random_uuid(),
  ejecucion_id   uuid not null references public.ejecuciones_calidad(id) on delete cascade,
  control_codigo text not null references public.controles_calidad(codigo) on delete cascade,
  resultado      resultado_control not null default 'omitido',
  detalle        text not null default '',
  metrica        jsonb not null default '{}'::jsonb,
  url_detalle    text
);

create index if not exists resultados_calidad_ejecucion_idx on public.resultados_calidad (ejecucion_id);

grant select, insert, update, delete on public.resultados_calidad to authenticated;
grant all on public.resultados_calidad to service_role;

alter table public.resultados_calidad enable row level security;
drop policy if exists "resultados propios" on public.resultados_calidad;
create policy "resultados propios" on public.resultados_calidad
  for all to authenticated
  using (exists (select 1 from public.ejecuciones_calidad e where e.id = ejecucion_id and e.user_id = auth.uid()))
  with check (exists (select 1 from public.ejecuciones_calidad e where e.id = ejecucion_id and e.user_id = auth.uid()));

/* -------------------------- Revisiones de la orden ------------------------- */

create table if not exists public.revisiones_orden (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  orden_id    uuid not null references public.ordenes(id) on delete cascade,
  aprobada    boolean not null default true,
  hallazgos   jsonb not null default '[]'::jsonb,
  revisada_el timestamptz not null default now()
);

create index if not exists revisiones_orden_orden_idx on public.revisiones_orden (orden_id, revisada_el desc);

grant select, insert, update, delete on public.revisiones_orden to authenticated;
grant all on public.revisiones_orden to service_role;

alter table public.revisiones_orden enable row level security;
drop policy if exists "revisiones propias" on public.revisiones_orden;
create policy "revisiones propias" on public.revisiones_orden
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.ordenes add column if not exists revision_id uuid;
alter table public.ordenes add column if not exists bloqueada_por_revision boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ordenes_revision_fk') then
    alter table public.ordenes add constraint ordenes_revision_fk
      foreign key (revision_id) references public.revisiones_orden(id) on delete set null;
  end if;
end
$$;

/* --------------------- Semáforo de calidad en el proyecto ------------------ */

alter table public.proyectos add column if not exists semaforo_calidad semaforo_calidad not null default 'sin_datos';
alter table public.proyectos add column if not exists ultima_ejecucion_calidad_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'proyectos_ultima_ejecucion_fk') then
    alter table public.proyectos add constraint proyectos_ultima_ejecucion_fk
      foreign key (ultima_ejecucion_calidad_id) references public.ejecuciones_calidad(id) on delete set null;
  end if;
end
$$;

-- El repositorio se guarda siempre como propietario/nombre.
update public.proyectos
set repositorio = regexp_replace(
      regexp_replace(trim(repositorio), '^https?://(www\.)?github\.com/', ''),
      '(\.git)?/*$', '')
where repositorio is not null and repositorio like '%github.com%';

create or replace function public.actualizar_semaforo_proyecto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado in ('verde', 'ambar', 'rojo') and (old.estado is distinct from new.estado) then
    update public.proyectos
    set semaforo_calidad = new.estado::text::semaforo_calidad,
        ultima_ejecucion_calidad_id = new.id
    where id = new.proyecto_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_semaforo_proyecto on public.ejecuciones_calidad;
create trigger trg_semaforo_proyecto
after update on public.ejecuciones_calidad
for each row execute function public.actualizar_semaforo_proyecto();

/* --------------------------- Revisión de la orden -------------------------- */

create or replace function public.revisar_orden(p_orden_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden      public.ordenes%rowtype;
  v_repo       text;
  v_texto      text;
  v_hallazgos  jsonb := '[]'::jsonb;
  v_bloquea    boolean := false;
  v_revision   uuid;
begin
  select * into v_orden from public.ordenes where id = p_orden_id and user_id = auth.uid();
  if not found then
    raise exception 'No se encuentra la orden.';
  end if;

  v_texto := coalesce(v_orden.texto, '');

  if v_texto ~ '(sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|eyJ[A-Za-z0-9_\-\.]{20,}|service_role|SUPABASE_SERVICE|-----BEGIN)' then
    v_hallazgos := v_hallazgos || jsonb_build_object(
      'codigo', 'clave_en_texto', 'gravedad', 'bloquea',
      'mensaje', 'El texto de la orden parece contener una clave o un token. Quítalo y guárdalo en los secretos.');
  end if;

  select repositorio into v_repo from public.proyectos where id = v_orden.proyecto_id;
  if v_repo is null or btrim(v_repo) = '' then
    v_hallazgos := v_hallazgos || jsonb_build_object(
      'codigo', 'sin_repositorio', 'gravedad', 'bloquea',
      'mensaje', 'El proyecto no tiene repositorio indicado. Rellénalo antes de enviar la orden.');
  end if;

  if v_texto !~ '[0-9]+\.[0-9]+\.[0-9]+' then
    v_hallazgos := v_hallazgos || jsonb_build_object(
      'codigo', 'sin_version', 'gravedad', 'aviso',
      'mensaje', 'La orden no indica un número de versión con formato x.y.z.');
  end if;

  if v_texto !~* '(powered by|whatsapp|changelog)' then
    v_hallazgos := v_hallazgos || jsonb_build_object(
      'codigo', 'sin_reglas_fijas', 'gravedad', 'aviso',
      'mensaje', 'Recuerda las reglas fijas: «Powered by», el enlace de WhatsApp y la entrada en el CHANGELOG.');
  end if;

  if v_texto ~* 'lovable cloud' then
    v_hallazgos := v_hallazgos || jsonb_build_object(
      'codigo', 'menciona_cloud', 'gravedad', 'aviso',
      'mensaje', 'La orden menciona Lovable Cloud; en estos proyectos se usa el Supabase propio.');
  end if;

  if v_texto !~* '(desatendid|requiere atención|requiere atencion|atención humana|atencion humana)' then
    v_hallazgos := v_hallazgos || jsonb_build_object(
      'codigo', 'sin_modo_trabajo', 'gravedad', 'aviso',
      'mensaje', 'La orden no dice si es trabajo desatendido o si requiere tu atención.');
  end if;

  select exists (
    select 1 from jsonb_array_elements(v_hallazgos) h where h->>'gravedad' = 'bloquea'
  ) into v_bloquea;

  insert into public.revisiones_orden (user_id, orden_id, aprobada, hallazgos)
  values (v_orden.user_id, p_orden_id, not v_bloquea, v_hallazgos)
  returning id into v_revision;

  update public.ordenes
  set revision_id = v_revision,
      bloqueada_por_revision = v_bloquea
  where id = p_orden_id;

  return jsonb_build_object('aprobada', not v_bloquea, 'hallazgos', v_hallazgos, 'revision_id', v_revision);
end;
$$;

grant execute on function public.revisar_orden(uuid) to authenticated;

/* ------------------ Sincronización periódica con GitHub -------------------- */

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists private.claves_sistema (
  clave text primary key,
  valor text not null
);

create or replace function public.lanzar_sincronizacion_calidad()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_clave  text;
  v_abiertas integer;
begin
  select count(*) into v_abiertas from public.ejecuciones_calidad where estado in ('en_cola', 'ejecutando');
  if v_abiertas = 0 then
    return;
  end if;
  select valor into v_url   from private.claves_sistema where clave = 'url_funciones';
  select valor into v_clave from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_clave is null then
    raise notice 'Faltan url_funciones o cron_token en private.claves_sistema';
    return;
  end if;
  perform net.http_post(
    url     := v_url || '/calidad-github',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', v_clave),
    body    := jsonb_build_object('accion', 'sincronizar', 'programado', true)
  );
end;
$$;

select cron.unschedule('sincronizar-calidad') where exists (
  select 1 from cron.job where jobname = 'sincronizar-calidad'
);
select cron.schedule('sincronizar-calidad', '*/2 * * * *', 'select public.lanzar_sincronizacion_calidad()');

/* ------------------- Plantilla de acción: instalar el taller ---------------- */

insert into public.plantillas_accion (user_id, tipo, nombre, descripcion, parametros_por_defecto, requiere_aprobacion)
select u.id, 'github_subir_archivo', 'Instalar taller de calidad',
       'Sube .github/workflows/calidad.yml al repositorio del proyecto.',
       jsonb_build_object('ruta', '.github/workflows/calidad.yml', 'mensaje', 'Añadir el taller de control de calidad'),
       true
from auth.users u
where not exists (
  select 1 from public.plantillas_accion p
  where p.user_id = u.id and p.nombre = 'Instalar taller de calidad'
);
