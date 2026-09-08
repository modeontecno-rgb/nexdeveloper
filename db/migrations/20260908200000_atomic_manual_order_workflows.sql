CREATE OR REPLACE FUNCTION public.crear_orden_completa(p_solicitud uuid,p_datos jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.ordenes;o public.ordenes;a public.ajustes;requiere boolean;uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL OR p_solicitud IS NULL THEN RAISE EXCEPTION 'Sin sesión o identificador de solicitud';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||p_solicitud::text,4820));
 v:=jsonb_populate_record(NULL::public.ordenes,p_datos);
 IF v.proyecto_id IS NULL OR NOT EXISTS(SELECT 1 FROM proyectos WHERE id=v.proyecto_id AND user_id=uid) OR length(trim(v.texto)) NOT BETWEEN 1 AND 100000 OR v.texto IS NULL OR v.coste_estimado IS NULL OR v.coste_estimado<0 OR v.coste_estimado>='Infinity'::numeric OR v.horas_estimadas IS NULL OR v.horas_estimadas<0 OR v.horas_estimadas>='Infinity'::numeric THEN RAISE EXCEPTION 'Proyecto, texto o estimación inválidos';END IF;
 SELECT * INTO o FROM ordenes WHERE id=p_solicitud AND user_id=uid;
 IF FOUND THEN IF o.texto IS DISTINCT FROM v.texto OR o.proyecto_id IS DISTINCT FROM v.proyecto_id THEN RAISE EXCEPTION 'Solicitud repetida con contenido diferente';END IF;RETURN to_jsonb(o);END IF;
 IF v.origen_mesa_id IS NOT NULL THEN
   PERFORM 1 FROM mesas WHERE id=v.origen_mesa_id AND user_id=uid AND proyecto_id=v.proyecto_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Mesa fuera de contexto';END IF;
   SELECT * INTO o FROM ordenes WHERE origen_mesa_id=v.origen_mesa_id AND user_id=uid;
   IF FOUND THEN RETURN to_jsonb(o);END IF;
 END IF;
 IF v.chat_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM chats WHERE id=v.chat_id AND user_id=uid AND proyecto_id=v.proyecto_id) THEN RAISE EXCEPTION 'Conversación fuera de contexto';END IF;
 SELECT * INTO a FROM ajustes WHERE user_id=uid;
 requiere:=NOT FOUND OR v.coste_estimado>coalesce(a.umbral_aprobacion_eur,0) OR (coalesce(a.aprobar_si_prioridad_critica,true) AND v.prioridad='critica') OR (coalesce(a.aprobar_si_riesgo_alto,true) AND coalesce(v.riesgo,'Alto')='Alto');
 INSERT INTO ordenes(id,user_id,proyecto_id,chat_id,texto,modo,prioridad,agente_id,equipo,estado,coste_estimado,horas_estimadas,riesgo,calidad_prevista,requiere_aprobacion,requiere_atencion,motivo_aprobacion,origen_mesa_id)
 VALUES(p_solicitud,uid,v.proyecto_id,v.chat_id,v.texto,coalesce(v.modo,'equilibrado'),coalesce(v.prioridad,'media'),v.agente_id,coalesce(v.equipo,'{}'),CASE WHEN requiere THEN 'pendiente_aprobacion'::estado_orden ELSE 'aprobada'::estado_orden END,v.coste_estimado,v.horas_estimadas,coalesce(v.riesgo,'Alto'),v.calidad_prevista,requiere,requiere,CASE WHEN requiere THEN 'Revisión según configuración del propietario' END,v.origen_mesa_id) RETURNING * INTO o;
 INSERT INTO estimaciones(user_id,proyecto_id,orden_id,agente_id,modo,horas_estimadas,coste_estimado,calidad_prevista,riesgo) VALUES(uid,o.proyecto_id,o.id,o.agente_id,o.modo,o.horas_estimadas,o.coste_estimado,o.calidad_prevista,o.riesgo);
 INSERT INTO tareas(user_id,proyecto_id,orden_id,titulo,descripcion,estado,prioridad,agente_id,estimacion_horas,coste_estimado,requiere_atencion) VALUES(uid,o.proyecto_id,o.id,left(o.texto,120),o.texto,'pendiente',o.prioridad,o.agente_id,o.horas_estimadas,o.coste_estimado,false);
 INSERT INTO actividad(user_id,proyecto_id,tipo,texto,referencia_tabla,referencia_id) VALUES(uid,o.proyecto_id,'orden','Orden registrada con su tarea y estimación','ordenes',o.id);
 RETURN to_jsonb(o);
END $$;
CREATE OR REPLACE FUNCTION public.resolver_orden_completa(p_orden uuid,p_decision text,p_comentario text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.ordenes;uid uuid:=auth.uid();
BEGIN
 IF p_decision NOT IN ('aprobada','rechazada') OR p_decision IS NULL THEN RAISE EXCEPTION 'Decisión inválida';END IF;
 SELECT * INTO o FROM ordenes WHERE id=p_orden AND user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orden no autorizada';END IF;
 IF o.estado::text=p_decision AND o.resuelta_el IS NOT NULL THEN RETURN;END IF;
 IF o.estado NOT IN ('pendiente_aprobacion','aprobada') OR o.ejecucion_id IS NOT NULL THEN RAISE EXCEPTION 'La orden ya ha iniciado su recorrido';END IF;
 UPDATE ordenes SET estado=p_decision::estado_orden,requiere_aprobacion=false,requiere_atencion=false,resuelta_el=now(),resuelta_por=uid::text,comentario=p_comentario WHERE id=o.id;
 IF p_decision='aprobada' THEN
   IF NOT EXISTS(SELECT 1 FROM tareas WHERE orden_id=o.id AND user_id=uid AND NOT requiere_atencion) THEN
    INSERT INTO tareas(user_id,proyecto_id,orden_id,titulo,descripcion,estado,prioridad,requiere_atencion) VALUES(uid,o.proyecto_id,o.id,left(o.texto,120),o.texto,'en_cola',o.prioridad,false);
   ELSE UPDATE tareas SET estado='en_cola' WHERE orden_id=o.id AND user_id=uid AND NOT requiere_atencion AND estado='pendiente';END IF;
 ELSE UPDATE tareas SET estado='cancelada' WHERE orden_id=o.id AND user_id=uid AND estado IN ('pendiente','en_cola');END IF;
 INSERT INTO actividad(user_id,proyecto_id,tipo,texto,referencia_tabla,referencia_id) VALUES(uid,o.proyecto_id,'decision','Orden '||p_decision,'ordenes',o.id);
END $$;
REVOKE ALL ON FUNCTION public.crear_orden_completa(uuid,jsonb),public.resolver_orden_completa(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crear_orden_completa(uuid,jsonb),public.resolver_orden_completa(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.cancelar_orden_completa(p_orden uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.ordenes;
BEGIN
 SELECT * INTO o FROM ordenes WHERE id=p_orden AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR o.estado='completada' THEN RAISE EXCEPTION 'Orden no cancelable';END IF;
 IF o.ejecucion_id IS NOT NULL THEN PERFORM cancelar_ejecucion(o.user_id,o.ejecucion_id);RETURN;END IF;
 UPDATE ordenes SET estado='cancelada',actualizado_el=now() WHERE id=o.id;
 UPDATE tareas SET estado='cancelada',cancelada_el=now() WHERE orden_id=o.id AND user_id=o.user_id AND estado NOT IN ('completada','cancelada');
END $$;
REVOKE ALL ON FUNCTION public.cancelar_orden_completa(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancelar_orden_completa(uuid) TO authenticated;
