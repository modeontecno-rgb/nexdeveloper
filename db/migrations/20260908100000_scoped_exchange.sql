CREATE TABLE public.proyectian_enlaces (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id), proyecto_id uuid NOT NULL REFERENCES public.proyectos(id),
 origen_usuario uuid NOT NULL, origen_proyecto uuid NOT NULL, activo boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 0, ultimo_error text, sincronizado_el timestamptz, UNIQUE(proyecto_id,origen_proyecto)
);
CREATE TABLE public.proyectian_entradas (
 enlace_id uuid NOT NULL REFERENCES public.proyectian_enlaces(id), revision bigint NOT NULL,
 contenido jsonb NOT NULL, recibido_el timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(enlace_id,revision)
);
CREATE TABLE public.proyectian_objetos (
 enlace_id uuid NOT NULL REFERENCES public.proyectian_enlaces(id), entidad text NOT NULL, id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id), proyecto_id uuid NOT NULL REFERENCES public.proyectos(id),
 datos jsonb NOT NULL, revision bigint NOT NULL, PRIMARY KEY(enlace_id,entidad,id)
);
ALTER TABLE public.proyectian_enlaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectian_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectian_objetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY proyectian_enlaces_owner ON public.proyectian_enlaces FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY proyectian_entradas_owner ON public.proyectian_entradas FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.proyectian_enlaces e WHERE e.id=enlace_id AND e.user_id=auth.uid()));
CREATE POLICY proyectian_objetos_owner ON public.proyectian_objetos FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.proyectian_enlaces,public.proyectian_entradas,public.proyectian_objetos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.proyectian_enlaces,public.proyectian_entradas,public.proyectian_objetos TO authenticated;
GRANT ALL ON public.proyectian_enlaces,public.proyectian_entradas,public.proyectian_objetos TO service_role;
CREATE OR REPLACE FUNCTION public.proyectian_recibir(p_enlace uuid,p_contenido jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.proyectian_enlaces; rev bigint; previo jsonb; x jsonb; campos text[];
BEGIN
 SELECT * INTO e FROM proyectian_enlaces WHERE id=p_enlace AND activo FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM proyectos WHERE id=e.proyecto_id AND user_id=e.user_id) THEN RAISE EXCEPTION 'Enlace no autorizado'; END IF;
 IF p_contenido IS NULL OR octet_length(p_contenido::text)>5000000 OR (p_contenido->>'protocolo') IS DISTINCT FROM '1' OR (p_contenido->>'enlace_id') IS DISTINCT FROM e.id::text OR (p_contenido->>'origen_usuario') IS DISTINCT FROM e.origen_usuario::text OR (p_contenido->>'origen_proyecto') IS DISTINCT FROM e.origen_proyecto::text OR (p_contenido->>'destino_usuario') IS DISTINCT FROM e.user_id::text OR (p_contenido->>'destino_proyecto') IS DISTINCT FROM e.proyecto_id::text OR jsonb_typeof(p_contenido->'objetos') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Intercambio fuera de contexto'; END IF;
 rev:=(p_contenido->>'revision')::bigint;
 IF rev IS NULL OR rev<1 THEN RAISE EXCEPTION 'Revisión inválida'; END IF;
 SELECT contenido INTO previo FROM proyectian_entradas WHERE enlace_id=e.id AND revision=rev;
 IF FOUND THEN
   IF previo IS DISTINCT FROM p_contenido THEN RAISE EXCEPTION 'La misma revisión contiene datos diferentes'; END IF;
   RETURN jsonb_build_object('estado','repetida','revision',rev);
 END IF;
 IF rev<=e.revision THEN RAISE EXCEPTION 'Revisión atrasada'; END IF;
 -- Validate all rows BEFORE replacing the current mirror. Full snapshot accounts for deletes.
 FOR x IN SELECT value FROM jsonb_array_elements(p_contenido->'objetos') LOOP
   campos:=CASE x->>'entidad'
 WHEN 'proyectos' THEN ARRAY['id','nombre','slug','descripcion_corta','version_actual','codigo_producto']
 WHEN 'proyecto_lineas' THEN ARRAY['id','proyecto_id','nombre','slug','descripcion','activo','version_actual_id']
 WHEN 'versiones' THEN ARRAY['id','proyecto_id','linea_id','numero','titulo','notas_version','fecha','cerrada_el','siguiente_version_id']
 WHEN 'pendientes' THEN ARRAY['id','proyecto_id','linea_id','tipo','titulo','descripcion','prioridad','estado','nex_tarea_id','prompt']
 WHEN 'documentos' THEN ARRAY['id','proyecto_id','linea_id','tipo','titulo','descripcion','version','bytes','fecha']
 WHEN 'videos' THEN ARRAY['id','proyecto_id','linea_id','titulo','descripcion','tipo','version','bytes','duracion_seg']
 WHEN 'instalaciones' THEN ARRAY['id','proyecto_id','linea_id','numero','nombre','entorno','estado']
 WHEN 'pantallas' THEN ARRAY['id','proyecto_id','nombre','ruta','descripcion']
   ELSE NULL END;
   IF campos IS NULL OR jsonb_typeof(x->'datos') IS DISTINCT FROM 'object' OR x->>'id' IS NULL OR (x->'datos'->>'id') IS DISTINCT FROM (x->>'id') OR EXISTS(SELECT 1 FROM jsonb_object_keys(x->'datos') k WHERE NOT k=ANY(campos)) THEN RAISE EXCEPTION 'Objeto no autorizado'; END IF;
   IF (x->>'entidad'='proyectos' AND x->>'id'<>e.origen_proyecto::text) OR (x->>'entidad'<>'proyectos' AND (x->'datos'->>'proyecto_id') IS DISTINCT FROM e.origen_proyecto::text) THEN RAISE EXCEPTION 'Objeto de otro proyecto'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(p_contenido->'objetos') AS a(obj) WHERE a.obj->>'entidad'='proyectos')<>1 THEN RAISE EXCEPTION 'Falta la ficha de producto'; END IF;
 INSERT INTO proyectian_entradas(enlace_id,revision,contenido) VALUES(e.id,rev,p_contenido);
 DELETE FROM proyectian_objetos WHERE enlace_id=e.id;
 INSERT INTO proyectian_objetos(enlace_id,entidad,id,user_id,proyecto_id,datos,revision)
 SELECT e.id,a.obj->>'entidad',(a.obj->>'id')::uuid,e.user_id,e.proyecto_id,a.obj->'datos',rev FROM jsonb_array_elements(p_contenido->'objetos') AS a(obj);
 UPDATE proyectian_enlaces SET revision=rev,sincronizado_el=now(),ultimo_error=NULL WHERE id=e.id;
 RETURN jsonb_build_object('estado','aplicada','revision',rev,'objetos',jsonb_array_length(p_contenido->'objetos'));
END $$;
REVOKE ALL ON FUNCTION public.proyectian_recibir(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.proyectian_recibir(uuid,jsonb) TO service_role;
