-- NexDeveloper · Migración 024 · Asistente con contexto de toda la cartera · v0.24.0

create table if not exists public.asistente_conversaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null default 'Nueva conversación',
  proyecto_id uuid references public.proyectos(id) on delete set null,
  fijada boolean not null default false,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  coste numeric not null default 0,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
alter table public.asistente_conversaciones enable row level security;
drop policy if exists "asistente_conversaciones propias" on public.asistente_conversaciones;
create policy "asistente_conversaciones propias" on public.asistente_conversaciones for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.asistente_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.asistente_conversaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null,                                   -- usuario | asistente
  texto text not null default '',
  herramientas jsonb,                                  -- [{nombre, entrada, salida_resumen}] usadas para responder
  acciones jsonb,                                      -- [{tipo, id, titulo, url}] creadas (tareas, órdenes, avisos)
  proveedor text,
  modelo text,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  coste numeric not null default 0,
  duracion_ms integer,
  error text,
  creado_el timestamptz not null default now()
);
create index if not exists asistente_mensajes_conv_idx on public.asistente_mensajes(conversacion_id, creado_el);
alter table public.asistente_mensajes enable row level security;
drop policy if exists "asistente_mensajes propios" on public.asistente_mensajes;
create policy "asistente_mensajes propios" on public.asistente_mensajes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.asistente_mensajes; exception when duplicate_object then null; end $$;

-- Consulta de solo lectura para el asistente (solo SELECT/WITH, una sentencia, tope de 200 filas)
create or replace function public.asistente_consulta(p_user uuid, p_sql text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v jsonb; s text := btrim(p_sql);
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  s := regexp_replace(s, ';\s*$', '');
  if s !~* '^\s*(select|with)\M' or s ~ ';' or s ~* '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|pg_sleep)\M' then
    raise exception 'Solo se permiten consultas SELECT de una sola sentencia';
  end if;
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s limit 200) t', s) into v;
  return v;
end $$;
revoke all on function public.asistente_consulta(uuid, text) from public, anon, authenticated;

create or replace function public.incrementar_conversacion(p_id uuid, p_te integer, p_ts integer, p_coste numeric)
returns void language sql security definer set search_path to 'public' as $$
  update public.asistente_conversaciones set tokens_entrada = tokens_entrada + coalesce(p_te,0), tokens_salida = tokens_salida + coalesce(p_ts,0), coste = coste + coalesce(p_coste,0), actualizado_el = now() where id = p_id;
$$;
revoke all on function public.incrementar_conversacion(uuid,integer,integer,numeric) from public, anon, authenticated;
