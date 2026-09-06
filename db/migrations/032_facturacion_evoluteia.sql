-- NexDeveloper · Migración 032 · Facturación con EvoluteIA (el ERP propio): terceros, contratos, facturas, Verifactu y cobros viven en EvoluteIA;
-- NexDeveloper aporta las horas y el gasto de IA por proyecto y prepara/emite las facturas allí · v0.32.0

-- Configuración del puente
alter table public.facturacion_config add column if not exists evoluteia_ref text not null default 'eykvsbqwkvfnfiztehsy';
alter table public.facturacion_config add column if not exists evoluteia_url text not null default 'https://evoluteia.lovable.app';
alter table public.facturacion_config add column if not exists evoluteia_tenant_id uuid default '0440f414-d6a3-4a34-934f-7e581d6e9881';   -- MODEONTECNO S.L.
alter table public.facturacion_config add column if not exists evoluteia_empresa_id uuid default 'fd85bcda-8ac1-4f8c-b4e3-387dc32d8df3';
alter table public.facturacion_config add column if not exists evoluteia_sede_id uuid default 'e285a4db-5d64-4c7b-aebf-5d2eb87fe98a';
alter table public.facturacion_config add column if not exists evoluteia_impuesto_id uuid default 'cec7b00a-ae37-4da6-8800-ed42afdc080f';  -- IVA general 21 %
alter table public.facturacion_config add column if not exists evoluteia_forma_pago_id uuid default '59dd844f-33be-424f-9fcb-dada4e8b5539'; -- TRANSFERENCIA
alter table public.facturacion_config add column if not exists evoluteia_usuario text default 'jromero@modeontecno.com';                   -- usuario de EvoluteIA (contraseña en Proyectian)
alter table public.facturacion_config add column if not exists modo text not null default 'evoluteia';                                       -- evoluteia | propio (retirado)

-- Enlace proyecto ↔ EvoluteIA
alter table public.facturacion_clientes add column if not exists tercero_id uuid;         -- terceros.id en EvoluteIA
alter table public.facturacion_clientes add column if not exists contrato_id uuid;        -- contratos.id en EvoluteIA (cuota mensual)
alter table public.facturacion_clientes add column if not exists tercero_codigo text;
alter table public.facturacion_clientes add column if not exists sincronizado_el timestamptz;

-- Horas: referencia a la factura de EvoluteIA (sustituye a factura_id)
alter table public.horas_registro add column if not exists evoluteia_documento_id uuid;
alter table public.horas_registro add column if not exists evoluteia_numero text;
create index if not exists horas_registro_evo_idx on public.horas_registro(evoluteia_documento_id);

-- Caché de lectura de las facturas de EvoluteIA de nuestros proyectos (para el resumen y la lista; se refresca desde la función)
create table if not exists public.facturas_evoluteia (
  documento_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  tercero_id uuid,
  numero text,
  fecha date,
  estado text,                                   -- borrador | emitido | cobrado | anulado …
  base numeric, cuota_iva numeric, total numeric,
  pendiente numeric,                             -- suma de vencimientos no cobrados
  vencido boolean not null default false,
  verifactu boolean not null default false,       -- registrada en registro_facturacion
  pdf_ruta text,
  horas numeric not null default 0,
  coste_ia numeric not null default 0,
  origen text not null default 'nexdeveloper',   -- nexdeveloper | evoluteia
  actualizado_el timestamptz not null default now()
);
alter table public.facturas_evoluteia enable row level security;
drop policy if exists "facturas_evoluteia propias" on public.facturas_evoluteia;
create policy "facturas_evoluteia propias" on public.facturas_evoluteia for select using (user_id = auth.uid());
do $$ begin alter publication supabase_realtime add table public.facturas_evoluteia; exception when duplicate_object then null; end $$;

-- La facturación propia de la 0.29.0 queda retirada: se conserva la tabla facturas (vacía) para no romper nada; no se usa.
comment on table public.facturas is 'RETIRADA en 0.32.0: la facturación se hace en EvoluteIA. Ver facturas_evoluteia.';
