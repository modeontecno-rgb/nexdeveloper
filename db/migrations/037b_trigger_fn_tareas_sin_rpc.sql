-- 037b · La función de trigger fn_tareas_fechas_estado no se expone por RPC · NexDeveloper 0.37.0 · 7/09/2026
revoke execute on function public.fn_tareas_fechas_estado() from public, anon, authenticated;
