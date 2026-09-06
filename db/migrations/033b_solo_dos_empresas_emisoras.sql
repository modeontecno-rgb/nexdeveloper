-- NexDeveloper · Migración 033b · Solo dos empresas emisoras (v0.33.0)
-- Decisión de Javier (6/09/2026): SOLO pueden facturar MODEONTECNO S.L. y SOLUCIONES EVOLUTEIA S.L.; ninguna otra empresa de EvoluteIA
alter table public.facturacion_empresas drop constraint if exists facturacion_empresas_solo_fabricante;
alter table public.facturacion_empresas add constraint facturacion_empresas_solo_fabricante
  check (tenant_id in ('0440f414-d6a3-4a34-934f-7e581d6e9881','11111111-2222-4333-8444-555555555555'));
alter table public.facturacion_clientes drop constraint if exists facturacion_clientes_solo_fabricante;
alter table public.facturacion_clientes add constraint facturacion_clientes_solo_fabricante
  check (evoluteia_tenant_id is null or evoluteia_tenant_id in ('0440f414-d6a3-4a34-934f-7e581d6e9881','11111111-2222-4333-8444-555555555555'));
