-- NexDeveloper · Migración 025 · Generador de manuales de usuario · v0.25.0

create table if not exists public.manuales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  titulo text not null,
  publico text not null default 'usuario',            -- usuario | administrador | comercial
  version_proyecto text,
  estado text not null default 'borrador',            -- borrador | preparando | redactando | publicando | listo | error
  paso text,
  esquema jsonb,                                       -- índice propuesto por la IA {introduccion, capitulos:[{orden, titulo, ruta, objetivo, elementos[]}]}
  capitulos jsonb not null default '[]'::jsonb,        -- [{orden, titulo, ruta, captura_url, texto_md, hecho}]
  introduccion_md text,
  html text,
  markdown text,
  ruta_remota_html text,
  ruta_remota_md text,
  documento_id uuid,                                    -- documentos_nex
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  coste numeric not null default 0,
  error text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists manuales_proyecto_idx on public.manuales(proyecto_id, creado_el desc);
alter table public.manuales enable row level security;
drop policy if exists "manuales propios" on public.manuales;
create policy "manuales propios" on public.manuales for all using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.manuales; exception when duplicate_object then null; end $$;

create table if not exists public.manuales_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  regenerar_al_cambiar_version boolean not null default true,   -- barrido semanal: regenera el manual si la versión del proyecto cambió
  estilo text not null default 'claro',                          -- claro | tecnico
  incluir_capturas boolean not null default true,
  servicio_capturas text,                                        -- por defecto el mismo que Voz y demos
  max_capitulos smallint not null default 25,
  actualizado_el timestamptz not null default now()
);
alter table public.manuales_config enable row level security;
drop policy if exists "manuales_config propia" on public.manuales_config;
create policy "manuales_config propia" on public.manuales_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.lanzar_manuales(p_accion text default 'programado', p_id uuid default null)
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/manuales', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion, 'manual_id', p_id));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'manuales-semanal';
select cron.schedule('manuales-semanal', '0 4 * * 0', $$select public.lanzar_manuales('programado')$$);
