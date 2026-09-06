-- NexDeveloper · Migración 029 · Facturación y horas por proyecto · v0.29.0

create table if not exists public.facturacion_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emisor jsonb not null default '{}'::jsonb,               -- {nombre, nif, direccion, cp, ciudad, email, telefono, iban, logo_url, pie}
  serie text not null default 'F',
  siguiente_numero integer not null default 1,
  moneda text not null default 'EUR',
  iva_pct numeric not null default 21,
  irpf_pct numeric not null default 0,
  tarifa_hora numeric not null default 45,                 -- tarifa por defecto si el proyecto no tiene la suya
  refacturar_ia boolean not null default true,             -- repercutir el gasto de IA al cliente
  recargo_ia_pct numeric not null default 20,              -- margen sobre el coste de IA
  dias_vencimiento integer not null default 30,
  redondeo_min integer not null default 15,                -- redondeo de las horas cronometradas
  generar_borradores_mes boolean not null default true,    -- el día 1 crea los borradores de los contratos mensuales
  texto_legal text,
  actualizado_el timestamptz not null default now()
);
alter table public.facturacion_config enable row level security;
drop policy if exists "facturacion_config propia" on public.facturacion_config;
create policy "facturacion_config propia" on public.facturacion_config for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Datos de facturación del cliente de cada proyecto (y su contrato)
create table if not exists public.facturacion_clientes (
  proyecto_id uuid primary key references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre_fiscal text,
  nif text,
  direccion text,
  email text,
  telefono text,
  contrato text not null default 'horas',                  -- horas | mensual | fijo | sin_facturar
  cuota_mensual numeric,                                   -- contrato mensual
  horas_incluidas numeric,                                 -- horas incluidas en la cuota (el resto se factura por horas)
  importe_fijo numeric,                                    -- contrato a precio cerrado
  tarifa_hora numeric,                                     -- si es nula, la de la configuración
  refacturar_ia boolean,                                   -- si es nulo, la de la configuración
  dia_facturacion integer not null default 1,
  notas text,
  actualizado_el timestamptz not null default now()
);
alter table public.facturacion_clientes enable row level security;
drop policy if exists "facturacion_clientes propios" on public.facturacion_clientes;
create policy "facturacion_clientes propios" on public.facturacion_clientes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registro de horas (manual, cronómetro o automático desde tareas/órdenes ejecutadas)
create table if not exists public.horas_registro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  tarea_id uuid references public.tareas(id) on delete set null,
  ejecucion_id uuid references public.ejecuciones_orden(id) on delete set null,
  fecha date not null default current_date,
  inicio timestamptz,
  fin timestamptz,
  horas numeric not null default 0,
  descripcion text,
  origen text not null default 'manual',                   -- manual | cronometro | tarea | ejecucion
  facturable boolean not null default true,
  factura_id uuid,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists horas_registro_proyecto_idx on public.horas_registro(proyecto_id, fecha desc);
create index if not exists horas_registro_factura_idx on public.horas_registro(factura_id);
create unique index if not exists horas_registro_ejecucion_uidx on public.horas_registro(ejecucion_id) where ejecucion_id is not null;
create unique index if not exists horas_registro_tarea_auto_uidx on public.horas_registro(tarea_id) where tarea_id is not null and origen = 'tarea';
alter table public.horas_registro enable row level security;
drop policy if exists "horas propias" on public.horas_registro;
create policy "horas propias" on public.horas_registro for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  numero text,                                             -- se asigna al emitir (serie-año-correlativo)
  estado text not null default 'borrador',                 -- borrador | emitida | enviada | pagada | vencida | anulada
  cliente jsonb not null default '{}'::jsonb,              -- instantánea de los datos del cliente
  emisor jsonb not null default '{}'::jsonb,               -- instantánea del emisor
  periodo_desde date,
  periodo_hasta date,
  lineas jsonb not null default '[]'::jsonb,               -- [{concepto, detalle, cantidad, unidad, precio, importe, tipo}]
  base numeric not null default 0,
  iva_pct numeric not null default 21,
  iva numeric not null default 0,
  irpf_pct numeric not null default 0,
  irpf numeric not null default 0,
  total numeric not null default 0,
  moneda text not null default 'EUR',
  horas numeric not null default 0,
  coste_ia numeric not null default 0,                     -- coste real de IA del periodo (para la rentabilidad)
  fecha_emision date,
  vence_el date,
  pagada_el date,
  enviada_el timestamptz,
  html text,
  ruta_remota text,
  documento_id uuid,
  notas text,
  error text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists facturas_proyecto_idx on public.facturas(proyecto_id, creado_el desc);
create unique index if not exists facturas_numero_uidx on public.facturas(user_id, numero) where numero is not null;
alter table public.facturas enable row level security;
drop policy if exists "facturas propias" on public.facturas;
create policy "facturas propias" on public.facturas for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.horas_registro drop constraint if exists horas_registro_factura_fk;
alter table public.horas_registro add constraint horas_registro_factura_fk foreign key (factura_id) references public.facturas(id) on delete set null;

do $$ begin
  alter publication supabase_realtime add table public.facturas;
  alter publication supabase_realtime add table public.horas_registro;
exception when duplicate_object then null; end $$;

-- Horas automáticas: al completar una tarea con horas consumidas, y al terminar una ejecución de la IA
create or replace function public.horas_desde_tarea() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.estado = 'completada' and coalesce(new.horas_consumidas, 0) > 0 and new.proyecto_id is not null and (old.estado is distinct from 'completada') then
    insert into public.horas_registro (user_id, proyecto_id, tarea_id, fecha, horas, descripcion, origen)
    values (new.user_id, new.proyecto_id, new.id, current_date, new.horas_consumidas, new.titulo, 'tarea')
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists horas_desde_tarea on public.tareas;
create trigger horas_desde_tarea after update on public.tareas for each row execute function public.horas_desde_tarea();

create or replace function public.horas_desde_ejecucion() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_horas numeric;
begin
  if new.estado = 'completada' and old.estado is distinct from 'completada' and new.proyecto_id is not null and new.iniciada_el is not null then
    v_horas := greatest(0.25, round(extract(epoch from (coalesce(new.terminada_el, now()) - new.iniciada_el)) / 3600.0, 2));
    insert into public.horas_registro (user_id, proyecto_id, tarea_id, ejecucion_id, fecha, inicio, fin, horas, descripcion, origen)
    values (new.user_id, new.proyecto_id, new.tarea_id, new.id, current_date, new.iniciada_el, coalesce(new.terminada_el, now()), v_horas, coalesce(new.resumen, left(new.texto, 120)), 'ejecucion')
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists horas_desde_ejecucion on public.ejecuciones_orden;
create trigger horas_desde_ejecucion after update on public.ejecuciones_orden for each row execute function public.horas_desde_ejecucion();

create or replace function public.lanzar_facturacion(p_accion text default 'programado')
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/facturacion', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'facturacion-mensual';
select cron.schedule('facturacion-mensual', '0 6 1 * *', $$select public.lanzar_facturacion('programado')$$);
select cron.unschedule(jobid) from cron.job where jobname = 'facturacion-vencidas';
select cron.schedule('facturacion-vencidas', '30 6 * * *', $$select public.lanzar_facturacion('vencidas')$$);
