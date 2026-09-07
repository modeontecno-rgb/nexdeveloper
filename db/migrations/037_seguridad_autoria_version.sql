-- ============================================================================
-- 037 · Seguridad, autoría «Powered by», versión real y WhatsApp
-- NexDeveloper · 7 de septiembre de 2026 · versión 0.37.0
-- Prueba asociada: auditoria/test_037_seguridad.sql (debe pasar de ROJO a VERDE)
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Vistas: que respeten la RLS del que consulta (antes se saltaban la RLS
--    y cualquiera con la clave pública podía leerlas enteras).
-- ---------------------------------------------------------------------------
alter view public.v_bandeja_fuentes        set (security_invoker = true);
alter view public.v_compilaciones_ultimas  set (security_invoker = true);
alter view public.v_dominios_resumen       set (security_invoker = true);
alter view public.v_gasto_ia_estado        set (security_invoker = true);
alter view public.v_gasto_ia_mes           set (security_invoker = true);
alter view public.v_gasto_ia_proyecto_mes  set (security_invoker = true);
alter view public.v_habilidades_resumen    set (security_invoker = true);
alter view public.v_vigilancia_resumen     set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 2. Funciones SECURITY DEFINER: el rol anónimo no ejecuta ninguna.
--    - Las de trigger no las ejecuta nadie por RPC (se disparan solas).
--    - Las demás conservan lo que ya tenían para «authenticated» y
--      «service_role» (las Edge Functions y el cron siguen igual).
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) as args,
           p.prorettype = 'trigger'::regtype as es_trigger,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as tenia_auth
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon', f.proname, f.args);
    if f.es_trigger then
      execute format('revoke execute on function public.%I(%s) from authenticated', f.proname, f.args);
    elsif f.tenia_auth then
      execute format('grant execute on function public.%I(%s) to authenticated', f.proname, f.args);
    end if;
    execute format('grant execute on function public.%I(%s) to service_role', f.proname, f.args);
  end loop;
end $$;

-- Las funciones que se creen a partir de ahora tampoco serán ejecutables por anon
-- por defecto (había que acordarse de revocarlo a mano cada vez).
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------------
-- 3. search_path fijo en la función de trigger que lo tenía mutable.
-- ---------------------------------------------------------------------------
alter function public.fn_tareas_fechas_estado() set search_path = public;

-- ---------------------------------------------------------------------------
-- 4. Autoría «Powered by» como datos (una fila, no código).
--    Se mantiene la clave antigua `powered_by` sincronizada por trigger para
--    que el pie del menú actual siga funcionando hasta que el frontend lea
--    las claves nuevas.
-- ---------------------------------------------------------------------------
insert into public.configuracion_app (clave, valor, descripcion) values
  ('autoria.powered_by',     'Modeontecno S.L.',            'Sociedad que figura en la leyenda «Powered by». Valores: Modeontecno S.L. | Soluciones EvoluteIA S.L.'),
  ('autoria.mostrar_en_pie', 'siempre',                     'Dónde se ve la leyenda: siempre | solo_marca_propia | nunca (en meta generator y en Acerca de va siempre)'),
  ('autoria.url',            'https://www.modeontecno.com', 'Enlace de la leyenda (vacío = sin enlace)')
on conflict (clave) do nothing;

create or replace function public.tg_sincronizar_powered_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.clave = 'autoria.powered_by' then
    update public.configuracion_app set valor = new.valor, actualizado_el = now()
     where clave = 'powered_by' and valor is distinct from new.valor;
  elsif new.clave = 'powered_by' then
    update public.configuracion_app set valor = new.valor, actualizado_el = now()
     where clave = 'autoria.powered_by' and valor is distinct from new.valor;
  end if;
  return new;
end $$;
revoke execute on function public.tg_sincronizar_powered_by() from public, anon, authenticated;

drop trigger if exists tr_sincronizar_powered_by on public.configuracion_app;
create trigger tr_sincronizar_powered_by
  after insert or update of valor on public.configuracion_app
  for each row execute function public.tg_sincronizar_powered_by();

-- Función pública (la necesitan las páginas sin sesión: acceso, portal del cliente).
create or replace function public.autoria()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'powered_by',     coalesce((select valor from public.configuracion_app where clave = 'autoria.powered_by'),
                               (select valor from public.configuracion_app where clave = 'powered_by'),
                               'Modeontecno S.L.'),
    'mostrar_en_pie', coalesce((select valor from public.configuracion_app where clave = 'autoria.mostrar_en_pie'), 'siempre'),
    'url',            coalesce((select valor from public.configuracion_app where clave = 'autoria.url'), ''),
    'version',        coalesce((select valor from public.configuracion_app where clave = 'version_app'), ''),
    'nombre_app',     coalesce((select valor from public.configuracion_app where clave = 'nombre_app'), 'NexDeveloper')
  );
$$;
grant execute on function public.autoria() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Versión real y WhatsApp con número.
-- ---------------------------------------------------------------------------
update public.configuracion_app set valor = '0.37.0', actualizado_el = now() where clave = 'version_app';
update public.configuracion_app set valor = 'https://wa.me/34615090000', actualizado_el = now() where clave = 'whatsapp_url';

commit;
