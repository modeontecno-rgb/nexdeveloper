-- NexDeveloper · Migración 026 · Auditoría mensual de calidad con el Auditor jefe · v0.26.0

create table if not exists public.auditoria_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activa boolean not null default true,
  dia_mes smallint not null default 2,
  areas jsonb not null default '{"accesibilidad":true,"rendimiento":true,"seguridad":true,"textos":true,"codigo":true,"datos":true}'::jsonb,
  crear_tareas boolean not null default true,
  solo_criticas_y_altas boolean not null default false,       -- crear tareas solo para hallazgos críticos/altos
  max_hallazgos_por_proyecto smallint not null default 12,
  proyectos_excluidos uuid[] not null default '{}',
  actualizado_el timestamptz not null default now()
);
alter table public.auditoria_config enable row level security;
drop policy if exists "auditoria_config propia" on public.auditoria_config;
create policy "auditoria_config propia" on public.auditoria_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.auditorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lote text not null,                                         -- AAAA-MM o 'manual-<fecha>'
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  origen text not null default 'programado',
  estado text not null default 'pendiente',                   -- pendiente | analizando | terminada | error
  paso text,
  puntuacion smallint,                                        -- 0-100
  semaforo public.semaforo,
  resumen text,
  puntuaciones jsonb,                                         -- {accesibilidad, rendimiento, seguridad, textos, codigo, datos}
  hallazgos jsonb not null default '[]'::jsonb,               -- [{area, severidad (critica|alta|media|baja), titulo, detalle, donde, solucion, tarea_id}]
  material jsonb,                                             -- resumen de lo analizado (archivos, salud, calidad)
  tareas_creadas integer not null default 0,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  coste numeric not null default 0,
  error text,
  creado_el timestamptz not null default now(),
  terminada_el timestamptz
);
create index if not exists auditorias_lote_idx on public.auditorias(user_id, lote);
alter table public.auditorias enable row level security;
drop policy if exists "auditorias propias" on public.auditorias;
create policy "auditorias propias" on public.auditorias for select using (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.auditorias; exception when duplicate_object then null; end $$;

alter table public.proyectos add column if not exists puntuacion_auditoria smallint;
alter table public.proyectos add column if not exists auditoria_el timestamptz;

create or replace function public.lanzar_auditoria(p_accion text default 'programado', p_id uuid default null)
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/auditar', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion, 'auditoria_id', p_id));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'auditoria-mensual';
select cron.schedule('auditoria-mensual', '0 4 2 * *', $$select public.lanzar_auditoria('programado')$$);
