-- Run after additive columns exist. Counts only.
SELECT 'ejecuciones_orden.proyecto_id' AS relacion,count(*) AS incoherencias FROM public.ejecuciones_orden c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'ejecuciones_orden.orden_id' AS relacion,count(*) AS incoherencias FROM public.ejecuciones_orden c JOIN public.ordenes p ON p.id=c.orden_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'ejecuciones_orden.tarea_id' AS relacion,count(*) AS incoherencias FROM public.ejecuciones_orden c JOIN public.tareas p ON p.id=c.tarea_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'ejecuciones_orden.tarea_origen_id' AS relacion,count(*) AS incoherencias FROM public.ejecuciones_orden c JOIN public.tareas p ON p.id=c.tarea_origen_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'tareas.proyecto_id' AS relacion,count(*) AS incoherencias FROM public.tareas c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'tareas.orden_id' AS relacion,count(*) AS incoherencias FROM public.tareas c JOIN public.ordenes p ON p.id=c.orden_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'tareas.tarea_padre_id' AS relacion,count(*) AS incoherencias FROM public.tareas c JOIN public.tareas p ON p.id=c.tarea_padre_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'chats.proyecto_id' AS relacion,count(*) AS incoherencias FROM public.chats c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'mensajes.chat_id' AS relacion,count(*) AS incoherencias FROM public.mensajes c JOIN public.chats p ON p.id=c.chat_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'mensajes.proyecto_id' AS relacion,count(*) AS incoherencias FROM public.mensajes c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'mesas.proyecto_id' AS relacion,count(*) AS incoherencias FROM public.mesas c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'manuales.proyecto_id' AS relacion,count(*) AS incoherencias FROM public.manuales c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'documentos_nex.proyecto_id' AS relacion,count(*) AS incoherencias FROM public.documentos_nex c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'peticiones_directas.proyecto_id' AS relacion,count(*) AS incoherencias FROM public.peticiones_directas c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'peticiones_directas.chat_id' AS relacion,count(*) AS incoherencias FROM public.peticiones_directas c JOIN public.chats p ON p.id=c.chat_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'peticiones_directas.orden_id' AS relacion,count(*) AS incoherencias FROM public.peticiones_directas c JOIN public.ordenes p ON p.id=c.orden_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'peticiones_directas.mesa_id' AS relacion,count(*) AS incoherencias FROM public.peticiones_directas c JOIN public.mesas p ON p.id=c.mesa_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'peticiones_directas.tarea_id' AS relacion,count(*) AS incoherencias FROM public.peticiones_directas c JOIN public.tareas p ON p.id=c.tarea_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL
SELECT 'peticiones_directas.conversacion_id' AS relacion,count(*) AS incoherencias FROM public.peticiones_directas c JOIN public.personal_conversaciones p ON p.id=c.conversacion_id WHERE c.user_id IS DISTINCT FROM p.user_id;
