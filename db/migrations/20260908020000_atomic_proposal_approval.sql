-- Approval is a single transaction. Retry returns the original order.
CREATE OR REPLACE FUNCTION public.aprobar_propuesta_atomica(p_user_id uuid,p_peticion_id uuid,p_texto text DEFAULT NULL,p_motor text DEFAULT 'auto')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pet public.peticiones_directas; prop jsonb; oid uuid; riesgo_normalizado text; h numeric; c numeric;
BEGIN
  IF p_user_id IS NULL OR p_motor NOT IN ('auto','lovable','claude','manual') THEN RAISE EXCEPTION 'Usuario o motor no válido'; END IF;
  SELECT * INTO pet FROM public.peticiones_directas WHERE id=p_peticion_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Propuesta no encontrada'; END IF;
  IF pet.estado='aprobada' AND pet.orden_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.ordenes WHERE id=pet.orden_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Orden de origen incoherente'; END IF;
    RETURN pet.orden_id;
  END IF;
  IF pet.estado<>'propuesta' THEN RAISE EXCEPTION 'No hay propuesta pendiente'; END IF;
  IF pet.proyecto_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.proyectos WHERE id=pet.proyecto_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Proyecto no autorizado'; END IF;
  IF pet.chat_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.chats WHERE id=pet.chat_id AND user_id=p_user_id AND proyecto_id IS NOT DISTINCT FROM pet.proyecto_id) THEN RAISE EXCEPTION 'Conversación fuera del proyecto'; END IF;
  prop:=coalesce(pet.propuesta,'{}'::jsonb);
  p_texto:=btrim(coalesce(p_texto,prop->>'orden_para_la_ia',pet.texto));
  IF p_texto IS NULL OR length(p_texto)=0 OR length(p_texto)>60000 THEN RAISE EXCEPTION 'Texto de orden no válido'; END IF;
  riesgo_normalizado:=CASE lower(prop->>'riesgo') WHEN 'bajo' THEN 'Bajo' WHEN 'alto' THEN 'Alto' ELSE 'Medio' END;
  h:=CASE WHEN jsonb_typeof(prop->'horas_estimadas')='number' THEN greatest(0,(prop->>'horas_estimadas')::numeric) ELSE 0 END;
  c:=CASE WHEN jsonb_typeof(prop->'coste_estimado_eur')='number' THEN greatest(0,(prop->>'coste_estimado_eur')::numeric) ELSE 0 END;
  INSERT INTO public.ordenes(user_id,proyecto_id,chat_id,texto,modo,prioridad,estado,ejecutar_con,horas_estimadas,coste_estimado,riesgo,requiere_aprobacion,comentario,resuelta_el,resuelta_por)
  VALUES(p_user_id,pet.proyecto_id,pet.chat_id,p_texto,'equilibrado','media','aprobada',p_motor,h,c,riesgo_normalizado,false,'Propuesta aprobada desde Pídeme',now(),'Usuario') RETURNING id INTO oid;
  UPDATE public.peticiones_directas SET orden_id=oid,estado='aprobada',actualizado_el=now() WHERE id=pet.id;
  -- Exact relation only: never complete unrelated tasks by fuzzy title.
  IF pet.tarea_id IS NOT NULL THEN
    UPDATE public.tareas SET estado='completada',completada_el=now(),requiere_atencion=false WHERE id=pet.tarea_id AND user_id=p_user_id;
  END IF;
  IF pet.chat_id IS NOT NULL THEN
    INSERT INTO public.mensajes(user_id,chat_id,proyecto_id,autor,texto) VALUES(p_user_id,pet.chat_id,pet.proyecto_id,'sistema','Propuesta aprobada. Orden creada: '||oid::text);
  END IF;
  RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.aprobar_propuesta_atomica(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_propuesta_atomica(uuid,uuid,text,text) TO service_role;
