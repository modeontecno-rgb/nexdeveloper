-- NexDeveloper · Migración 031 · «Mi IA»: apartado PERSONAL (fusión de IAs), botón «Pídeme qué quieres» y Plaud directo · v0.31.0

-- ============ PERSONAL: separado por completo de los proyectos ============
create table if not exists public.personal_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  proveedores text[],                                   -- slugs a consultar (nulo = todos los de texto con clave)
  max_proveedores smallint not null default 4,
  juez text,                                            -- slug del proveedor que fusiona (nulo = el mejor disponible)
  modo text not null default 'fusion',                  -- fusion (todas + síntesis) | rapido (solo el mejor) | comparar (todas, sin síntesis)
  guardar_en_almacen boolean not null default true,     -- documentos en la carpeta PERSONAL del almacén
  carpeta_almacen text not null default 'PERSONAL',
  carpeta_mac text not null default 'PERSONAL',
  instrucciones text,                                   -- cómo quiere que se le responda (tono, formato…)
  actualizado_el timestamptz not null default now()
);
alter table public.personal_config enable row level security;
drop policy if exists "personal_config propia" on public.personal_config;
create policy "personal_config propia" on public.personal_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.personal_conversaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null default 'Nueva conversación',
  fijada boolean not null default false,
  archivada boolean not null default false,
  resumen text,
  etiquetas text[] not null default '{}',
  mensajes integer not null default 0,
  coste numeric not null default 0,
  ultimo_mensaje_el timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists personal_conversaciones_user_idx on public.personal_conversaciones(user_id, ultimo_mensaje_el desc);
alter table public.personal_conversaciones enable row level security;
drop policy if exists "personal_conversaciones propias" on public.personal_conversaciones;
create policy "personal_conversaciones propias" on public.personal_conversaciones for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.personal_mensajes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversacion_id uuid not null references public.personal_conversaciones(id) on delete cascade,
  rol text not null,                                    -- usuario | asistente
  texto text not null,
  respuestas jsonb not null default '[]'::jsonb,        -- [{proveedor, modelo, texto, tokens_entrada, tokens_salida, coste, ms, error}]
  juez text,                                            -- proveedor que hizo la fusión
  discrepancias text,                                   -- en qué no coincidieron las IA
  adjuntos jsonb not null default '[]'::jsonb,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  coste numeric not null default 0,
  fecha timestamptz not null default now()
);
create index if not exists personal_mensajes_conv_idx on public.personal_mensajes(conversacion_id, fecha);
alter table public.personal_mensajes enable row level security;
drop policy if exists "personal_mensajes propios" on public.personal_mensajes;
create policy "personal_mensajes propios" on public.personal_mensajes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.personal_documentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversacion_id uuid references public.personal_conversaciones(id) on delete set null,
  titulo text not null,
  tipo text not null default 'informe',                 -- informe | resumen | carta | lista | otro
  contenido_md text,
  html text,
  ruta_remota text,                                     -- PERSONAL/<aaaa>/<archivo>.html
  ruta_mac text,                                        -- PERSONAL/<archivo>.pdf
  bytes integer,
  etiquetas text[] not null default '{}',
  creado_el timestamptz not null default now()
);
alter table public.personal_documentos enable row level security;
drop policy if exists "personal_documentos propios" on public.personal_documentos;
create policy "personal_documentos propios" on public.personal_documentos for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ «Pídeme qué quieres»: peticiones directas y su enrutado ============
create table if not exists public.peticiones_directas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  texto text not null,
  origen text not null default 'texto',                 -- texto | voz | plaud
  clasificacion jsonb,                                  -- {destino, proyecto_id, proyecto_nombre, confianza, tipo (consulta|modificacion|tarea|personal), titulo, motivo}
  destino text,                                         -- proyecto | personal
  proyecto_id uuid references public.proyectos(id) on delete set null,
  chat_id uuid references public.chats(id) on delete set null,
  conversacion_id uuid references public.personal_conversaciones(id) on delete set null,
  mesa_id uuid references public.mesas(id) on delete set null,   -- propuesta revisada por expertos
  orden_id uuid references public.ordenes(id) on delete set null,
  tarea_id uuid references public.tareas(id) on delete set null,
  estado text not null default 'nueva',                 -- nueva | clasificada | respondida | propuesta | aprobada | descartada | error
  respuesta text,
  propuesta jsonb,                                      -- {sintesis, plan[], revisiones[{experto, area, observaciones, riesgos}], coste_estimado, horas}
  error text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists peticiones_directas_user_idx on public.peticiones_directas(user_id, creado_el desc);
alter table public.peticiones_directas enable row level security;
drop policy if exists "peticiones_directas propias" on public.peticiones_directas;
create policy "peticiones_directas propias" on public.peticiones_directas for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Alias de proyectos para reconocerlos al hablar («la app de los abuelos» → Gericentro)
alter table public.proyectos add column if not exists alias text[] not null default '{}';

-- ============ Conexiones externas por OAuth (Plaud y las que vengan) ============
create table if not exists public.conexiones_externas (
  user_id uuid not null references auth.users(id) on delete cascade,
  proveedor text not null,                              -- plaud | google | …
  client_id text,
  cuenta text,
  estado text not null default 'desconectada',          -- desconectada | conectada | error
  secreto_cifrado text,                                 -- refresh token (cifrado)
  acceso_cifrado text,                                  -- access token (cifrado)
  expira_el timestamptz,
  ultimo_error text,
  ultima_comprobacion timestamptz,
  datos jsonb not null default '{}'::jsonb,
  actualizado_el timestamptz not null default now(),
  primary key (user_id, proveedor)
);
alter table public.conexiones_externas enable row level security;
drop policy if exists "conexiones_externas propias" on public.conexiones_externas;
create policy "conexiones_externas propias" on public.conexiones_externas for select using (user_id = auth.uid());

create or replace function public.guardar_secreto_conexion(p_user_id uuid, p_proveedor text, p_refresh text, p_acceso text, p_expira timestamptz)
returns boolean language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  if v_key is null or v_key = '' then raise exception 'No hay clave de cifrado configurada'; end if;
  insert into public.conexiones_externas (user_id, proveedor) values (p_user_id, p_proveedor) on conflict do nothing;
  update public.conexiones_externas set
    secreto_cifrado = case when p_refresh is null then secreto_cifrado when p_refresh = '' then null else encode(pgp_sym_encrypt(p_refresh, v_key),'base64') end,
    acceso_cifrado  = case when p_acceso  is null then acceso_cifrado  when p_acceso  = '' then null else encode(pgp_sym_encrypt(p_acceso,  v_key),'base64') end,
    expira_el = coalesce(p_expira, expira_el), actualizado_el = now()
  where user_id = p_user_id and proveedor = p_proveedor;
  return true;
end $$;
create or replace function public.leer_secretos_conexion(p_user_id uuid, p_proveedor text)
returns table(refresh_token text, access_token text, expira_el timestamptz, client_id text)
language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  return query select
    case when c.secreto_cifrado is null then null else pgp_sym_decrypt(decode(c.secreto_cifrado,'base64'), v_key) end,
    case when c.acceso_cifrado  is null then null else pgp_sym_decrypt(decode(c.acceso_cifrado,'base64'),  v_key) end,
    c.expira_el, c.client_id
  from public.conexiones_externas c where c.user_id = p_user_id and c.proveedor = p_proveedor;
end $$;
revoke all on function public.guardar_secreto_conexion(uuid,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.leer_secretos_conexion(uuid,text) from public, anon, authenticated;

-- ============ Plaud: grabaciones importadas ============
create table if not exists public.plaud_grabaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaud_id text not null,
  nombre text,
  fecha timestamptz,
  duracion_seg integer,
  transcripcion text,
  resumen text,
  destacados jsonb,                                     -- marcas del botón del aparato
  estado text not null default 'importada',             -- importada | clasificada | procesada | descartada
  peticion_id uuid references public.peticiones_directas(id) on delete set null,
  destino text,                                         -- proyecto | personal
  proyecto_id uuid references public.proyectos(id) on delete set null,
  tareas_creadas integer not null default 0,
  error text,
  importada_el timestamptz not null default now(),
  unique (user_id, plaud_id)
);
alter table public.plaud_grabaciones enable row level security;
drop policy if exists "plaud_grabaciones propias" on public.plaud_grabaciones;
create policy "plaud_grabaciones propias" on public.plaud_grabaciones for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.plaud_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  importar_automatico boolean not null default true,    -- cada 30 min
  procesar_automatico boolean not null default true,    -- clasificar y enrutar cada grabación nueva
  desde timestamptz,                                    -- no importar anteriores
  ultima_importacion timestamptz,
  actualizado_el timestamptz not null default now()
);
alter table public.plaud_config enable row level security;
drop policy if exists "plaud_config propia" on public.plaud_config;
create policy "plaud_config propia" on public.plaud_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.personal_mensajes;
  alter publication supabase_realtime add table public.personal_conversaciones;
  alter publication supabase_realtime add table public.peticiones_directas;
  alter publication supabase_realtime add table public.plaud_grabaciones;
exception when duplicate_object then null; end $$;

create or replace function public.lanzar_plaud(p_accion text default 'programado')
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/pideme', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'plaud-importar';
select cron.schedule('plaud-importar', '*/30 * * * *', $$select public.lanzar_plaud('programado')$$);

create or replace function public.incrementar_conversacion_personal(p_id uuid, p_coste numeric default 0)
returns void language sql security definer set search_path to 'public' as $$
  update public.personal_conversaciones set mensajes = mensajes + 2, coste = coste + coalesce(p_coste,0), ultimo_mensaje_el = now(), actualizado_el = now() where id = p_id;
$$;

create or replace function public.leer_cron_token() returns text language plpgsql security definer set search_path to 'private','public' as $$
declare v text; begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  select valor into v from private.claves_sistema where clave = 'cron_token'; return v; end $$;
revoke all on function public.leer_cron_token() from public, anon, authenticated;
