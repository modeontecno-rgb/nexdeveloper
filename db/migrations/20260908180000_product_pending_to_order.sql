ALTER TABLE ordenes ADD COLUMN origen_enlace_id uuid REFERENCES proyectian_enlaces(id),ADD COLUMN origen_pendiente_id uuid,ADD COLUMN contexto_producto jsonb;
CREATE UNIQUE INDEX orden_pendiente_proyectian_unico ON ordenes(origen_enlace_id,origen_pendiente_id) WHERE origen_enlace_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.crear_orden_desde_proyectian(p_enlace uuid,p_pendiente uuid,p_instalacion uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.proyectian_enlaces;pend jsonb;linea jsonb;inst jsonb;producto jsonb;oid uuid;contexto jsonb;
BEGIN
 SELECT * INTO e FROM proyectian_enlaces WHERE id=p_enlace AND user_id=auth.uid() AND activo FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM proyectos WHERE id=e.proyecto_id AND user_id=e.user_id) THEN RAISE EXCEPTION 'Enlace no autorizado'; END IF;
 SELECT id INTO oid FROM ordenes WHERE origen_enlace_id=e.id AND origen_pendiente_id=p_pendiente AND user_id=e.user_id;
 IF FOUND THEN RETURN oid; END IF;
 SELECT datos INTO pend FROM proyectian_objetos WHERE enlace_id=e.id AND entidad='pendientes' AND id=p_pendiente AND user_id=e.user_id;
 IF NOT FOUND OR pend->>'estado' NOT IN ('pendiente','haciendo') OR pend->>'titulo' IS NULL THEN RAISE EXCEPTION 'Pendiente no disponible en la copia confirmada'; END IF;
 IF pend->>'nex_tarea_id' IS NOT NULL THEN
   SELECT orden_id INTO oid FROM tareas WHERE id=(pend->>'nex_tarea_id')::uuid AND user_id=e.user_id AND proyecto_id=e.proyecto_id;
   IF oid IS NOT NULL THEN RETURN oid; END IF;
   RAISE EXCEPTION 'El pendiente tiene una transferencia anterior que necesita conciliación';
 END IF;
 SELECT datos INTO producto FROM proyectian_objetos WHERE enlace_id=e.id AND entidad='proyectos' AND id=e.origen_proyecto;
 IF producto IS NULL THEN RAISE EXCEPTION 'Falta el producto confirmado'; END IF;
 IF pend->>'linea_id' IS NOT NULL THEN
   SELECT datos INTO linea FROM proyectian_objetos WHERE enlace_id=e.id AND entidad='proyecto_lineas' AND id=(pend->>'linea_id')::uuid;
   IF linea IS NULL THEN RAISE EXCEPTION 'Falta la línea del pendiente'; END IF;
 END IF;
 IF p_instalacion IS NOT NULL THEN
   SELECT datos INTO inst FROM proyectian_objetos WHERE enlace_id=e.id AND entidad='instalaciones' AND id=p_instalacion;
   IF inst IS NULL OR (linea IS NOT NULL AND inst->>'linea_id' IS DISTINCT FROM linea->>'id') THEN RAISE EXCEPTION 'Instalación fuera de la línea'; END IF;
 END IF;
 contexto:=jsonb_build_object('enlace_id',e.id,'revision',e.revision,'producto',producto,'pendiente',pend,'linea',linea,'instalacion',inst);
 INSERT INTO ordenes(user_id,proyecto_id,texto,estado,modo,prioridad,requiere_aprobacion,requiere_atencion,origen_enlace_id,origen_pendiente_id,contexto_producto,ejecutar_con)
 VALUES(e.user_id,e.proyecto_id,(pend->>'titulo')||E'\n\n'||coalesce(pend->>'descripcion','')||E'\n\nContexto confirmado de Proyectian (no inferir otra línea o instalación):\n'||jsonb_pretty(contexto),'pendiente_aprobacion','equilibrado','media',true,true,e.id,p_pendiente,contexto,'claude') RETURNING id INTO oid;
 INSERT INTO tareas(user_id,proyecto_id,orden_id,titulo,descripcion,estado,prioridad,requiere_atencion)
 VALUES(e.user_id,e.proyecto_id,oid,pend->>'titulo',coalesce(pend->>'descripcion',''),'pendiente','media',false);
 RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.crear_orden_desde_proyectian(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crear_orden_desde_proyectian(uuid,uuid,uuid) TO authenticated;
