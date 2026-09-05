-- 006_expertos.sql
-- Directorio de expertos: propios, encontrados en la red y sugeridos.
-- Este guion es repetible: se puede ejecutar varias veces sin romper nada.

/* --------------------------------- Tipos ---------------------------------- */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'origen_experto') then
    create type origen_experto as enum ('propio', 'red', 'sugerido');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_experto') then
    create type estado_experto as enum ('propuesto', 'adoptado', 'descartado');
  end if;
end
$$;

/* --------------------------------- Tabla ---------------------------------- */

create table if not exists public.expertos (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug                  text not null,
  nombre                text not null,
  origen                origen_experto not null default 'propio',
  papel                 text not null default '',
  cuando_usarlo         text,
  instrucciones         text,
  modelo_aconsejado_id  uuid references public.modelos_ia(id) on delete set null,
  tareas                text[] not null default '{}',
  muestra_url           text,
  url_origen            text,
  url_origen_publicado  text,
  estado                estado_experto not null default 'propuesto',
  valoracion            smallint check (valoracion between 1 and 5),
  usos                  integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.expertos add column if not exists url_origen_publicado text;

create unique index if not exists expertos_user_slug_key on public.expertos (user_id, slug);
create index if not exists expertos_user_origen_idx on public.expertos (user_id, origen);

grant select, insert, update, delete on public.expertos to authenticated;
grant all on public.expertos to service_role;

alter table public.expertos enable row level security;

drop policy if exists "expertos propios" on public.expertos;
create policy "expertos propios" on public.expertos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/* --------------- Referencias: de agentes a expertos ------------------------ */

-- Cada agente existente pasa a ser también un experto propio, conservando su
-- identificador para que las referencias de chats y tareas sigan siendo válidas.
insert into public.expertos (id, user_id, slug, nombre, origen, papel, cuando_usarlo, estado, tareas)
select
  a.id,
  a.user_id,
  a.codigo,
  a.nombre,
  'propio',
  coalesce(array_to_string(a.especialidades, ', '), ''),
  'Agente propio migrado desde el catálogo de agentes.',
  'adoptado',
  '{}'::text[]
from public.agentes a
on conflict (id) do nothing;

alter table public.plantillas_accion add column if not exists experto_id uuid;

do $$
declare
  r record;
begin
  for r in
    select conname, conrelid::regclass as tabla
    from pg_constraint
    where contype = 'f'
      and conrelid in ('public.chats'::regclass, 'public.tareas'::regclass, 'public.plantillas_accion'::regclass)
      and confrelid = 'public.agentes'::regclass
      and conkey = (
        select array_agg(attnum)
        from pg_attribute
        where attrelid = conrelid and attname = 'experto_id'
      )
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end
$$;

-- Las referencias que no tengan experto equivalente se dejan vacías.
update public.chats set experto_id = null
where experto_id is not null and experto_id not in (select id from public.expertos);
update public.tareas set experto_id = null
where experto_id is not null and experto_id not in (select id from public.expertos);
update public.plantillas_accion set experto_id = null
where experto_id is not null and experto_id not in (select id from public.expertos);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chats_experto_fk') then
    alter table public.chats add constraint chats_experto_fk
      foreign key (experto_id) references public.expertos(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tareas_experto_fk') then
    alter table public.tareas add constraint tareas_experto_fk
      foreign key (experto_id) references public.expertos(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plantillas_accion_experto_fk') then
    alter table public.plantillas_accion add constraint plantillas_accion_experto_fk
      foreign key (experto_id) references public.expertos(id) on delete set null;
  end if;
end
$$;

grant select (experto_id), insert (experto_id), update (experto_id) on public.plantillas_accion to authenticated;

/* -------------------------------- Semilla ---------------------------------- */

create or replace function public.sembrar_expertos(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota constant text :=
    'Instrucciones en la caja expertos-javier de Claude; pegar aquí si se quiere usar desde NexDeveloper.';
  v_total integer;
begin
  if p_user_id is null then
    raise exception 'Falta el usuario';
  end if;

  insert into public.expertos (user_id, slug, nombre, origen, papel, cuando_usarlo, instrucciones, estado, tareas)
  values
    (p_user_id, 'analista-finops-roi', 'Analista FinOps y ROI', 'propio',
     'Analista FinOps y consultor de producto',
     'Coste por usuario y sesión, tokens, caché de respuestas, enrutado entre modelos baratos y potentes, presupuesto.',
     v_nota, 'adoptado', array['razonamiento','clasificacion']),
    (p_user_id, 'arquitecto-db-backend', 'Arquitecto de base de datos y backend', 'propio',
     'Arquitecto de bases de datos y backend Supabase',
     'RLS, esquemas, índices, fugas de service_role, Edge Functions proxy.',
     v_nota, 'adoptado', array['codigo','razonamiento']),
    (p_user_id, 'arquitecto-frontend-ux', 'Arquitecto frontend y UX', 'propio',
     'Arquitecto frontend y UX (Lovable, React, TS, Tailwind)',
     'Dividir componentes, React Query, latencias de IA, rendimiento y accesibilidad.',
     v_nota, 'adoptado', array['codigo']),
    (p_user_id, 'auditor-jefe-orquestador', 'Auditor jefe y orquestador', 'propio',
     'Director de QA y Tech Lead',
     'Auditoría integral en dos pasadas con puntuación sobre 100 y veredicto de publicable.',
     v_nota, 'adoptado', array['razonamiento','resumen']),
    (p_user_id, 'auditor-seguridad-appsec', 'Auditor de seguridad AppSec', 'propio',
     'Ciberseguridad y pentest',
     'Auth, JWT, XSS, inyección SQL, prompt injection, secretos, PII.',
     v_nota, 'adoptado', array['codigo','razonamiento']),
    (p_user_id, 'biblioteca-afilia', 'Biblioteca Afilia', 'propio',
     'Biblioteca de bloques y rutinas reutilizables',
     'Diseño Afilia, login, ficha, listados, permisos, KPI, importador, SEPA, PWA.',
     v_nota, 'adoptado', array['codigo']),
    (p_user_id, 'cumplimiento-rgpd', 'Cumplimiento RGPD', 'propio',
     'Consultor RGPD/LOPDGDD/LSSI y DPO',
     'Bases legales, RAT, cookies, DPA, DPIA, brechas.',
     v_nota, 'adoptado', array['razonamiento','resumen']),
    (p_user_id, 'devops-observabilidad', 'DevOps y observabilidad', 'propio',
     'DevOps, SRE y observabilidad',
     'Sentry, alertas, copias, entornos, CI/CD, rollback.',
     v_nota, 'adoptado', array['codigo','razonamiento']),
    (p_user_id, 'ingeniero-ia-prompt-engineering', 'Ingeniero de IA y prompt engineering', 'propio',
     'Ingeniero de IA y prompt engineering para la API de Claude',
     'System prompts, JSON estructurado, elección Haiku/Sonnet.',
     v_nota, 'adoptado', array['razonamiento','clasificacion']),
    (p_user_id, 'qa-tolerancia-fallos', 'QA y tolerancia a fallos', 'propio',
     'QA y resiliencia',
     'Edge cases, caídas de Supabase/Claude, timeouts, datos corruptos, reintentos, Zod.',
     v_nota, 'adoptado', array['codigo','razonamiento']),
    (p_user_id, 'testing-automatizado', 'Testing automatizado', 'propio',
     'QA automation con Vitest y Playwright',
     'Unitarios, E2E, regresión visual, CI.',
     v_nota, 'adoptado', array['codigo']),

    (p_user_id, 'redactor-tecnico', 'Redactor técnico', 'sugerido',
     'Redactor técnico', 'Documentación y manuales de usuario.', null, 'propuesto', array['resumen']),
    (p_user_id, 'disenador-producto', 'Diseñador de producto', 'sugerido',
     'Diseñador de producto', 'Pantallas y flujos de uso.', null, 'propuesto', array['imagen']),
    (p_user_id, 'analista-datos', 'Analista de datos', 'sugerido',
     'Analista de datos', 'Consultas SQL e informes.', null, 'propuesto', array['clasificacion']),
    (p_user_id, 'traductor', 'Traductor', 'sugerido',
     'Traductor', 'Internacionalización y textos en varios idiomas.', null, 'propuesto', array['traduccion']),
    (p_user_id, 'comercial', 'Comercial', 'sugerido',
     'Comercial', 'Argumentarios de venta y dosieres.', null, 'propuesto', array['busqueda'])
  on conflict (user_id, slug) do nothing;

  select count(*) into v_total from public.expertos where user_id = p_user_id;
  return v_total;
end;
$$;

grant execute on function public.sembrar_expertos(uuid) to authenticated;

-- Semilla para los usuarios que ya existen.
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform public.sembrar_expertos(u.id);
  end loop;
end
$$;

/* ------------------------- Barrido semanal (pg_cron) ------------------------ */

-- Necesita las extensiones pg_cron y pg_net y el secreto de servicio guardado
-- en private.claves_sistema con la clave 'service_role'.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists private.claves_sistema (
  clave text primary key,
  valor text not null
);

create or replace function public.lanzar_barrido_expertos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url   text;
  v_clave text;
begin
  select valor into v_url   from private.claves_sistema where clave = 'url_funciones';
  select valor into v_clave from private.claves_sistema where clave = 'service_role';
  if v_url is null or v_clave is null then
    raise notice 'Faltan url_funciones o service_role en private.claves_sistema';
    return;
  end if;
  perform net.http_post(
    url     := v_url || '/barrer-expertos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_clave),
    body    := jsonb_build_object('programado', true)
  );
end;
$$;

-- Lunes a las 07:00 hora de Madrid (05:00 UTC en horario de verano).
select cron.unschedule('barrido-expertos') where exists (
  select 1 from cron.job where jobname = 'barrido-expertos'
);
select cron.schedule('barrido-expertos', '0 5 * * 1', 'select public.lanzar_barrido_expertos()');
