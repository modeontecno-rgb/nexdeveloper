-- NexDeveloper · 035b · Arreglo de permisos de lectura de proveedores_ia (7/09/2026)
-- La pantalla Ajustes → Proveedores de IA salía vacía («No hay proveedores que coincidan con la búsqueda»):
-- la vista v_proveedores_ia (security_invoker) lee proveedores_ia y el rol authenticated no tenía SELECT sobre
-- la tabla (solo DELETE). RLS («proveedores propios», user_id = auth.uid()) sigue limitando a las filas propias.
-- La clave cifrada solo se escribe por la RPC guardar_clave_proveedor (UPDATE limitado por columnas).
grant select on public.proveedores_ia to authenticated;
grant update (activo, url_base, notas, cuenta, updated_at) on public.proveedores_ia to authenticated;
grant insert on public.proveedores_ia to authenticated;
revoke all on public.proveedores_ia from anon;
revoke all on public.v_proveedores_ia from anon;
grant select on public.v_proveedores_ia to authenticated;
