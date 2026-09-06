-- (Se aplica en EvoluteIA, Supabase eykvsbqwkvfnfiztehsy) · Módulo «NexDeveloper (solo fabricante)» · v0.32.0
-- Integración con NexDeveloper, el centro de control del fabricante. Estado PRIVADO: no se comercializa ni se activa a clientes de
-- EvoluteIA salvo que se decida venderles también NexDeveloper o enlazarlo con un sistema suyo (activación expresa en modulos_tenant).
insert into public.modulos (codigo, nombre, descripcion, version, tipo, requiere, icono, categoria, orden, estado, es_nucleo, plan, precio_mensual)
values ('nexdeveloper', 'NexDeveloper (solo fabricante)', 'Integración con NexDeveloper, el centro de control del fabricante: horas y gasto de IA por proyecto, facturas preparadas y emitidas desde allí (Verifactu incluido). Uso exclusivo de MODEONTECNO / Soluciones EvoluteIA: no se comercializa ni se activa a clientes salvo venta o enlace expreso de NexDeveloper.', '0.32.0', 'modulo', '{}', 'Cpu', 'Interno', 910, 'privado', false, null, null)
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, version = excluded.version, estado = 'privado', categoria = 'Interno';
insert into public.modulos_tenant (tenant_id, modulo, activo, activado_en) values
 ('0440f414-d6a3-4a34-934f-7e581d6e9881', 'nexdeveloper', true, now()),
 ('11111111-2222-4333-8444-555555555555', 'nexdeveloper', true, now())
on conflict do nothing;
create or replace function public.nexdeveloper_activo(p_tenant uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.modulos_tenant mt join public.modulos m on m.codigo = mt.modulo
                 where mt.modulo = 'nexdeveloper' and mt.activo and m.estado <> 'retirado'
                   and mt.tenant_id = coalesce(p_tenant, (select t from public.auth_tenants() t limit 1)));
$$;
