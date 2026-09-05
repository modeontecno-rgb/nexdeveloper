-- 004_proveedores_modelos_trazabilidad.sql
-- Proveedores de IA, modelos, política de enrutado, consumos y trazabilidad
-- en chats y tareas. Todo con RLS por usuario, igual que el resto de tablas.
-- Este guion es repetible: se puede ejecutar varias veces sin romper nada.

create extension if not exists pgcrypto;

-- Clave de cifrado de las claves de proveedor. En Supabase no se permite
-- «alter database ... set», así que vive en la tabla private.claves_sistema y se
-- lee con private.clave_cifrado(). Solo se genera la primera vez.
create schema if not exists private;

create table if not exists private.claves_sistema (
  clave text primary key,
  valor text not null,
  created_at timestamptz not null default now()
);

revoke all on private.claves_sistema from public, anon, authenticated;

insert into private.claves_sistema (clave, valor)
values ('clave_cifrado', encode(gen_random_bytes(32), 'hex'))
on conflict (clave) do nothing;

create or replace function private.clave_cifrado()
returns text
language sql
stable
security definer
set search_path = private, public
as $$
  select valor from private.claves_sistema where clave = 'clave_cifrado'
$$;

revoke all on function private.clave_cifrado() from public, anon, authenticated;

/* --------------------------------- Tipos ---------------------------------- */

do $$ begin
  create type tipo_proveedor_ia as enum ('texto', 'voz', 'imagen', 'busqueda', 'multi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type velocidad_modelo as enum ('baja', 'media', 'alta', 'muy_alta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estrategia_enrutado as enum ('barato', 'rapido', 'mejor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type resultado_ia as enum ('ok', 'aviso', 'error');
exception when duplicate_object then null; end $$;

/* ------------------------------- Proveedores ------------------------------- */

create table if not exists public.proveedores_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  clave_slug text not null,
  tipo tipo_proveedor_ia not null default 'texto',
  activo boolean not null default false,
  clave_cifrada text,
  url_base text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, clave_slug)
);

-- El cliente nunca puede leer clave_cifrada: solo estas columnas.
grant select (id, user_id, nombre, clave_slug, tipo, activo, url_base, notas, created_at, updated_at)
  on public.proveedores_ia to authenticated;
grant insert (nombre, clave_slug, tipo, activo, url_base, notas) on public.proveedores_ia to authenticated;
grant update (nombre, tipo, activo, url_base, notas, updated_at) on public.proveedores_ia to authenticated;
grant delete on public.proveedores_ia to authenticated;
grant all on public.proveedores_ia to service_role;

alter table public.proveedores_ia enable row level security;

do $$ begin
  create policy "proveedores propios" on public.proveedores_ia
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Vista segura: en lugar de la clave, solo dice si hay clave guardada.
create or replace view public.v_proveedores_ia
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.nombre,
  p.clave_slug,
  p.tipo,
  p.activo,
  (p.clave_cifrada is not null and p.clave_cifrada <> '') as tiene_clave,
  p.url_base,
  p.notas,
  p.created_at,
  p.updated_at
from public.proveedores_ia p;

grant select on public.v_proveedores_ia to authenticated;
grant all on public.v_proveedores_ia to service_role;

/* --------------------------------- Modelos --------------------------------- */

create table if not exists public.modelos_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores_ia(id) on delete cascade,
  identificador text not null,
  nombre text not null,
  activo boolean not null default true,
  coste_entrada numeric(12, 4),
  coste_salida numeric(12, 4),
  velocidad velocidad_modelo not null default 'media',
  contexto_max integer,
  calidad smallint check (calidad between 1 and 5),
  tareas_aconsejadas text[] not null default '{}',
  notas text,
  created_at timestamptz not null default now(),
  unique (proveedor_id, identificador)
);

grant select, insert, update, delete on public.modelos_ia to authenticated;
grant all on public.modelos_ia to service_role;
alter table public.modelos_ia enable row level security;

do $$ begin
  create policy "modelos propios" on public.modelos_ia
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

/* --------------------------- Política de enrutado -------------------------- */

create table if not exists public.politica_enrutado (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tarea text not null,
  estrategia estrategia_enrutado not null default 'mejor',
  modelo_preferido_id uuid references public.modelos_ia(id) on delete set null,
  modelo_respaldo_id uuid references public.modelos_ia(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (user_id, tarea)
);

grant select, insert, update, delete on public.politica_enrutado to authenticated;
grant all on public.politica_enrutado to service_role;
alter table public.politica_enrutado enable row level security;

do $$ begin
  create policy "politica propia" on public.politica_enrutado
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

/* --------------------------------- Consumos -------------------------------- */

create table if not exists public.consumos_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  chat_id uuid references public.chats(id) on delete set null,
  tarea_id uuid references public.tareas(id) on delete set null,
  modelo_id uuid references public.modelos_ia(id) on delete set null,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  coste numeric(12, 6) not null default 0,
  duracion_ms integer not null default 0,
  resultado resultado_ia not null default 'ok',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.consumos_ia to authenticated;
grant all on public.consumos_ia to service_role;
alter table public.consumos_ia enable row level security;

do $$ begin
  create policy "consumos propios" on public.consumos_ia
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create index if not exists idx_consumos_ia_modelo on public.consumos_ia (user_id, modelo_id);
create index if not exists idx_consumos_ia_fecha on public.consumos_ia (user_id, created_at desc);

/* ----------------------- Trazabilidad en chats y tareas -------------------- */

alter table public.chats add column if not exists proveedor_id uuid references public.proveedores_ia(id) on delete set null;
alter table public.chats add column if not exists modelo_id uuid references public.modelos_ia(id) on delete set null;
alter table public.chats add column if not exists experto_id uuid references public.agentes(id) on delete set null;
alter table public.chats add column if not exists resultado resultado_ia;

alter table public.tareas add column if not exists proveedor_id uuid references public.proveedores_ia(id) on delete set null;
alter table public.tareas add column if not exists modelo_id uuid references public.modelos_ia(id) on delete set null;
alter table public.tareas add column if not exists experto_id uuid references public.agentes(id) on delete set null;
alter table public.tareas add column if not exists resultado resultado_ia;

/* ---------------------------- Claves de proveedor -------------------------- */

create or replace function public.guardar_clave_proveedor(p_proveedor_id uuid, p_clave text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := private.clave_cifrado();
begin
  if v_key is null or v_key = '' then
    raise exception 'No hay clave de cifrado configurada en private.claves_sistema';
  end if;

  update public.proveedores_ia
     set clave_cifrada = case
           when p_clave is null or p_clave = '' then null
           else encode(pgp_sym_encrypt(p_clave, v_key), 'base64')
         end,
         updated_at = now()
   where id = p_proveedor_id
     and user_id = auth.uid();

  if not found then
    raise exception 'Proveedor no encontrado';
  end if;
  return true;
end;
$$;

revoke all on function public.guardar_clave_proveedor(uuid, text) from public, anon;
grant execute on function public.guardar_clave_proveedor(uuid, text) to authenticated;

-- Solo la función de servidor (service_role) puede descifrar.
create or replace function public.descifrar_clave_proveedor(p_proveedor_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := private.clave_cifrado();
  v_cifrada text;
begin
  select clave_cifrada into v_cifrada from public.proveedores_ia where id = p_proveedor_id;
  if v_cifrada is null then return null; end if;
  return pgp_sym_decrypt(decode(v_cifrada, 'base64'), v_key);
end;
$$;

revoke all on function public.descifrar_clave_proveedor(uuid) from public, anon, authenticated;
grant execute on function public.descifrar_clave_proveedor(uuid) to service_role;

-- Datos mínimos (sin clave) que necesita la función «probar-proveedor».
create or replace function public.probar_proveedor(p_proveedor_id uuid)
returns table (clave_slug text, url_base text, tiene_clave boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.clave_slug, p.url_base, (p.clave_cifrada is not null) as tiene_clave
  from public.proveedores_ia p
  where p.id = p_proveedor_id and p.user_id = auth.uid();
$$;

revoke all on function public.probar_proveedor(uuid) from public, anon;
grant execute on function public.probar_proveedor(uuid) to authenticated, service_role;

/* ----------------------------- Semilla por usuario ------------------------- */

create or replace function public.sembrar_proveedores_ia()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_insertados integer := 0;
  r record;
  v_prov uuid;
begin
  if v_user is null then raise exception 'Sin sesión'; end if;

  insert into public.proveedores_ia (user_id, nombre, clave_slug, tipo, activo, url_base, notas)
  select v_user, x.nombre, x.slug, x.tipo::tipo_proveedor_ia, x.activo, x.url,
         case when x.slug = 'canva'
           then 'API Canva Connect: diseños desde plantillas de marca, autorrelleno y exportación a PDF/PNG/MP4; no genera imágenes por texto'
         end
  from (values
    ('Anthropic','anthropic','texto',true,'https://api.anthropic.com'),
    ('OpenAI','openai','multi',false,'https://api.openai.com/v1'),
    ('Google','google','multi',true,'https://generativelanguage.googleapis.com'),
    ('Groq','groq','texto',true,'https://api.groq.com/openai/v1'),
    ('Mistral','mistral','texto',false,'https://api.mistral.ai/v1'),
    ('DeepSeek','deepseek','texto',false,'https://api.deepseek.com'),
    ('xAI','xai','texto',false,'https://api.x.ai/v1'),
    ('Perplexity','perplexity','busqueda',false,'https://api.perplexity.ai'),
    ('Cohere','cohere','texto',false,'https://api.cohere.com'),
    ('OpenRouter','openrouter','multi',false,'https://openrouter.ai/api/v1'),
    ('Together','together','texto',false,'https://api.together.xyz/v1'),
    ('ElevenLabs','elevenlabs','voz',true,'https://api.elevenlabs.io'),
    ('fal','fal','imagen',true,'https://fal.run'),
    ('Abacus','abacus','multi',false,'https://api.abacus.ai'),
    ('Ollama','ollama','texto',false,'http://localhost:11434'),
    ('Canva','canva','imagen',true,'https://api.canva.com/rest/v1')
  ) as x(nombre, slug, tipo, activo, url)
  on conflict (user_id, clave_slug) do nothing;

  for r in
    select * from (values
      ('anthropic','claude-opus-4-1','Claude Opus 4.1',15,75,'media',200000,5,array['codigo','razonamiento','vision'],null),
      ('anthropic','claude-sonnet-4-5','Claude Sonnet 4.5',3,15,'alta',200000,5,array['codigo','razonamiento','resumen','vision'],null),
      ('anthropic','claude-3-7-sonnet-latest','Claude Sonnet 3.7',3,15,'alta',200000,4,array['codigo','razonamiento'],null),
      ('anthropic','claude-3-5-haiku-latest','Claude Haiku 3.5',0.8,4,'muy_alta',200000,3,array['resumen','clasificacion','traduccion'],null),
      ('openai','gpt-5','GPT-5',1.25,10,'media',400000,5,array['codigo','razonamiento','vision'],null),
      ('openai','gpt-5-mini','GPT-5 mini',0.25,2,'alta',400000,4,array['codigo','resumen','clasificacion'],null),
      ('openai','gpt-4.1','GPT-4.1',2,8,'alta',1000000,4,array['codigo','resumen','vision'],null),
      ('openai','gpt-4o','GPT-4o',2.5,10,'alta',128000,4,array['razonamiento','vision','resumen'],null),
      ('openai','gpt-4o-mini','GPT-4o mini',0.15,0.6,'muy_alta',128000,3,array['clasificacion','resumen','traduccion'],null),
      ('openai','o3','o3',2,8,'baja',200000,5,array['razonamiento','codigo'],null),
      ('google','gemini-2.5-pro','Gemini 2.5 Pro',1.25,10,'media',1048576,5,array['razonamiento','codigo','vision'],'Precio del tramo hasta 200k tokens'),
      ('google','gemini-2.5-flash','Gemini 2.5 Flash',0.30,2.50,'alta',1048576,4,array['resumen','clasificacion','vision'],null),
      ('google','gemini-2.5-flash-lite','Gemini 2.5 Flash Lite',0.10,0.40,'muy_alta',1048576,3,array['clasificacion','traduccion'],null),
      ('google','gemini-2.5-flash-image','Nano Banana (Gemini 2.5 Flash Image)',0.30,30,'alta',null,4,array['imagen','vision'],'Se cobra por imagen (~0,04 $)'),
      ('google','gemini-2.0-flash','Gemini 2.0 Flash',0.10,0.40,'muy_alta',1048576,3,array['resumen','clasificacion'],null),
      ('groq','llama-3.3-70b-versatile','Llama 3.3 70B',0.59,0.79,'muy_alta',131072,4,array['codigo','resumen'],null),
      ('groq','llama-3.1-8b-instant','Llama 3.1 8B',0.05,0.08,'muy_alta',131072,2,array['clasificacion','traduccion'],null),
      ('groq','openai/gpt-oss-120b','GPT-OSS 120B',0.15,0.75,'muy_alta',131072,4,array['razonamiento','codigo'],null),
      ('mistral','mistral-large-latest','Mistral Large',2,6,'media',128000,4,array['razonamiento','codigo'],null),
      ('mistral','mistral-small-latest','Mistral Small',0.20,0.60,'alta',128000,3,array['resumen','clasificacion'],null),
      ('mistral','codestral-latest','Codestral',0.30,0.90,'alta',256000,4,array['codigo'],null),
      ('deepseek','deepseek-chat','DeepSeek Chat',0.27,1.10,'media',128000,4,array['codigo','resumen'],null),
      ('deepseek','deepseek-reasoner','DeepSeek Reasoner',0.55,2.19,'baja',128000,5,array['razonamiento'],null),
      ('xai','grok-4','Grok 4',3,15,'media',256000,5,array['razonamiento','codigo'],null),
      ('xai','grok-3','Grok 3',3,15,'media',131072,4,array['codigo'],null),
      ('xai','grok-3-mini','Grok 3 mini',0.30,0.50,'alta',131072,3,array['clasificacion','resumen'],null),
      ('perplexity','sonar','Sonar',1,1,'alta',128000,3,array['busqueda'],'Además cobra por búsqueda realizada'),
      ('perplexity','sonar-pro','Sonar Pro',3,15,'media',200000,4,array['busqueda','razonamiento'],null),
      ('perplexity','sonar-reasoning','Sonar Reasoning',1,5,'media',128000,4,array['busqueda','razonamiento'],null),
      ('cohere','command-a-03-2025','Command A',2.50,10,'alta',256000,4,array['codigo','resumen'],null),
      ('cohere','command-r-plus','Command R+',2.50,10,'media',128000,4,array['razonamiento','resumen'],null),
      ('cohere','command-r7b-12-2024','Command R7B',0.0375,0.15,'muy_alta',128000,2,array['clasificacion'],null),
      ('openrouter','openrouter/auto','Enrutado automático',null,null,'media',null,4,array['codigo','razonamiento'],'Precio variable según el modelo elegido'),
      ('openrouter','anthropic/claude-sonnet-4.5','Claude Sonnet 4.5 (OpenRouter)',3,15,'alta',200000,5,array['codigo','razonamiento'],null),
      ('openrouter','openai/gpt-5','GPT-5 (OpenRouter)',1.25,10,'media',400000,5,array['codigo','razonamiento'],null),
      ('together','meta-llama/Llama-3.3-70B-Instruct-Turbo','Llama 3.3 70B Turbo',0.88,0.88,'alta',131072,4,array['codigo','resumen'],null),
      ('together','Qwen/Qwen2.5-72B-Instruct-Turbo','Qwen 2.5 72B Turbo',1.20,1.20,'alta',32768,4,array['codigo'],null),
      ('together','deepseek-ai/DeepSeek-R1','DeepSeek R1',3,7,'baja',164000,5,array['razonamiento'],null),
      ('elevenlabs','eleven_multilingual_v2','Multilingual v2',null,null,'alta',null,5,array['voz'],'Se cobra por caracteres, no por tokens'),
      ('elevenlabs','eleven_flash_v2_5','Flash v2.5',null,null,'muy_alta',null,4,array['voz'],'Se cobra por caracteres, no por tokens'),
      ('fal','fal-ai/flux/dev','FLUX.1 dev',null,null,'alta',null,4,array['imagen'],'Se cobra por imagen generada'),
      ('fal','fal-ai/flux-pro/v1.1','FLUX1.1 pro',null,null,'media',null,5,array['imagen'],'Se cobra por imagen generada'),
      ('abacus','route-llm','RouteLLM',null,null,'media',null,4,array['codigo','razonamiento'],'Incluido en la suscripción del proveedor'),
      ('ollama','llama3.1:8b','Llama 3.1 8B (local)',0,0,'alta',131072,2,array['clasificacion','resumen'],'Se ejecuta en tu equipo'),
      ('ollama','qwen2.5-coder:14b','Qwen2.5 Coder 14B (local)',0,0,'media',32768,3,array['codigo'],'Se ejecuta en tu equipo'),
      ('canva','canva-connect','Canva Connect (diseños y exportación)',null,null,'alta',null,4,array['imagen'],'Diseños desde plantillas de marca y exportación; no genera imágenes por texto')
    ) as m(slug, identificador, nombre, entrada, salida, velocidad, contexto, calidad, tareas, notas)
  loop
    select id into v_prov from public.proveedores_ia where user_id = v_user and clave_slug = r.slug;
    if v_prov is null then continue; end if;
    insert into public.modelos_ia
      (user_id, proveedor_id, identificador, nombre, coste_entrada, coste_salida, velocidad, contexto_max, calidad, tareas_aconsejadas, notas)
    values
      (v_user, v_prov, r.identificador, r.nombre, r.entrada, r.salida, r.velocidad::velocidad_modelo, r.contexto, r.calidad, r.tareas, r.notas)
    on conflict (proveedor_id, identificador) do nothing;
    if found then v_insertados := v_insertados + 1; end if;
  end loop;

  insert into public.politica_enrutado (user_id, tarea, estrategia)
  select v_user, t, 'mejor'::estrategia_enrutado
  from unnest(array['codigo','razonamiento','resumen','traduccion','clasificacion','busqueda','imagen','voz','vision']) as t
  on conflict (user_id, tarea) do nothing;

  return v_insertados;
end;
$$;

revoke all on function public.sembrar_proveedores_ia() from public, anon;
grant execute on function public.sembrar_proveedores_ia() to authenticated;
