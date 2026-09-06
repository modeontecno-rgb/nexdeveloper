-- NexDeveloper · Migraciones 2 a 4 aplicadas el 5/09/2026 (siembra_catalogos_por_usuario, revocar_ejecucion_funciones_internas, configuracion_app_lectura_publica)

-- Siembra de agentes e integraciones por defecto para cada usuario nuevo
create or replace function public.sembrar_catalogos(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
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
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre_completo, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  insert into public.ajustes (user_id) values (new.id) on conflict (user_id) do nothing;
  perform public.sembrar_catalogos(new.id);
  return new;
end $$;

-- Clasificación de una orden en su proyecto (organización inteligente, versión inicial por palabras clave). Confianza en escala 0–1.
create or replace function public.sugerir_proyecto(p_texto text)
returns table (proyecto_id uuid, nombre text, confianza numeric) language sql stable set search_path = public as $$
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
$$;

-- Funciones internas: no ejecutables desde la API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sembrar_catalogos(uuid) from public, anon, authenticated;
revoke execute on function public.set_actualizado_el() from public, anon, authenticated;
revoke execute on function public.tarea_completada() from public, anon, authenticated;

-- La configuración de marca (Powered by, WhatsApp, versión) no contiene secretos y debe verse también en la pantalla de acceso
drop policy if exists "configuracion: leer" on public.configuracion_app;
create policy "configuracion: leer" on public.configuracion_app for select to anon, authenticated using (true);
