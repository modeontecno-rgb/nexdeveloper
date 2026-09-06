-- 011_vigilancia.sql — NexDeveloper 0.11.0 «Vigilancia»: vigía de novedades (semanal) y radar de competencia (mensual)

create table if not exists public.vigilancia_config (
  proyecto_id uuid primary key references public.proyectos(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  activa boolean not null default true,
  novedades_activas boolean not null default true,
  competencia_activa boolean not null default true,
  tecnologias text[] not null default '{}',
  temas_extra text[] not null default '{}',          -- palabras clave añadidas a mano
  sector text,                                        -- p. ej. «residencias de mayores»
  competidores_conocidos text[] not null default '{}',-- nombres o URLs que el usuario ya conoce
  idioma text not null default 'es',
  ultima_novedades timestamptz,
  ultima_competencia timestamptz,
  actualizado_el timestamptz not null default now()
);
alter table public.vigilancia_config enable row level security;
drop policy if exists vigilancia_config_propietario on public.vigilancia_config;
create policy vigilancia_config_propietario on public.vigilancia_config for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.vigilancia_lotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  tipo text not null,                 -- novedades | competencia
  origen text not null default 'manual', -- manual | programado
  estado text not null default 'en_curso', -- en_curso | ok | error
  proveedor text, modelo text,
  tokens_entrada int, tokens_salida int, coste numeric(10,4),
  busquedas int,
  resumen text,
  error text,
  hallazgos int not null default 0,
  iniciado_el timestamptz not null default now(),
  terminado_el timestamptz
);
alter table public.vigilancia_lotes enable row level security;
drop policy if exists vigilancia_lotes_propietario on public.vigilancia_lotes;
create policy vigilancia_lotes_propietario on public.vigilancia_lotes for select to authenticated using (user_id = auth.uid());

create table if not exists public.vigilancia_hallazgos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  lote_id uuid references public.vigilancia_lotes(id) on delete set null,
  tipo text not null,                 -- novedad | competencia
  categoria text,                     -- novedad: version | seguridad | funcionalidad | precio | fin_de_soporte | otro · competencia: nuevo_competidor | precio | funcionalidad | noticia
  titulo text not null,
  resumen text,
  por_que_afecta text,                -- «qué te afecta»
  accion_sugerida text,
  fuente_url text,
  fuente_nombre text,
  fecha_fuente date,
  relevancia text not null default 'media', -- alta | media | baja
  competidor_id uuid,
  estado text not null default 'nuevo',      -- nuevo | visto | descartado | convertido
  tarea_id uuid,
  creado_el timestamptz not null default now()
);
create index if not exists vigilancia_hallazgos_proy_idx on public.vigilancia_hallazgos(proyecto_id, creado_el desc);
alter table public.vigilancia_hallazgos enable row level security;
drop policy if exists vigilancia_hallazgos_propietario on public.vigilancia_hallazgos;
create policy vigilancia_hallazgos_propietario on public.vigilancia_hallazgos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.competidores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  nombre text not null,
  url text,
  pais text,
  descripcion text,
  precio_desde text,                  -- texto libre: «29 €/mes», «a medida»
  planes jsonb not null default '[]', -- [{nombre, precio, periodo, notas}]
  puntos_fuertes text[] not null default '{}',
  puntos_debiles text[] not null default '{}',
  origen text not null default 'radar',  -- radar | manual
  seguir boolean not null default true,
  ultima_revision timestamptz,
  ultimo_cambio text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),
  unique (proyecto_id, nombre)
);
alter table public.competidores enable row level security;
drop policy if exists competidores_propietario on public.competidores;
create policy competidores_propietario on public.competidores for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.vigilancia_hallazgos drop constraint if exists vigilancia_hallazgos_competidor_fk;
alter table public.vigilancia_hallazgos add constraint vigilancia_hallazgos_competidor_fk foreign key (competidor_id) references public.competidores(id) on delete set null;

create or replace view public.v_vigilancia_resumen as
  select p.id as proyecto_id, p.nombre,
    coalesce(c.activa, false) as activa,
    c.ultima_novedades, c.ultima_competencia,
    (select count(*) from public.vigilancia_hallazgos h where h.proyecto_id = p.id and h.estado = 'nuevo') as nuevos,
    (select count(*) from public.vigilancia_hallazgos h where h.proyecto_id = p.id and h.estado = 'nuevo' and h.relevancia = 'alta') as nuevos_alta,
    (select count(*) from public.competidores k where k.proyecto_id = p.id and k.seguir) as competidores
  from public.proyectos p left join public.vigilancia_config c on c.proyecto_id = p.id;

-- Configuración inicial para todos los proyectos existentes (tecnologías desde la ficha)
insert into public.vigilancia_config (proyecto_id, user_id, tecnologias)
select id, user_id, coalesce(string_to_array(regexp_replace(coalesce(tecnologias,''), '\s*,\s*', ',', 'g'), ','), '{}')
from public.proyectos where not exists (select 1 from public.vigilancia_config v where v.proyecto_id = proyectos.id);
update public.vigilancia_config set tecnologias = array_remove(tecnologias, '');

-- Lanzadores programados (pg_cron + pg_net con x-cron-token)
create or replace function public.lanzar_vigilancia(p_tipo text)
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/vigilar',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion','programado','tipo', p_tipo));
end $$;
select cron.unschedule(jobid) from cron.job where jobname in ('vigilancia-novedades','vigilancia-competencia');
select cron.schedule('vigilancia-novedades',  '30 5 * * 1', $$select public.lanzar_vigilancia('novedades')$$);   -- lunes 05:30 UTC
select cron.schedule('vigilancia-competencia','0 6 1 * *',  $$select public.lanzar_vigilancia('competencia')$$); -- día 1 de cada mes 06:00 UTC
alter publication supabase_realtime add table public.vigilancia_lotes;
