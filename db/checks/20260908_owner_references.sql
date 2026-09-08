-- Solo lectura. Resolver cada incoherencia sin borrar/reasignar datos automáticamente.
SELECT 'personal_mensajes' AS relacion,count(*) AS incoherencias FROM public.personal_mensajes c JOIN public.personal_conversaciones p ON p.id=c.conversacion_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL SELECT 'personal_documentos',count(*) FROM public.personal_documentos c JOIN public.personal_conversaciones p ON p.id=c.conversacion_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL SELECT 'ordenes.proyecto',count(*) FROM public.ordenes c JOIN public.proyectos p ON p.id=c.proyecto_id WHERE c.user_id IS DISTINCT FROM p.user_id
UNION ALL SELECT 'ordenes.origen',count(*) FROM public.ordenes c JOIN public.proyectos p ON p.id=c.proyecto_origen_id WHERE c.user_id IS DISTINCT FROM p.user_id;
