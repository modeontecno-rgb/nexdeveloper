-- NexDeveloper · Migración 022 · Restaurar copias con un clic + prueba mensual de restauración · v0.22.0

create table if not exists public.restauracion_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sandbox_ref text,                                   -- Supabase vacío para pruebas de restauración (opcional)
  prueba_mensual boolean not null default true,
  dia_prueba smallint not null default 1,
  proyecto_prueba_id uuid references public.proyectos(id) on delete set null,   -- si es nulo, se elige la copia más pequeña
  actualizado_el timestamptz not null default now()
);
alter table public.restauracion_config enable row level security;
drop policy if exists "restauracion_config propia" on public.restauracion_config;
create policy "restauracion_config propia" on public.restauracion_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.restauraciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  copia_id uuid references public.copias(id) on delete set null,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  tipo text not null,                                 -- base_datos | repositorio | prueba
  origen text not null default 'manual',              -- manual | programado
  ruta_remota text not null,
  destino text,                                       -- ref de Supabase o repositorio destino (usuario/repo)
  rama text,                                          -- para repositorios
  modo text not null default 'solo_datos',            -- solo_datos | esquema_y_datos | simulada
  estado text not null default 'en_cola',             -- en_cola | preparando | restaurando | completada | error | cancelada
  paso text,
  progreso jsonb not null default '{}'::jsonb,        -- {tablas_total, tablas_hechas, filas_hechas, archivos_total, archivos_hechos, pendientes:[...]}
  resultado jsonb,
  copia_previa text,                                  -- ruta de la copia de seguridad hecha antes de restaurar
  error text,
  iniciada_el timestamptz,
  terminada_el timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists restauraciones_user_idx on public.restauraciones(user_id, creado_el desc);
alter table public.restauraciones enable row level security;
drop policy if exists "restauraciones propias" on public.restauraciones;
create policy "restauraciones propias" on public.restauraciones for select using (user_id = auth.uid());

do $$ begin alter publication supabase_realtime add table public.restauraciones; exception when duplicate_object then null; end $$;

create or replace function public.lanzar_restauracion(p_accion text default 'programado', p_id uuid default null)
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/copias-restaurar', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion, 'restauracion_id', p_id));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'copias-prueba-mensual';
select cron.schedule('copias-prueba-mensual', '0 3 1 * *', $$select public.lanzar_restauracion('programado')$$);
