-- 014_resumenes.sql — NexDeveloper 0.14.0 «Resumen diario e informe semanal»
create table if not exists public.resumenes_config (
  user_id uuid primary key default auth.uid(),
  diario_activo boolean not null default true, semanal_activo boolean not null default true,
  canales text[] not null default '{correo}',          -- correo | whatsapp
  correo_destino text, whatsapp_destino text,
  incluir jsonb not null default '{"atencion":true,"desatendidas":true,"compilaciones":true,"vigilancia":true,"dominios":true,"copias":true,"bandeja":true,"calidad":true,"consumo_ia":true,"actividad":true}',
  usar_ia boolean not null default true, actualizado_el timestamptz not null default now()
);
alter table public.resumenes_config enable row level security;
create policy resumenes_config_propietario on public.resumenes_config for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table if not exists public.resumenes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  tipo text not null,                 -- diario | semanal
  fecha date not null, periodo_desde timestamptz not null, periodo_hasta timestamptz not null,
  titulo text not null, contenido_md text not null, contenido_html text not null,
  datos jsonb not null default '{}', redactado_por text, enviado_por text[] not null default '{}', enviado_el timestamptz, error_envio text,
  leido boolean not null default false, creado_el timestamptz not null default now(), unique (user_id, tipo, fecha)
);
alter table public.resumenes enable row level security;
create policy resumenes_propietario on public.resumenes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter publication supabase_realtime add table public.resumenes;
insert into public.resumenes_config (user_id, correo_destino) select distinct p.user_id, u.email from public.proyectos p join auth.users u on u.id = p.user_id on conflict do nothing;
create or replace function public.lanzar_resumen(p_tipo text) returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then return; end if;
  perform net.http_post(url := v_url || '/resumenes', headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token), body := jsonb_build_object('accion','programado','tipo', p_tipo));
end $$;
revoke execute on function public.lanzar_resumen(text) from public, anon, authenticated;
select cron.schedule('resumen-diario',  '0 6 * * *', $$select public.lanzar_resumen('diario')$$);
select cron.schedule('resumen-semanal', '10 6 * * 1', $$select public.lanzar_resumen('semanal')$$);
