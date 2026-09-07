-- REFERENCE ONLY: extracted definitions; not ordered for deployment.

CREATE OR REPLACE FUNCTION private.clave_cifrado()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
  select valor from private.claves_sistema where clave = 'clave_cifrado'
$function$
;

CREATE OR REPLACE FUNCTION public.actualizar_semaforo_proyecto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.estado in ('verde','ambar','rojo') and (old.estado is distinct from new.estado) then
    update public.proyectos set semaforo_calidad = new.estado::text::semaforo_calidad, ultima_ejecucion_calidad_id = new.id where id = new.proyecto_id;
  end if;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.agregar_consumos_ia(p_user_id uuid, p_desde date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int := 0;
begin
  insert into public.gasto_ia_diario (user_id, fecha, proveedor, fuente, proyecto_id, modelo, tokens_entrada, tokens_salida, llamadas, coste, actualizado_el)
  select c.user_id, c.created_at::date, coalesce(p.clave_slug,'otro'), 'interno', c.proyecto_id, m.identificador,
         sum(coalesce(c.tokens_entrada,0)), sum(coalesce(c.tokens_salida,0)), count(*), sum(coalesce(c.coste,0)), now()
  from public.consumos_ia c left join public.modelos_ia m on m.id = c.modelo_id left join public.proveedores_ia p on p.id = m.proveedor_id
  where c.user_id = p_user_id and c.created_at::date >= p_desde
  group by c.user_id, c.created_at::date, p.clave_slug, c.proyecto_id, m.identificador
  on conflict (user_id, fecha, proveedor, fuente, proyecto_id, modelo) do update
    set tokens_entrada = excluded.tokens_entrada, tokens_salida = excluded.tokens_salida, llamadas = excluded.llamadas, coste = excluded.coste, actualizado_el = now();
  get diagnostics n = row_count; return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.asistente_consulta(p_user uuid, p_sql text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; s text := btrim(p_sql);
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  s := regexp_replace(s, ';\s*$', '');
  if s !~* '^\s*(select|with)\M' or s ~ ';' or s ~* '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|pg_sleep)\M' then
    raise exception 'Solo se permiten consultas SELECT de una sola sentencia';
  end if;
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s limit 200) t', s) into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.autoria()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'powered_by',     coalesce((select valor from public.configuracion_app where clave = 'autoria.powered_by'),
                               (select valor from public.configuracion_app where clave = 'powered_by'),
                               'Modeontecno S.L.'),
    'mostrar_en_pie', coalesce((select valor from public.configuracion_app where clave = 'autoria.mostrar_en_pie'), 'siempre'),
    'url',            coalesce((select valor from public.configuracion_app where clave = 'autoria.url'), ''),
    'version',        coalesce((select valor from public.configuracion_app where clave = 'version_app'), ''),
    'nombre_app',     coalesce((select valor from public.configuracion_app where clave = 'nombre_app'), 'NexDeveloper')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.avisos_desde_compilaciones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_nombre text;
begin
  if new.estado in ('ok','error') and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    select nombre into v_nombre from public.proyectos where id = new.proyecto_id;
    perform public.crear_aviso(new.user_id, 'compilacion',
      case when new.estado = 'ok' then 'Compilación lista: ' else 'Compilación con error: ' end || coalesce(v_nombre,'') || ' (' || coalesce(new.plataforma,'') || ')',
      coalesce(new.artefacto_nombre, new.error, ''), '/compilaciones?compilacion=' || new.id::text, new.proyecto_id, new.id::text || ':' || new.estado);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.avisos_desde_dominios()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_dias int;
begin
  v_dias := least(coalesce(new.cert_dias, 9999), coalesce(new.dominio_dias, 9999));
  if new.activo and v_dias <= coalesce(new.aviso_dias, 15) and (old.ultima_comprobacion is distinct from new.ultima_comprobacion) then
    perform public.crear_aviso(new.user_id, 'dominio', 'Caduca en ' || v_dias || ' días: ' || new.dominio,
      case when coalesce(new.cert_dias,9999) <= coalesce(new.dominio_dias,9999) then 'Certificado' else 'Dominio' end || ' · ' || coalesce(new.resultado,''), '/dominios', new.proyecto_id, new.id::text || ':' || to_char(now(),'IYYY-IW'));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.avisos_desde_presupuestos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (new.avisado_mes is distinct from old.avisado_mes and new.avisado_mes is not null) or (new.bloqueado and not coalesce(old.bloqueado,false)) then
    perform public.crear_aviso(new.user_id, 'presupuesto',
      case when new.bloqueado then 'Presupuesto de IA BLOQUEADO' else 'Presupuesto de IA al ' || coalesce(new.aviso_pct,80) || ' %' end || ' · ' || coalesce(new.referencia, new.ambito),
      'Límite mensual ' || new.limite_mensual || ' €', '/gasto-ia', null, new.id::text || ':' || coalesce(new.avisado_mes::text,'b') || ':' || new.bloqueado::text);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.avisos_desde_tareas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_tipo text; v_nombre text;
begin
  if coalesce(new.requiere_atencion,false) and (tg_op = 'INSERT' or coalesce(old.requiere_atencion,false) = false) then
    select nombre into v_nombre from public.proyectos where id = new.proyecto_id;
    v_tipo := case
      when new.motivo_atencion ilike 'Aprobar y publicar%' then 'aprobacion'
      when new.motivo_atencion ilike 'Salud%' then 'salud'
      when new.motivo_atencion ilike '%copias%' then 'copias'
      else 'tarea_atencion' end;
    perform public.crear_aviso(new.user_id, v_tipo, coalesce(v_nombre || ': ', '') || new.titulo, coalesce(new.instrucciones, new.descripcion, ''), '/tareas?tarea=' || new.id::text, new.proyecto_id, new.id::text);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.avisos_tras_insertar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.lanzar_avisos();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.comprobar_cron_token(p_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
  select exists (select 1 from private.claves_sistema where clave = 'cron_token' and valor = p_token and p_token is not null and p_token <> '');
$function$
;

CREATE OR REPLACE FUNCTION public.copias_auto_dispatch(p_periodicidad text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c record;
begin
  for c in select * from public.copias_config where auto_activa
             and ((p_periodicidad = 'diaria' and diaria) or (p_periodicidad = 'semanal' and semanal)) loop
    begin
      perform public.lanzar_copias(c.user_id, p_periodicidad);
    exception when others then raise notice 'copias auto %: %', c.user_id, sqlerrm; end;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.crear_aviso(p_user uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_proyecto uuid, p_referencia text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.avisos (user_id, tipo, titulo, cuerpo, url, proyecto_id, referencia)
  values (p_user, p_tipo, p_titulo, left(p_cuerpo, 300), p_url, p_proyecto, p_referencia)
  on conflict (user_id, tipo, referencia) where referencia is not null do nothing;
end $function$
;

CREATE OR REPLACE FUNCTION public.descifrar_clave_proveedor(p_proveedor_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_key text := private.clave_cifrado();
  v_cifrada text;
begin
  select clave_cifrada into v_cifrada from public.proveedores_ia where id = p_proveedor_id;
  if v_cifrada is null then return null; end if;
  return pgp_sym_decrypt(decode(v_cifrada, 'base64'), v_key);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_tareas_fechas_estado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.estado = 'ejecutando' and old.estado is distinct from 'ejecutando' then new.enviada_el = now(); end if;
  if new.estado = 'completada' and old.estado is distinct from 'completada' and new.completada_el is null then new.completada_el = now(); end if;
  if new.estado = 'cancelada' and old.estado is distinct from 'cancelada' and new.cancelada_el is null then new.cancelada_el = now(); end if;
  if new.estado in ('pendiente','en_cola','ejecutando') then new.completada_el = null; new.cancelada_el = null; end if;
  new.actualizado_el = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.gasto_ia_permitido(p_user_id uuid, p_proveedor text DEFAULT NULL::text, p_proyecto_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select not exists (
    select 1 from public.v_gasto_ia_estado e where e.user_id = p_user_id and e.accion = 'bloquear' and e.gastado_mes >= e.limite_mensual
      and (e.ambito = 'global' or (e.ambito = 'proveedor' and e.referencia = p_proveedor) or (e.ambito = 'proyecto' and e.referencia = p_proyecto_id::text)));
$function$
;

CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$
;

CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$
;

CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$
;

CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)
 RETURNS "char"
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_compress$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_consistent$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_decompress$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_distance$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_in$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)
 RETURNS void
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE
AS '$libdir/pg_trgm', $function$gtrgm_options$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_out$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_penalty$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_same$function$
;

CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_union$function$
;

CREATE OR REPLACE FUNCTION public.guardar_clave_proveedor(p_proveedor_id uuid, p_clave text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_key text := private.clave_cifrado();
begin
  if v_key is null or v_key = '' then
    raise exception 'No hay clave de cifrado configurada en la base de datos';
  end if;
  update public.proveedores_ia
     set clave_cifrada = case
           when p_clave is null or p_clave = '' then null
           else encode(pgp_sym_encrypt(p_clave, v_key), 'base64')
         end,
         updated_at = now()
   where id = p_proveedor_id
     and user_id = auth.uid();
  if not found then
    raise exception 'Proveedor no encontrado';
  end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guardar_claves_vapid(p_publica text, p_privada text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  insert into private.claves_sistema (clave, valor) values ('vapid_publica', p_publica), ('vapid_privada', p_privada)
  on conflict (clave) do update set valor = excluded.valor;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardar_secreto_bandeja(p_fuente_id uuid, p_secreto text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado();
begin
  if v_key is null or v_key = '' then raise exception 'No hay clave de cifrado configurada'; end if;
  update public.bandeja_fuentes set secreto_cifrado = case when p_secreto is null or p_secreto = '' then null else encode(pgp_sym_encrypt(p_secreto, v_key),'base64') end, actualizado_el = now()
   where id = p_fuente_id and (user_id = auth.uid() or coalesce(auth.role(),'') = 'service_role');
  if not found then raise exception 'Fuente no encontrada'; end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardar_secreto_conexion(p_user_id uuid, p_proveedor text, p_refresh text, p_acceso text, p_expira timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  if v_key is null or v_key = '' then raise exception 'No hay clave de cifrado configurada'; end if;
  insert into public.conexiones_externas (user_id, proveedor) values (p_user_id, p_proveedor) on conflict do nothing;
  update public.conexiones_externas set
    secreto_cifrado = case when p_refresh is null then secreto_cifrado when p_refresh = '' then null else encode(pgp_sym_encrypt(p_refresh, v_key),'base64') end,
    acceso_cifrado  = case when p_acceso  is null then acceso_cifrado  when p_acceso  = '' then null else encode(pgp_sym_encrypt(p_acceso,  v_key),'base64') end,
    expira_el = coalesce(p_expira, expira_el), actualizado_el = now()
  where user_id = p_user_id and proveedor = p_proveedor;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardar_secreto_copias(p_destino_id uuid, p_secreto text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado();
begin
  if v_key is null or v_key = '' then raise exception 'No hay clave de cifrado configurada'; end if;
  update public.copias_destinos
     set secreto_cifrado = case when p_secreto is null or p_secreto = '' then null else encode(pgp_sym_encrypt(p_secreto, v_key),'base64') end,
         actualizado_el = now()
   where id = p_destino_id and user_id = auth.uid();
  if not found then raise exception 'Destino no encontrado'; end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardar_secreto_copias_servicio(p_destino_id uuid, p_secreto text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  if v_key is null or v_key = '' then raise exception 'No hay clave de cifrado configurada'; end if;
  update public.copias_destinos set secreto_cifrado = case when p_secreto is null or p_secreto = '' then null else encode(pgp_sym_encrypt(p_secreto, v_key),'base64') end, actualizado_el = now() where id = p_destino_id;
  if not found then raise exception 'Destino no encontrado'; end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardar_secreto_lovable(p_user_id uuid, p_refresh text, p_acceso text, p_expira timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  if v_key is null or v_key = '' then raise exception 'No hay clave de cifrado configurada'; end if;
  update public.lovable_conexion set
    secreto_cifrado = case when p_refresh is null then secreto_cifrado when p_refresh = '' then null else encode(pgp_sym_encrypt(p_refresh, v_key),'base64') end,
    acceso_cifrado  = case when p_acceso  is null then acceso_cifrado  when p_acceso  = '' then null else encode(pgp_sym_encrypt(p_acceso,  v_key),'base64') end,
    expira_el = coalesce(p_expira, expira_el), actualizado_el = now()
  where user_id = p_user_id;
  if not found then raise exception 'Conexión no encontrada'; end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.perfiles (id, nombre_completo, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  insert into public.ajustes (user_id) values (new.id) on conflict (user_id) do nothing;
  perform public.sembrar_catalogos(new.id);
  perform public.sembrar_plantillas_accion(new.id);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.horas_desde_ejecucion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_horas numeric;
begin
  if new.estado = 'completada' and old.estado is distinct from 'completada' and new.proyecto_id is not null and new.iniciada_el is not null then
    v_horas := greatest(0.25, round(extract(epoch from (coalesce(new.terminada_el, now()) - new.iniciada_el)) / 3600.0, 2));
    insert into public.horas_registro (user_id, proyecto_id, tarea_id, ejecucion_id, fecha, inicio, fin, horas, descripcion, origen)
    values (new.user_id, new.proyecto_id, new.tarea_id, new.id, current_date, new.iniciada_el, coalesce(new.terminada_el, now()), v_horas, coalesce(new.resumen, left(new.texto, 120)), 'ejecucion')
    on conflict do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.horas_desde_tarea()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.estado = 'completada' and coalesce(new.horas_consumidas, 0) > 0 and new.proyecto_id is not null and (old.estado is distinct from 'completada') then
    insert into public.horas_registro (user_id, proyecto_id, tarea_id, fecha, horas, descripcion, origen)
    values (new.user_id, new.proyecto_id, new.id, current_date, new.horas_consumidas, new.titulo, 'tarea')
    on conflict do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.incrementar_conversacion(p_id uuid, p_te integer, p_ts integer, p_coste numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.asistente_conversaciones set tokens_entrada = tokens_entrada + coalesce(p_te,0), tokens_salida = tokens_salida + coalesce(p_ts,0), coste = coste + coalesce(p_coste,0), actualizado_el = now() where id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.incrementar_conversacion_personal(p_id uuid, p_coste numeric DEFAULT 0)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.personal_conversaciones set mensajes = mensajes + 2, coste = coste + coalesce(p_coste,0), ultimo_mensaje_el = now(), actualizado_el = now() where id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.lanzar_auditoria(p_accion text DEFAULT 'programado'::text, p_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/auditar', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion, 'auditoria_id', p_id));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_avisos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/avisos', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','enviar_pendientes'));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_bandeja_sincronizar()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  if not exists (select 1 from public.bandeja_fuentes where activa and origen = 'gmail' and secreto_cifrado is not null) then return; end if;
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/bandeja', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado'));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_barrido_expertos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/barrer-expertos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', v_token),
    body := jsonb_build_object('programado', true)
  );
end; $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_barrido_habilidades()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/habilidades', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado'));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_comprobacion_dominios()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/dominios-comprobar', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado'));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_comprobacion_dominios_continuar()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/dominios-comprobar', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado','continuar', true));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_copias(p_user_id uuid, p_origen text DEFAULT 'manual'::text, p_tipos text[] DEFAULT ARRAY['base_datos'::text, 'repositorio'::text])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare
  v_cfg public.copias_config%rowtype;
  v_lote uuid := gen_random_uuid();
  v_url text; v_token text; r record;
begin
  select * into v_cfg from public.copias_config where user_id = p_user_id;
  if v_cfg.user_id is null or v_cfg.destino_id is null then raise exception 'No hay destino de copias configurado'; end if;
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';

  if 'base_datos' = any(p_tipos) then
    for r in select * from public.copias_origenes o where o.user_id = p_user_id and o.tipo = 'base_datos'
              and (v_cfg.bases_datos_todas or o.objetivo = any(v_cfg.bases_datos_seleccion)) loop
      insert into public.copias(user_id, destino_id, lote_id, tipo, origen, objetivo, nombre) values (p_user_id, v_cfg.destino_id, v_lote, 'base_datos', p_origen, r.objetivo, r.nombre);
    end loop;
  end if;
  if 'repositorio' = any(p_tipos) then
    for r in select * from public.copias_origenes o where o.user_id = p_user_id and o.tipo = 'repositorio'
              and (v_cfg.repositorios_todos or o.objetivo = any(v_cfg.repositorios_seleccion)) loop
      insert into public.copias(user_id, destino_id, lote_id, tipo, origen, objetivo, nombre) values (p_user_id, v_cfg.destino_id, v_lote, 'repositorio', p_origen, r.objetivo, r.nombre);
    end loop;
  end if;

  -- Una petición por copia; la función procesa una y encadena la siguiente del lote
  perform net.http_post(
    url := v_url || '/copias-generar',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion','procesar_lote','lote_id', v_lote)
  );
  if p_origen <> 'manual' then update public.copias_config set ultima_auto = now() where user_id = p_user_id; end if;
  return v_lote;
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_ejecucion_ordenes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  if not exists (select 1 from public.ejecuciones_orden where estado in ('en_cola','enviando','construyendo','comprobando','publicando'))
     and not exists (select 1 from public.ordenes o join public.ejecucion_config c on c.user_id = o.user_id and c.auto_ejecutar
                     where o.estado = 'aprobada' and o.ejecucion_id is null and o.ejecutar_con = 'lovable' and coalesce(o.requiere_atencion,false) = false) then
    return;
  end if;
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/ordenes-ejecutar',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion','programado'));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_facturacion(p_accion text DEFAULT 'programado'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/facturacion', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_gasto_ia()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/gasto-ia', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado'));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_infraestructura(p_accion text DEFAULT 'programado'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/infraestructura', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_manuales(p_accion text DEFAULT 'programado'::text, p_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/manuales', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion, 'manual_id', p_id));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_mis_copias(p_tipos text[] DEFAULT ARRAY['base_datos'::text, 'repositorio'::text])
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.lanzar_copias(auth.uid(), 'manual', p_tipos);
$function$
;

CREATE OR REPLACE FUNCTION public.lanzar_plaud(p_accion text DEFAULT 'programado'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/pideme', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_restauracion(p_accion text DEFAULT 'programado'::text, p_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/copias-restaurar', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion, 'restauracion_id', p_id));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_resumen(p_tipo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/resumenes', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado','tipo', p_tipo));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_salud(p_accion text DEFAULT 'programado'::text, p_informe uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/salud',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion', p_accion, 'informe_id', p_informe));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_sincronizacion_calidad()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text; v_abiertas integer;
begin
  select count(*) into v_abiertas from public.ejecuciones_calidad where estado in ('en_cola','ejecutando');
  if v_abiertas = 0 then return; end if;
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(url := v_url || '/calidad-github',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion','sincronizar','programado', true));
end; $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_sincronizacion_compilaciones()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  if not exists (select 1 from public.compilaciones where estado in ('enviada','en_curso')) then return; end if;
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/compilar-app',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion','sincronizar','programado', true));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_sincronizacion_proyectian(p_accion text DEFAULT 'todo'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(url := v_url || '/sincronizar-proyectian',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion', p_accion));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_usuarios_clientes(p_accion text DEFAULT 'programado'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/usuarios-clientes', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion', p_accion));
end $function$
;

CREATE OR REPLACE FUNCTION public.lanzar_vigilancia(p_tipo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/vigilar',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion','programado','tipo', p_tipo));
end $function$
;

CREATE OR REPLACE FUNCTION public.leer_claves_vapid()
 RETURNS TABLE(publica text, privada text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  return query select (select valor from private.claves_sistema where clave='vapid_publica'), (select valor from private.claves_sistema where clave='vapid_privada');
end $function$
;

CREATE OR REPLACE FUNCTION public.leer_cron_token()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare v text; begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  select valor into v from private.claves_sistema where clave = 'cron_token'; return v; end $function$
;

CREATE OR REPLACE FUNCTION public.leer_destino_copias(p_destino_id uuid)
 RETURNS TABLE(user_id uuid, tipo text, url_servidor text, bucket text, region text, ruta_prefijo text, usuario text, secreto text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  return query select d.user_id, d.tipo, d.url_servidor, d.bucket, d.region, coalesce(d.ruta_prefijo,''), d.usuario,
    case when d.secreto_cifrado is null then null else pgp_sym_decrypt(decode(d.secreto_cifrado,'base64'), v_key) end
  from public.copias_destinos d where d.id = p_destino_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.leer_secreto_bandeja(p_fuente_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado(); v text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  select case when secreto_cifrado is null then null else pgp_sym_decrypt(decode(secreto_cifrado,'base64'), v_key) end into v from public.bandeja_fuentes where id = p_fuente_id;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.leer_secretos_conexion(p_user_id uuid, p_proveedor text)
 RETURNS TABLE(refresh_token text, access_token text, expira_el timestamp with time zone, client_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  return query select
    case when c.secreto_cifrado is null then null else pgp_sym_decrypt(decode(c.secreto_cifrado,'base64'), v_key) end,
    case when c.acceso_cifrado  is null then null else pgp_sym_decrypt(decode(c.acceso_cifrado,'base64'),  v_key) end,
    c.expira_el, c.client_id
  from public.conexiones_externas c where c.user_id = p_user_id and c.proveedor = p_proveedor;
end $function$
;

CREATE OR REPLACE FUNCTION public.leer_secretos_lovable(p_user_id uuid)
 RETURNS TABLE(refresh_token text, access_token text, expira_el timestamp with time zone, client_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_key text := private.clave_cifrado();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Solo el servicio'; end if;
  return query select
    case when c.secreto_cifrado is null then null else pgp_sym_decrypt(decode(c.secreto_cifrado,'base64'), v_key) end,
    case when c.acceso_cifrado  is null then null else pgp_sym_decrypt(decode(c.acceso_cifrado,'base64'),  v_key) end,
    c.expira_el, c.client_id
  from public.lovable_conexion c where c.user_id = p_user_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.nex_corregir_nombres(p_user_id uuid, p_texto text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_texto text := coalesce(p_texto, '');
  v_corr jsonb := '[]'::jsonb;
  r record;
  v_var text;
  v_pat text;
  v_antes text;
begin
  for r in
    select termino, variantes
    from public.diccionario_nombres
    where user_id = p_user_id and activo
  loop
    foreach v_var in array coalesce(r.variantes, '{}'::text[])
    loop
      if v_var is null or length(btrim(v_var)) < 3 then
        continue;
      end if;
      v_pat := '\m' || regexp_replace(btrim(v_var), '([.^$|()\[\]*+?{}\\])', '\\\1', 'g') || '\M';
      v_antes := v_texto;
      v_texto := regexp_replace(v_texto, v_pat, r.termino, 'gi');
      if v_texto is distinct from v_antes then
        v_corr := v_corr || jsonb_build_object('de', v_var, 'a', r.termino, 'tipo', 'variante', 'aplicada', true);
      end if;
    end loop;
  end loop;

  for r in
    select pal.palabra, d.termino, similarity(lower(pal.palabra), lower(d.termino)) as s
    from (
      select distinct regexp_split_to_table(v_texto, '[^[:alnum:]ÁÉÍÓÚÜÑáéíóúüñ]+') as palabra
    ) pal
    join public.diccionario_nombres d
      on d.user_id = p_user_id
     and d.activo
     and lower(pal.palabra) <> lower(d.termino)
     and similarity(lower(pal.palabra), lower(d.termino)) > 0.55
    where length(pal.palabra) >= 5
    order by s desc
    limit 12
  loop
    v_corr := v_corr || jsonb_build_object('de', r.palabra, 'a', r.termino, 'tipo', 'sugerencia', 'aplicada', false);
  end loop;

  return jsonb_build_object('texto', v_texto, 'correcciones', v_corr);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nex_pideme_aprender(p_id uuid, p_de text, p_a text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_u uuid := auth.uid(); v_texto text;
begin
  select texto into v_texto from public.peticiones_directas where id = p_id and user_id = v_u;
  if v_texto is null then raise exception 'petición no encontrada'; end if;

  v_texto := regexp_replace(v_texto,
      '\m' || regexp_replace(btrim(p_de), '([.^$|()\[\]*+?{}\\])', '\\\1', 'g') || '\M',
      p_a, 'gi');

  insert into public.diccionario_nombres (user_id, termino, variantes, origen)
  values (v_u, p_a, array[lower(btrim(p_de))], 'aprendido')
  on conflict (user_id, termino) do update
    set variantes = coalesce((select array_agg(distinct x)
            from unnest(public.diccionario_nombres.variantes || array[lower(btrim(p_de))]) as x), '{}'::text[]),
        usos = public.diccionario_nombres.usos + 1,
        actualizado_el = now();

  update public.peticiones_directas
     set texto = v_texto,
         correcciones = correcciones || jsonb_build_object('de', p_de, 'a', p_a, 'tipo', 'aprendida', 'aplicada', true),
         actualizado_el = now()
   where id = p_id and user_id = v_u;
  return v_texto;
end; $function$
;

CREATE OR REPLACE FUNCTION public.nex_pideme_borrador(p_texto text, p_origen text DEFAULT 'plaud'::text, p_grabacion_id uuid DEFAULT NULL::uuid, p_proyecto_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_u uuid := auth.uid(); v_res jsonb; v_id uuid;
begin
  if v_u is null then raise exception 'sin sesión'; end if;
  v_res := public.nex_corregir_nombres(v_u, p_texto);
  insert into public.peticiones_directas (user_id, texto, texto_original, origen, estado,
                                          correcciones, grabacion_id, proyecto_id)
  values (v_u, v_res->>'texto', p_texto, coalesce(p_origen,'plaud'), 'borrador',
          coalesce(v_res->'correcciones','[]'::jsonb), p_grabacion_id, p_proyecto_id)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'texto', v_res->>'texto',
                            'texto_original', p_texto, 'correcciones', v_res->'correcciones');
end; $function$
;

CREATE OR REPLACE FUNCTION public.nex_pideme_descartar(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.peticiones_directas set estado = 'descartada', actualizado_el = now()
   where id = p_id and user_id = auth.uid() and estado = 'borrador';
end; $function$
;

CREATE OR REPLACE FUNCTION public.nex_pideme_guardar_borrador(p_id uuid, p_texto text DEFAULT NULL::text, p_aclaraciones text DEFAULT NULL::text, p_proyecto_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.peticiones_directas
     set texto = coalesce(p_texto, texto),
         aclaraciones = coalesce(p_aclaraciones, aclaraciones),
         proyecto_id = coalesce(p_proyecto_id, proyecto_id),
         actualizado_el = now()
   where id = p_id and user_id = auth.uid() and estado = 'borrador';
  if not found then raise exception 'borrador no encontrado o ya lanzado'; end if;
end; $function$
;

CREATE OR REPLACE FUNCTION public.nex_pideme_lanzar(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_u uuid := auth.uid(); v_p record; v_hilo text; v_final text;
begin
  select * into v_p from public.peticiones_directas where id = p_id and user_id = v_u;
  if v_p.id is null then raise exception 'petición no encontrada'; end if;

  select string_agg(texto, E'\n' order by creado_el) into v_hilo
    from public.peticiones_mensajes where peticion_id = p_id and rol = 'usuario';

  v_final := v_p.texto
    || case when coalesce(btrim(v_p.aclaraciones),'') <> ''
            then E'\n\nAclaraciones: ' || v_p.aclaraciones else '' end
    || case when coalesce(btrim(v_hilo),'') <> ''
            then E'\n\nNotas añadidas: ' || v_hilo else '' end;

  update public.peticiones_directas
     set revisada = true, estado = 'lanzada', lanzada_el = now(), actualizado_el = now()
   where id = p_id;

  return jsonb_build_object('id', p_id, 'texto_final', v_final, 'proyecto_id', v_p.proyecto_id);
end; $function$
;

CREATE OR REPLACE FUNCTION public.nex_pideme_mensaje(p_id uuid, p_texto text, p_rol text DEFAULT 'usuario'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_u uuid := auth.uid(); v_msg uuid;
begin
  if not exists (select 1 from public.peticiones_directas where id = p_id and user_id = v_u) then
    raise exception 'petición no encontrada';
  end if;
  insert into public.peticiones_mensajes (peticion_id, user_id, rol, texto)
  values (p_id, v_u, coalesce(p_rol,'usuario'), p_texto) returning id into v_msg;
  return v_msg;
end; $function$
;

CREATE OR REPLACE FUNCTION public.nex_pideme_vincular(p_borrador_id uuid, p_peticion_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.peticiones_directas
     set propuesta = coalesce(propuesta,'{}'::jsonb) || jsonb_build_object('peticion_lanzada', p_peticion_id),
         actualizado_el = now()
   where id = p_borrador_id and user_id = auth.uid();
end; $function$
;

CREATE OR REPLACE FUNCTION public.nex_sembrar_diccionario(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_n integer := 0;
begin
  insert into public.diccionario_nombres (user_id, termino, variantes, proyecto_id, origen)
  select p.user_id,
         p.nombre,
         coalesce((select array_agg(distinct v)
            from unnest(array[p.slug] || coalesce(p.alias, '{}'::text[])) as v
           where v is not null and btrim(v) <> '' and lower(v) <> lower(p.nombre)), '{}'::text[]),
         p.id,
         'proyecto'
  from public.proyectos p
  where p.user_id = p_user_id and coalesce(btrim(p.nombre), '') <> ''
  on conflict (user_id, termino) do update
    set variantes = coalesce((
          select array_agg(distinct v)
            from unnest(coalesce(public.diccionario_nombres.variantes, '{}'::text[]) || coalesce(excluded.variantes, '{}'::text[])) as v
        ), '{}'::text[]),
        proyecto_id = coalesce(excluded.proyecto_id, public.diccionario_nombres.proyecto_id),
        actualizado_el = now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.probar_proveedor(p_proveedor_id uuid)
 RETURNS TABLE(clave_slug text, url_base text, tiene_clave boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.clave_slug, p.url_base, (p.clave_cifrada is not null) as tiene_clave
  from public.proveedores_ia p
  where p.id = p_proveedor_id and p.user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.revisar_orden(p_orden_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_orden public.ordenes%rowtype; v_repo text; v_texto text; v_hallazgos jsonb := '[]'::jsonb; v_bloquea boolean := false; v_revision uuid;
begin
  select * into v_orden from public.ordenes where id = p_orden_id and user_id = auth.uid();
  if not found then raise exception 'No se encuentra la orden.'; end if;
  v_texto := coalesce(v_orden.texto, '');
  if v_texto ~ '(sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|eyJ[A-Za-z0-9_\-\.]{20,}|service_role|SUPABASE_SERVICE|-----BEGIN)' then
    v_hallazgos := v_hallazgos || jsonb_build_object('codigo','clave_en_texto','gravedad','bloquea','mensaje','El texto de la orden parece contener una clave o un token. Quítalo y guárdalo en los secretos.');
  end if;
  select repositorio into v_repo from public.proyectos where id = v_orden.proyecto_id;
  if v_repo is null or btrim(v_repo) = '' then
    v_hallazgos := v_hallazgos || jsonb_build_object('codigo','sin_repositorio','gravedad','bloquea','mensaje','El proyecto no tiene repositorio indicado. Rellénalo antes de enviar la orden.');
  end if;
  if v_texto !~ '[0-9]+\.[0-9]+\.[0-9]+' then
    v_hallazgos := v_hallazgos || jsonb_build_object('codigo','sin_version','gravedad','aviso','mensaje','La orden no indica un número de versión con formato x.y.z.');
  end if;
  if v_texto !~* '(powered by|whatsapp|changelog)' then
    v_hallazgos := v_hallazgos || jsonb_build_object('codigo','sin_reglas_fijas','gravedad','aviso','mensaje','Recuerda las reglas fijas: «Powered by», el enlace de WhatsApp y la entrada en el CHANGELOG.');
  end if;
  if v_texto ~* 'lovable cloud' then
    v_hallazgos := v_hallazgos || jsonb_build_object('codigo','menciona_cloud','gravedad','aviso','mensaje','La orden menciona Lovable Cloud; en estos proyectos se usa el Supabase propio.');
  end if;
  if v_texto !~* '(desatendid|requiere atención|requiere atencion|atención humana|atencion humana)' then
    v_hallazgos := v_hallazgos || jsonb_build_object('codigo','sin_modo_trabajo','gravedad','aviso','mensaje','La orden no dice si es trabajo desatendido o si requiere tu atención.');
  end if;
  select exists (select 1 from jsonb_array_elements(v_hallazgos) h where h->>'gravedad' = 'bloquea') into v_bloquea;
  insert into public.revisiones_orden (user_id, orden_id, aprobada, hallazgos) values (v_orden.user_id, p_orden_id, not v_bloquea, v_hallazgos) returning id into v_revision;
  update public.ordenes set revision_id = v_revision, bloqueada_por_revision = v_bloquea where id = p_orden_id;
  return jsonb_build_object('aprobada', not v_bloquea, 'hallazgos', v_hallazgos, 'revision_id', v_revision);
end; $function$
;

CREATE OR REPLACE FUNCTION public.sembrar_catalogos(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.agentes (user_id, codigo, nombre, proveedor, especialidades, coste_relativo, calidad, rapidez, seguridad, capacidad, permisos, roles) values
    (p_user, 'claude',      'Claude',      'Anthropic', '{Arquitectura,"Código complejo",Revisión}', 4, 94, 78, 92, 6, '{"Leer repositorio","Proponer cambios"}', '{planificar,ejecutar,revisar}'),
    (p_user, 'chatgpt',     'ChatGPT',     'OpenAI',    '{Planificación,Redacción,Análisis}',        3, 90, 86, 85, 6, '{"Leer contexto de proyecto"}',           '{planificar,ejecutar,revisar}'),
    (p_user, 'gemini',      'Gemini',      'Google',    '{"Documentos largos",Datos,Multimodal}',    2, 86, 90, 85, 5, '{"Leer contexto de proyecto"}',           '{planificar,ejecutar}'),
    (p_user, 'lovable',     'Lovable',     'Lovable',   '{"Interfaces web","Prototipos rápidos"}',   3, 84, 92, 80, 4, '{"Crear páginas","Publicar vista previa"}','{ejecutar}'),
    (p_user, 'canva',       'Canva',       'Canva',     '{"Diseño gráfico",Plantillas,Marca}',       1, 76, 88, 80, 3, '{"Generar piezas gráficas"}',             '{ejecutar}'),
    (p_user, 'nano_banana', 'Nano Banana', 'Google',    '{Imágenes,Retoque,Variaciones}',            2, 82, 94, 80, 4, '{"Generar imágenes"}',                    '{ejecutar}')
  on conflict (user_id, codigo) do nothing;

  insert into public.integraciones (user_id, codigo, nombre, tipo, requiere_aprobacion) values
    (p_user, 'supabase',  'Base de datos propia (Supabase)', 'datos',   true),
    (p_user, 'github',    'GitHub',                          'codigo',  true),
    (p_user, 'anthropic', 'Claude (Anthropic)',              'modelo',  true),
    (p_user, 'openai',    'ChatGPT (OpenAI)',                'modelo',  true),
    (p_user, 'google',    'Gemini y Nano Banana (Google)',   'modelo',  true),
    (p_user, 'lovable',   'Lovable',                         'codigo',  true),
    (p_user, 'canva',     'Canva',                           'diseno',  false)
  on conflict (user_id, codigo) do nothing;

  insert into public.credenciales_ref (user_id, integracion_id, referencia)
  select p_user, i.id, r.ref from public.integraciones i
  join (values ('supabase','SUPABASE_SERVICE_ROLE_KEY'), ('github','GITHUB_TOKEN'), ('anthropic','ANTHROPIC_API_KEY'),
               ('openai','OPENAI_API_KEY'), ('google','GOOGLE_API_KEY'), ('lovable','LOVABLE_API_KEY'), ('canva','CANVA_API_KEY')) as r(codigo, ref)
    on r.codigo = i.codigo
  where i.user_id = p_user
  on conflict (user_id, referencia) do nothing;
end $function$
;

CREATE OR REPLACE FUNCTION public.sembrar_expertos(p_user_id uuid DEFAULT auth.uid())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nota constant text := 'Instrucciones en la caja expertos-javier de Claude; pegar aquí si se quiere usar desde NexDeveloper.';
  v_total integer;
begin
  if p_user_id is null then raise exception 'Falta el usuario'; end if;
  insert into public.expertos (user_id, slug, nombre, origen, papel, cuando_usarlo, instrucciones, estado, tareas) values
    (p_user_id, 'analista-finops-roi', 'Analista FinOps y ROI', 'propio', 'Analista FinOps y consultor de producto', 'Coste por usuario y sesión, tokens, caché de respuestas, enrutado entre modelos baratos y potentes, presupuesto.', v_nota, 'adoptado', array['razonamiento','clasificacion']),
    (p_user_id, 'arquitecto-db-backend', 'Arquitecto de base de datos y backend', 'propio', 'Arquitecto de bases de datos y backend Supabase', 'RLS, esquemas, índices, fugas de service_role, Edge Functions proxy.', v_nota, 'adoptado', array['codigo','razonamiento']),
    (p_user_id, 'arquitecto-frontend-ux', 'Arquitecto frontend y UX', 'propio', 'Arquitecto frontend y UX (Lovable, React, TS, Tailwind)', 'Dividir componentes, React Query, latencias de IA, rendimiento y accesibilidad.', v_nota, 'adoptado', array['codigo']),
    (p_user_id, 'auditor-jefe-orquestador', 'Auditor jefe y orquestador', 'propio', 'Director de QA y Tech Lead', 'Auditoría integral en dos pasadas con puntuación sobre 100 y veredicto de publicable.', v_nota, 'adoptado', array['razonamiento','resumen']),
    (p_user_id, 'auditor-seguridad-appsec', 'Auditor de seguridad AppSec', 'propio', 'Ciberseguridad y pentest', 'Auth, JWT, XSS, inyección SQL, prompt injection, secretos, PII.', v_nota, 'adoptado', array['codigo','razonamiento']),
    (p_user_id, 'biblioteca-afilia', 'Biblioteca Afilia', 'propio', 'Biblioteca de bloques y rutinas reutilizables', 'Diseño Afilia, login, ficha, listados, permisos, KPI, importador, SEPA, PWA.', v_nota, 'adoptado', array['codigo']),
    (p_user_id, 'cumplimiento-rgpd', 'Cumplimiento RGPD', 'propio', 'Consultor RGPD/LOPDGDD/LSSI y DPO', 'Bases legales, RAT, cookies, DPA, DPIA, brechas.', v_nota, 'adoptado', array['razonamiento','resumen']),
    (p_user_id, 'devops-observabilidad', 'DevOps y observabilidad', 'propio', 'DevOps, SRE y observabilidad', 'Sentry, alertas, copias, entornos, CI/CD, rollback.', v_nota, 'adoptado', array['codigo','razonamiento']),
    (p_user_id, 'ingeniero-ia-prompt-engineering', 'Ingeniero de IA y prompt engineering', 'propio', 'Ingeniero de IA y prompt engineering para la API de Claude', 'System prompts, JSON estructurado, elección Haiku/Sonnet.', v_nota, 'adoptado', array['razonamiento','clasificacion']),
    (p_user_id, 'qa-tolerancia-fallos', 'QA y tolerancia a fallos', 'propio', 'QA y resiliencia', 'Edge cases, caídas de Supabase/Claude, timeouts, datos corruptos, reintentos, Zod.', v_nota, 'adoptado', array['codigo','razonamiento']),
    (p_user_id, 'testing-automatizado', 'Testing automatizado', 'propio', 'QA automation con Vitest y Playwright', 'Unitarios, E2E, regresión visual, CI.', v_nota, 'adoptado', array['codigo']),
    (p_user_id, 'redactor-tecnico', 'Redactor técnico', 'sugerido', 'Redactor técnico', 'Documentación y manuales de usuario.', null, 'propuesto', array['resumen']),
    (p_user_id, 'disenador-producto', 'Diseñador de producto', 'sugerido', 'Diseñador de producto', 'Pantallas y flujos de uso.', null, 'propuesto', array['imagen']),
    (p_user_id, 'analista-datos', 'Analista de datos', 'sugerido', 'Analista de datos', 'Consultas SQL e informes.', null, 'propuesto', array['clasificacion']),
    (p_user_id, 'traductor', 'Traductor', 'sugerido', 'Traductor', 'Internacionalización y textos en varios idiomas.', null, 'propuesto', array['traduccion']),
    (p_user_id, 'comercial', 'Comercial', 'sugerido', 'Comercial', 'Argumentarios de venta y dosieres.', null, 'propuesto', array['busqueda'])
  on conflict (user_id, slug) do nothing;
  select count(*) into v_total from public.expertos where user_id = p_user_id;
  return v_total;
end; $function$
;

CREATE OR REPLACE FUNCTION public.sembrar_plantillas_accion(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.plantillas_accion (user_id, tipo, nombre, descripcion, parametros_por_defecto, requiere_aprobacion, orden) values
    (p_user, 'supabase_migracion', 'Aplicar migración SQL en Supabase', 'Ejecuta un bloque SQL como migración en el proyecto de Supabase indicado.', '{"project_ref":"","nombre":"","sql":""}', true, 1),
    (p_user, 'supabase_sql', 'Consulta SQL de solo lectura', 'Lanza una consulta SELECT y devuelve el resultado.', '{"project_ref":"","sql":"select now();"}', false, 2),
    (p_user, 'supabase_listar_tablas', 'Listar tablas del proyecto', 'Devuelve las tablas del esquema public.', '{"project_ref":""}', false, 3),
    (p_user, 'supabase_secreto', 'Guardar secreto en Edge Functions', 'Crea o actualiza un secreto (el valor se pide en el momento y no se guarda).', '{"project_ref":"","nombre":""}', true, 4),
    (p_user, 'github_crear_repo', 'Crear repositorio privado', 'Crea un repositorio privado en la cuenta de GitHub conectada.', '{"nombre":"","descripcion":""}', true, 5),
    (p_user, 'github_subir_archivo', 'Subir o actualizar un archivo', 'Escribe un archivo en una rama del repositorio.', '{"repo":"","rama":"main","ruta":"","contenido":"","mensaje":""}', true, 6),
    (p_user, 'github_crear_issue', 'Crear incidencia en GitHub', 'Abre una issue en el repositorio.', '{"repo":"","titulo":"","cuerpo":""}', false, 7),
    (p_user, 'github_listar_ramas', 'Listar ramas', 'Devuelve las ramas del repositorio.', '{"repo":""}', false, 8)
  on conflict do nothing;
end $function$
;

CREATE OR REPLACE FUNCTION public.sembrar_proveedores_ia()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_insertados integer := 0;
  r record;
  v_prov uuid;
begin
  if v_user is null then raise exception 'Sin sesión'; end if;

  insert into public.proveedores_ia (user_id, nombre, clave_slug, tipo, activo, url_base)
  select v_user, x.nombre, x.slug, x.tipo::tipo_proveedor_ia, x.activo, x.url
  from (values
    ('Anthropic','anthropic','texto',true,'https://api.anthropic.com'),
    ('OpenAI','openai','multi',false,'https://api.openai.com/v1'),
    ('Google','google','multi',false,'https://generativelanguage.googleapis.com'),
    ('Groq','groq','texto',false,'https://api.groq.com/openai/v1'),
    ('Mistral','mistral','texto',false,'https://api.mistral.ai/v1'),
    ('DeepSeek','deepseek','texto',false,'https://api.deepseek.com'),
    ('xAI','xai','texto',false,'https://api.x.ai/v1'),
    ('Perplexity','perplexity','busqueda',false,'https://api.perplexity.ai'),
    ('Cohere','cohere','texto',false,'https://api.cohere.com'),
    ('OpenRouter','openrouter','multi',false,'https://openrouter.ai/api/v1'),
    ('Together','together','texto',false,'https://api.together.xyz/v1'),
    ('ElevenLabs','elevenlabs','voz',false,'https://api.elevenlabs.io'),
    ('fal','fal','imagen',false,'https://fal.run'),
    ('Abacus','abacus','multi',false,'https://api.abacus.ai'),
    ('Ollama','ollama','texto',false,'http://localhost:11434')
  ) as x(nombre, slug, tipo, activo, url)
  on conflict (user_id, clave_slug) do nothing;

  for r in
    select * from (values
      ('anthropic','claude-opus-4-1','Claude Opus 4.1',15,75,'media',200000,5,array['codigo','razonamiento','vision'],null),
      ('anthropic','claude-sonnet-4-5','Claude Sonnet 4.5',3,15,'alta',200000,5,array['codigo','razonamiento','resumen','vision'],null),
      ('anthropic','claude-3-7-sonnet-latest','Claude Sonnet 3.7',3,15,'alta',200000,4,array['codigo','razonamiento'],null),
      ('anthropic','claude-3-5-haiku-latest','Claude Haiku 3.5',0.8,4,'muy_alta',200000,3,array['resumen','clasificacion','traduccion'],null),
      ('openai','gpt-5','GPT-5',1.25,10,'media',400000,5,array['codigo','razonamiento','vision'],null),
      ('openai','gpt-5-mini','GPT-5 mini',0.25,2,'alta',400000,4,array['codigo','resumen','clasificacion'],null),
      ('openai','gpt-4.1','GPT-4.1',2,8,'alta',1000000,4,array['codigo','resumen','vision'],null),
      ('openai','gpt-4o','GPT-4o',2.5,10,'alta',128000,4,array['razonamiento','vision','resumen'],null),
      ('openai','gpt-4o-mini','GPT-4o mini',0.15,0.6,'muy_alta',128000,3,array['clasificacion','resumen','traduccion'],null),
      ('openai','o3','o3',2,8,'baja',200000,5,array['razonamiento','codigo'],null),
      ('google','gemini-2.5-pro','Gemini 2.5 Pro',1.25,10,'media',1048576,5,array['razonamiento','codigo','vision'],'Precio del tramo hasta 200k tokens'),
      ('google','gemini-2.5-flash','Gemini 2.5 Flash',0.30,2.50,'alta',1048576,4,array['resumen','clasificacion','vision'],null),
      ('google','gemini-2.5-flash-lite','Gemini 2.5 Flash Lite',0.10,0.40,'muy_alta',1048576,3,array['clasificacion','traduccion'],null),
      ('google','gemini-2.0-flash','Gemini 2.0 Flash',0.10,0.40,'muy_alta',1048576,3,array['resumen','clasificacion'],null),
      ('groq','llama-3.3-70b-versatile','Llama 3.3 70B',0.59,0.79,'muy_alta',131072,4,array['codigo','resumen'],null),
      ('groq','llama-3.1-8b-instant','Llama 3.1 8B',0.05,0.08,'muy_alta',131072,2,array['clasificacion','traduccion'],null),
      ('groq','openai/gpt-oss-120b','GPT-OSS 120B',0.15,0.75,'muy_alta',131072,4,array['razonamiento','codigo'],null),
      ('mistral','mistral-large-latest','Mistral Large',2,6,'media',128000,4,array['razonamiento','codigo'],null),
      ('mistral','mistral-small-latest','Mistral Small',0.20,0.60,'alta',128000,3,array['resumen','clasificacion'],null),
      ('mistral','codestral-latest','Codestral',0.30,0.90,'alta',256000,4,array['codigo'],null),
      ('deepseek','deepseek-chat','DeepSeek Chat',0.27,1.10,'media',128000,4,array['codigo','resumen'],null),
      ('deepseek','deepseek-reasoner','DeepSeek Reasoner',0.55,2.19,'baja',128000,5,array['razonamiento'],null),
      ('xai','grok-4','Grok 4',3,15,'media',256000,5,array['razonamiento','codigo'],null),
      ('xai','grok-3','Grok 3',3,15,'media',131072,4,array['codigo'],null),
      ('xai','grok-3-mini','Grok 3 mini',0.30,0.50,'alta',131072,3,array['clasificacion','resumen'],null),
      ('perplexity','sonar','Sonar',1,1,'alta',128000,3,array['busqueda'],'Además cobra por búsqueda realizada'),
      ('perplexity','sonar-pro','Sonar Pro',3,15,'media',200000,4,array['busqueda','razonamiento'],null),
      ('perplexity','sonar-reasoning','Sonar Reasoning',1,5,'media',128000,4,array['busqueda','razonamiento'],null),
      ('cohere','command-a-03-2025','Command A',2.50,10,'alta',256000,4,array['codigo','resumen'],null),
      ('cohere','command-r-plus','Command R+',2.50,10,'media',128000,4,array['razonamiento','resumen'],null),
      ('cohere','command-r7b-12-2024','Command R7B',0.0375,0.15,'muy_alta',128000,2,array['clasificacion'],null),
      ('openrouter','openrouter/auto','Enrutado automático',null,null,'media',null,4,array['codigo','razonamiento'],'Precio variable según el modelo elegido'),
      ('openrouter','anthropic/claude-sonnet-4.5','Claude Sonnet 4.5 (OpenRouter)',3,15,'alta',200000,5,array['codigo','razonamiento'],null),
      ('openrouter','openai/gpt-5','GPT-5 (OpenRouter)',1.25,10,'media',400000,5,array['codigo','razonamiento'],null),
      ('together','meta-llama/Llama-3.3-70B-Instruct-Turbo','Llama 3.3 70B Turbo',0.88,0.88,'alta',131072,4,array['codigo','resumen'],null),
      ('together','Qwen/Qwen2.5-72B-Instruct-Turbo','Qwen 2.5 72B Turbo',1.20,1.20,'alta',32768,4,array['codigo'],null),
      ('together','deepseek-ai/DeepSeek-R1','DeepSeek R1',3,7,'baja',164000,5,array['razonamiento'],null),
      ('elevenlabs','eleven_multilingual_v2','Multilingual v2',null,null,'alta',null,5,array['voz'],'Se cobra por caracteres, no por tokens'),
      ('elevenlabs','eleven_flash_v2_5','Flash v2.5',null,null,'muy_alta',null,4,array['voz'],'Se cobra por caracteres, no por tokens'),
      ('fal','fal-ai/flux/dev','FLUX.1 dev',null,null,'alta',null,4,array['imagen'],'Se cobra por imagen generada'),
      ('fal','fal-ai/flux-pro/v1.1','FLUX1.1 pro',null,null,'media',null,5,array['imagen'],'Se cobra por imagen generada'),
      ('abacus','route-llm','RouteLLM',null,null,'media',null,4,array['codigo','razonamiento'],'Incluido en la suscripción del proveedor'),
      ('ollama','llama3.1:8b','Llama 3.1 8B (local)',0,0,'alta',131072,2,array['clasificacion','resumen'],'Se ejecuta en tu equipo'),
      ('ollama','qwen2.5-coder:14b','Qwen2.5 Coder 14B (local)',0,0,'media',32768,3,array['codigo'],'Se ejecuta en tu equipo')
    ) as m(slug, identificador, nombre, entrada, salida, velocidad, contexto, calidad, tareas, notas)
  loop
    select id into v_prov from public.proveedores_ia where user_id = v_user and clave_slug = r.slug;
    if v_prov is null then continue; end if;
    insert into public.modelos_ia
      (user_id, proveedor_id, identificador, nombre, coste_entrada, coste_salida, velocidad, contexto_max, calidad, tareas_aconsejadas, notas)
    values
      (v_user, v_prov, r.identificador, r.nombre, r.entrada, r.salida, r.velocidad::velocidad_modelo, r.contexto, r.calidad, r.tareas, r.notas)
    on conflict (proveedor_id, identificador) do nothing;
    if found then v_insertados := v_insertados + 1; end if;
  end loop;

  insert into public.politica_enrutado (user_id, tarea, estrategia)
  select v_user, t, 'mejor'::estrategia_enrutado
  from unnest(array['codigo','razonamiento','resumen','traduccion','clasificacion','busqueda','imagen','voz','vision']) as t
  on conflict (user_id, tarea) do nothing;

  return v_insertados;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_actualizado_el()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.actualizado_el = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_limit(real)
 RETURNS real
 LANGUAGE c
 STRICT
AS '$libdir/pg_trgm', $function$set_limit$function$
;

CREATE OR REPLACE FUNCTION public.show_limit()
 RETURNS real
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_limit$function$
;

CREATE OR REPLACE FUNCTION public.show_trgm(text)
 RETURNS text[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_trgm$function$
;

CREATE OR REPLACE FUNCTION public.similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity$function$
;

CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_dist$function$
;

CREATE OR REPLACE FUNCTION public.similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_op$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_repositorio_proyecto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.proyectos set repositorio = new.nombre_completo where id = new.proyecto_id and (repositorio is null or btrim(repositorio) = '');
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.solo_altas_autorizadas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.email is null
     or not exists (select 1 from public.altas_permitidas
                     where lower(email) = lower(new.email)) then
    raise exception 'Alta no autorizada en NexDeveloper';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$
;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$
;

CREATE OR REPLACE FUNCTION public.sugerir_proyecto(p_texto text)
 RETURNS TABLE(proyecto_id uuid, nombre text, confianza numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with candidatos as (
    select p.id, p.nombre,
      (case when p_texto ilike '%' || p.nombre || '%' then 0.6 else 0 end
       + case when p.repositorio is not null and p_texto ilike '%' || p.repositorio || '%' then 0.3 else 0 end
       + case when p.descripcion is not null and length(p.descripcion) > 10
              and exists (select 1 from regexp_split_to_table(lower(p.descripcion), '\W+') w where length(w) > 5 and p_texto ilike '%' || w || '%') then 0.2 else 0 end
      )::numeric as puntos
    from public.proyectos p where p.user_id = auth.uid()
  )
  select id, nombre, least(1, puntos) from candidatos where puntos > 0 order by puntos desc limit 3;
$function$
;

CREATE OR REPLACE FUNCTION public.tarea_completada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.estado = 'completada' and (old.estado is distinct from 'completada') then
    new.progreso := 100;
    new.completada_el := coalesce(new.completada_el, now());
    new.completada_por := coalesce(new.completada_por, (select coalesce(nombre_completo, email) from public.perfiles where id = auth.uid()));
    new.horas_consumidas := greatest(new.horas_consumidas, new.estimacion_horas);
  end if;
  new.ultima_actividad := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_sincronizar_powered_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.clave = 'autoria.powered_by' then
    update public.configuracion_app set valor = new.valor, actualizado_el = now()
     where clave = 'powered_by' and valor is distinct from new.valor;
  elsif new.clave = 'powered_by' then
    update public.configuracion_app set valor = new.valor, actualizado_el = now()
     where clave = 'autoria.powered_by' and valor is distinct from new.valor;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_commutator_op$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$
;

CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_op$function$
;