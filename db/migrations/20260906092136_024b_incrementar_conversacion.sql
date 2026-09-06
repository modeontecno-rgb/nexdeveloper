create or replace function public.incrementar_conversacion(p_id uuid, p_te integer, p_ts integer, p_coste numeric)
returns void language sql security definer set search_path to 'public' as $$
  update public.asistente_conversaciones set tokens_entrada = tokens_entrada + coalesce(p_te,0), tokens_salida = tokens_salida + coalesce(p_ts,0), coste = coste + coalesce(p_coste,0), actualizado_el = now() where id = p_id;
$$;
revoke all on function public.incrementar_conversacion(uuid,integer,integer,numeric) from public, anon, authenticated;
