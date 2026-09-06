-- NexDeveloper · Migración 033 · Empresa emisora elegible por proyecto (MODEONTECNO S.L. o Soluciones EvoluteIA S.L.) · v0.33.0
-- Cada proyecto se factura desde la empresa de EvoluteIA que se elija; si no se elige, la empresa por defecto de la configuración.

create table if not exists public.facturacion_empresas (
  tenant_id uuid primary key,                       -- tenant en EvoluteIA
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null,
  sede_id uuid,
  forma_pago_id uuid,                               -- TRANSFERENCIA de ese tenant
  impuesto_id uuid,                                 -- IVA general 21 % de ese tenant
  nombre text not null,
  nif text,
  por_defecto boolean not null default false,
  activa boolean not null default true,
  actualizado_el timestamptz not null default now()
);
alter table public.facturacion_empresas enable row level security;
drop policy if exists "facturacion_empresas propias" on public.facturacion_empresas;
create policy "facturacion_empresas propias" on public.facturacion_empresas for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Semilla: las dos empresas del fabricante (la función las refresca desde EvoluteIA con «empresas»)
insert into public.facturacion_empresas (tenant_id, user_id, empresa_id, sede_id, forma_pago_id, impuesto_id, nombre, nif, por_defecto)
select v.tenant_id::uuid, u.id, v.empresa_id::uuid, v.sede_id::uuid, v.forma_pago_id::uuid, v.impuesto_id::uuid, v.nombre, v.nif, v.por_defecto
from (values
  ('0440f414-d6a3-4a34-934f-7e581d6e9881','fd85bcda-8ac1-4f8c-b4e3-387dc32d8df3','e285a4db-5d64-4c7b-aebf-5d2eb87fe98a','59dd844f-33be-424f-9fcb-dada4e8b5539','cec7b00a-ae37-4da6-8800-ed42afdc080f','MODEONTECNO S.L.','B56027097', true),
  ('11111111-2222-4333-8444-555555555555','11111111-2222-4333-8444-666666666666','07da6194-4716-fc76-cb63-e164bc7407aa','7ccd03b2-ae51-7ee0-5936-56aa5be2a317','9d4d95fd-14af-eef5-b7f6-e72e099dfcc6','SOLUCIONES EVOLUTEIA S.L.', null, false)
) as v(tenant_id, empresa_id, sede_id, forma_pago_id, impuesto_id, nombre, nif, por_defecto)
cross join (select id from auth.users order by created_at limit 1) u
on conflict (tenant_id) do nothing;

-- El proyecto elige su empresa emisora (null = la de por defecto)
alter table public.facturacion_clientes add column if not exists evoluteia_tenant_id uuid;
-- Las facturas en caché saben desde qué empresa se emitieron
alter table public.facturas_evoluteia add column if not exists tenant_id uuid;
alter table public.facturas_evoluteia add column if not exists empresa text;
create index if not exists facturas_evoluteia_tenant_idx on public.facturas_evoluteia(tenant_id);
