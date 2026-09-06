create or replace function public.leer_claves_vapid()
returns table(publica text, privada text) language plpgsql security definer set search_path to 'private','public' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  return query select (select valor from private.claves_sistema where clave='vapid_publica'), (select valor from private.claves_sistema where clave='vapid_privada');
end $$;
create or replace function public.guardar_claves_vapid(p_publica text, p_privada text)
returns void language plpgsql security definer set search_path to 'private','public' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  insert into private.claves_sistema (clave, valor) values ('vapid_publica', p_publica), ('vapid_privada', p_privada)
  on conflict (clave) do update set valor = excluded.valor;
end $$;
revoke all on function public.leer_claves_vapid() from public, anon, authenticated;
revoke all on function public.guardar_claves_vapid(text,text) from public, anon, authenticated;
