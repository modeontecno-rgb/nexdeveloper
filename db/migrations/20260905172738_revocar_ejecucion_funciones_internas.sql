-- Aplicada desde Lovable (migración 20260905172738)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sembrar_catalogos(uuid) from public, anon, authenticated;
revoke execute on function public.set_actualizado_el() from public, anon, authenticated;
revoke execute on function public.tarea_completada() from public, anon, authenticated;
