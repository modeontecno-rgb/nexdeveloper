-- 012_dominios.sql — NexDeveloper 0.12.0 «Dominios y certificados»
create table if not exists public.dominios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  proyecto_id uuid references public.proyectos(id) on delete set null,
  dominio text not null,
  tipo text not null default 'dominio',     -- dominio | subdominio | externo
  registrador text,
  gestionado_por text,
  activo boolean not null default true,
  aviso_dias int not null default 30,
  pendiente boolean not null default false,
  ip_resuelta text, dns_ok boolean, http_estado int, https_ok boolean, tiempo_ms int,
  cert_emisor text, cert_valido_hasta timestamptz, cert_dias int,
  dominio_caduca timestamptz, dominio_dias int,
  resultado text not null default 'sin_comprobar',   -- ok | aviso | error | sin_comprobar
  error text, ultima_comprobacion timestamptz, avisado_el timestamptz, tarea_id uuid, notas text,
  creado_el timestamptz not null default now(), actualizado_el timestamptz not null default now(),
  unique (user_id, dominio)
);
alter table public.dominios enable row level security;
create policy dominios_propietario on public.dominios for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table if not exists public.dominios_historial (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  dominio_id uuid not null references public.dominios(id) on delete cascade,
  comprobado_el timestamptz not null default now(), resultado text not null,
  http_estado int, https_ok boolean, tiempo_ms int, cert_dias int, dominio_dias int, error text
);
create index dominios_historial_idx on public.dominios_historial(dominio_id, comprobado_el desc);
alter table public.dominios_historial enable row level security;
create policy dominios_historial_propietario on public.dominios_historial for select to authenticated using (user_id = auth.uid());
create or replace view public.v_dominios_resumen as
  select user_id, count(*) filter (where activo) as total, count(*) filter (where activo and resultado = 'ok') as ok,
    count(*) filter (where activo and resultado = 'aviso') as aviso, count(*) filter (where activo and resultado = 'error') as error,
    min(cert_dias) filter (where activo and cert_dias is not null) as cert_dias_min,
    min(dominio_dias) filter (where activo and dominio_dias is not null) as dominio_dias_min,
    max(ultima_comprobacion) as ultima_comprobacion
  from public.dominios group by user_id;
-- Semilla: evoluteia.com, almacen/consola-almacen.evoluteia.com, qsvista.com, modeontecno.synology.me (desactivado) y las apps *.lovable.app de cada proyecto (desde proyectos.espacio_trabajo_url)
-- Lanzadores (pg_cron + pg_net con x-cron-token)
create or replace function public.lanzar_comprobacion_dominios() returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/dominios-comprobar', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado'));
end $$;
create or replace function public.lanzar_comprobacion_dominios_continuar() returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/dominios-comprobar', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado','continuar', true));
end $$;
revoke execute on function public.lanzar_comprobacion_dominios() from public, anon, authenticated;
revoke execute on function public.lanzar_comprobacion_dominios_continuar() from public, anon, authenticated;
select cron.schedule('dominios-diario', '0 6 * * *', $$select public.lanzar_comprobacion_dominios()$$);
alter publication supabase_realtime add table public.dominios;
