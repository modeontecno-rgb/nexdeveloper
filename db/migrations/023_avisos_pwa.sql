-- NexDeveloper · Migración 023 · App instalable (PWA) con avisos push · v0.23.0

create table if not exists public.avisos_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activo boolean not null default true,
  tipos jsonb not null default '{"tarea_atencion":true,"aprobacion":true,"compilacion":true,"dominio":true,"presupuesto":true,"salud":true,"copias":true,"ejecucion":true}'::jsonb,
  silencio_desde smallint not null default 23,     -- hora local (Madrid) de inicio del silencio nocturno
  silencio_hasta smallint not null default 7,
  actualizado_el timestamptz not null default now()
);
alter table public.avisos_config enable row level security;
drop policy if exists "avisos_config propia" on public.avisos_config;
create policy "avisos_config propia" on public.avisos_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.avisos_suscripciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dispositivo text,                                 -- nombre legible (iPhone de Javier, Mac Safari…)
  agente text,
  activa boolean not null default true,
  ultimo_envio timestamptz,
  ultimo_error text,
  creado_el timestamptz not null default now()
);
alter table public.avisos_suscripciones enable row level security;
drop policy if exists "suscripciones propias" on public.avisos_suscripciones;
create policy "suscripciones propias" on public.avisos_suscripciones for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,                               -- tarea_atencion | aprobacion | compilacion | dominio | presupuesto | salud | copias | ejecucion | prueba | otro
  titulo text not null,
  cuerpo text,
  url text,                                         -- ruta dentro de la app (p. ej. /ejecucion?ejecucion=…)
  proyecto_id uuid references public.proyectos(id) on delete set null,
  referencia text,                                  -- id de la tarea/compilación/etc. para no duplicar
  leido boolean not null default false,
  enviado boolean not null default false,
  enviado_el timestamptz,
  enviados integer not null default 0,
  resultado text,
  creado_el timestamptz not null default now()
);
create index if not exists avisos_user_idx on public.avisos(user_id, creado_el desc);
create unique index if not exists avisos_referencia_idx on public.avisos(user_id, tipo, referencia) where referencia is not null;
alter table public.avisos enable row level security;
drop policy if exists "avisos propios" on public.avisos;
create policy "avisos propios" on public.avisos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.avisos; exception when duplicate_object then null; end $$;

-- Lanzador: envía los avisos pendientes por push (llamado por trigger y por cron de respaldo)
create or replace function public.lanzar_avisos()
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/avisos', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','enviar_pendientes'));
end $$;

create or replace function public.avisos_tras_insertar()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.lanzar_avisos();
  return new;
end $$;
drop trigger if exists trg_avisos_enviar on public.avisos;
create trigger trg_avisos_enviar after insert on public.avisos for each row execute function public.avisos_tras_insertar();

-- Crear aviso (evita duplicados por referencia)
create or replace function public.crear_aviso(p_user uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_proyecto uuid, p_referencia text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.avisos (user_id, tipo, titulo, cuerpo, url, proyecto_id, referencia)
  values (p_user, p_tipo, p_titulo, left(p_cuerpo, 300), p_url, p_proyecto, p_referencia)
  on conflict (user_id, tipo, referencia) where referencia is not null do nothing;
end $$;

-- Origen 1: tareas que requieren atención (cubre aprobaciones, salud en rojo, pruebas de copias, bandeja…)
create or replace function public.avisos_desde_tareas()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_tipo text; v_nombre text;
begin
  if coalesce(new.requiere_atencion,false) and (tg_op = 'INSERT' or coalesce(old.requiere_atencion,false) = false) then
    select nombre into v_nombre from public.proyectos where id = new.proyecto_id;
    v_tipo := case
      when new.motivo_atencion ilike 'Aprobar y publicar%' then 'aprobacion'
      when new.motivo_atencion ilike 'Salud%' then 'salud'
      when new.motivo_atencion ilike '%copias%' then 'copias'
      else 'tarea_atencion' end;
    perform public.crear_aviso(new.user_id, v_tipo, coalesce(v_nombre || ': ', '') || new.titulo, coalesce(new.instrucciones, new.descripcion, ''), '/tareas?tarea=' || new.id::text, new.proyecto_id, new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists trg_avisos_tareas on public.tareas;
create trigger trg_avisos_tareas after insert or update of requiere_atencion on public.tareas for each row execute function public.avisos_desde_tareas();

-- Origen 2: compilaciones terminadas o con error
create or replace function public.avisos_desde_compilaciones()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_nombre text;
begin
  if new.estado in ('ok','error') and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    select nombre into v_nombre from public.proyectos where id = new.proyecto_id;
    perform public.crear_aviso(new.user_id, 'compilacion',
      case when new.estado = 'ok' then 'Compilación lista: ' else 'Compilación con error: ' end || coalesce(v_nombre,'') || ' (' || coalesce(new.plataforma,'') || ')',
      coalesce(new.artefacto_nombre, new.error, ''), '/compilaciones?compilacion=' || new.id::text, new.proyecto_id, new.id::text || ':' || new.estado);
  end if;
  return new;
end $$;
drop trigger if exists trg_avisos_compilaciones on public.compilaciones;
create trigger trg_avisos_compilaciones after insert or update of estado on public.compilaciones for each row execute function public.avisos_desde_compilaciones();

-- Origen 3: dominios o certificados a punto de caducar (según aviso_dias del dominio)
create or replace function public.avisos_desde_dominios()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_dias int;
begin
  v_dias := least(coalesce(new.cert_dias, 9999), coalesce(new.dominio_dias, 9999));
  if new.activo and v_dias <= coalesce(new.aviso_dias, 15) and (old.ultima_comprobacion is distinct from new.ultima_comprobacion) then
    perform public.crear_aviso(new.user_id, 'dominio', 'Caduca en ' || v_dias || ' días: ' || new.dominio,
      case when coalesce(new.cert_dias,9999) <= coalesce(new.dominio_dias,9999) then 'Certificado' else 'Dominio' end || ' · ' || coalesce(new.resultado,''), '/dominios', new.proyecto_id, new.id::text || ':' || to_char(now(),'IYYY-IW'));
  end if;
  return new;
end $$;
drop trigger if exists trg_avisos_dominios on public.dominios;
create trigger trg_avisos_dominios after update on public.dominios for each row execute function public.avisos_desde_dominios();

-- Origen 4: presupuestos de IA (al marcarse avisado_mes o bloqueado)
create or replace function public.avisos_desde_presupuestos()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (new.avisado_mes is distinct from old.avisado_mes and new.avisado_mes is not null) or (new.bloqueado and not coalesce(old.bloqueado,false)) then
    perform public.crear_aviso(new.user_id, 'presupuesto',
      case when new.bloqueado then 'Presupuesto de IA BLOQUEADO' else 'Presupuesto de IA al ' || coalesce(new.aviso_pct,80) || ' %' end || ' · ' || coalesce(new.referencia, new.ambito),
      'Límite mensual ' || new.limite_mensual || ' €', '/gasto-ia', null, new.id::text || ':' || coalesce(new.avisado_mes::text,'b') || ':' || new.bloqueado::text);
  end if;
  return new;
end $$;
drop trigger if exists trg_avisos_presupuestos on public.presupuestos_ia;
create trigger trg_avisos_presupuestos after update on public.presupuestos_ia for each row execute function public.avisos_desde_presupuestos();

-- Cron de respaldo cada 5 minutos (por si un envío falló)
select cron.unschedule(jobid) from cron.job where jobname = 'avisos-pendientes';
select cron.schedule('avisos-pendientes', '*/5 * * * *', $$select public.lanzar_avisos()$$);

-- 023b · Claves VAPID (se generan en la primera ejecución de la función «avisos» y se guardan en private.claves_sistema)
create or replace function public.leer_claves_vapid()
returns table(publica text, privada text) language plpgsql security definer set search_path to 'private','public' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  return query select (select valor from private.claves_sistema where clave='vapid_publica'), (select valor from private.claves_sistema where clave='vapid_privada');
end $$;
create or replace function public.guardar_claves_vapid(p_publica text, p_privada text)
returns void language plpgsql security definer set search_path to 'private','public' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  insert into private.claves_sistema (clave, valor) values ('vapid_publica', p_publica), ('vapid_privada', p_privada)
  on conflict (clave) do update set valor = excluded.valor;
end $$;
revoke all on function public.leer_claves_vapid() from public, anon, authenticated;
revoke all on function public.guardar_claves_vapid(text,text) from public, anon, authenticated;
