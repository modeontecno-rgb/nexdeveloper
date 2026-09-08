CREATE OR REPLACE FUNCTION public.asistente_consulta_segura(p_user uuid,p_tabla text,p_proyecto uuid DEFAULT NULL,p_limite integer DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE columnas text; consulta text; resultado jsonb;
BEGIN
 IF p_user IS NULL OR p_limite IS NULL OR p_limite<1 OR p_limite>100 THEN RAISE EXCEPTION 'Consulta inválida'; END IF;
 IF p_proyecto IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.proyectos WHERE id=p_proyecto AND user_id=p_user) THEN RAISE EXCEPTION 'Proyecto no autorizado'; END IF;
 -- Names and projections are server-owned. No SQL fragments supplied by the model.
 columnas:=CASE p_tabla
 WHEN 'proyectian_objetos' THEN 'id,proyecto_id,entidad,datos,revision'
 WHEN 'proyectos' THEN 'id,slug,nombre,descripcion,estado,version_actual'
 WHEN 'tareas' THEN 'id,proyecto_id,titulo,descripcion,estado,prioridad,requiere_atencion,ultima_actividad'
 WHEN 'ordenes' THEN 'id,proyecto_id,texto,estado,riesgo,coste_estimado,requiere_atencion'
 WHEN 'ejecuciones_orden' THEN 'id,proyecto_id,estado,modo,motor,resumen,error,pasos,pr_url,commit_sha,publicado_url'
 WHEN 'documentos_nex' THEN 'id,proyecto_id,tipo,titulo,version,nombre_archivo,mime,bytes'
 WHEN 'mesas' THEN 'id,proyecto_id,pregunta,sintesis,estado'
 WHEN 'consumos_ia' THEN 'id,proyecto_id,tokens_entrada,tokens_salida,coste,created_at'
 ELSE NULL END;
 IF columnas IS NULL THEN RAISE EXCEPTION 'Este conjunto de datos no está disponible para el asistente'; END IF;
 consulta:=format('SELECT coalesce(jsonb_agg(x),''[]''::jsonb) FROM (SELECT %s FROM public.%I WHERE user_id=$1',columnas,p_tabla);
 IF p_tabla='proyectos' THEN consulta:=consulta||' AND ($2 IS NULL OR id=$2)';
 ELSE consulta:=consulta||' AND proyecto_id IS NOT NULL AND ($2 IS NULL OR proyecto_id=$2)'; END IF;
 consulta:=consulta||' ORDER BY id LIMIT $3) x';
 EXECUTE consulta INTO resultado USING p_user,p_proyecto,p_limite;
 RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.asistente_consulta_segura(uuid,text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.asistente_consulta_segura(uuid,text,uuid,integer) TO service_role;
