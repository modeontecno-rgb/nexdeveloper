-- Alinea la tabla privada con el guion 004 del repositorio (columna «clave», fila «clave_cifrado»)
alter table private.claves_sistema rename column nombre to clave;
update private.claves_sistema set clave='clave_cifrado' where clave='clave_cifrado_proveedores';
create or replace function private.clave_cifrado()
returns text language sql stable security definer set search_path = private, public as $$
  select valor from private.claves_sistema where clave = 'clave_cifrado'
$$;
revoke all on function private.clave_cifrado() from public, anon, authenticated;
