-- 013_bandeja.sql — NexDeveloper 0.13.0 «Bandeja única»: Gmail + WhatsApp Business + notas Plaud → tareas por proyecto
create table if not exists public.bandeja_fuentes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
  origen text not null,                       -- gmail | whatsapp | plaud
  activa boolean not null default true, cuenta text,
  configuracion jsonb not null default '{}',  -- gmail: {consulta, etiqueta, solo_no_leidos}; whatsapp: {phone_number_id, verify_token}
  secreto_cifrado text,                       -- gmail: refresh_token; whatsapp: access token de Meta (pgp_sym_encrypt con private.clave_cifrado())
  ultima_sincronizacion timestamptz, ultimo_cursor text, resultado text,
  creado_el timestamptz not null default now(), actualizado_el timestamptz not null default now(), unique (user_id, origen)
);
alter table public.bandeja_fuentes enable row level security;
create policy bandeja_fuentes_propietario on public.bandeja_fuentes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace view public.v_bandeja_fuentes as select id, user_id, origen, activa, cuenta, configuracion, (secreto_cifrado is not null) as conectada, ultima_sincronizacion, resultado, creado_el, actualizado_el from public.bandeja_fuentes;
-- RPC: guardar_secreto_bandeja(p_fuente_id, p_secreto) [usuario o servicio] · leer_secreto_bandeja(p_fuente_id) [solo servicio]
create table if not exists public.bandeja_entradas (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  origen text not null,                       -- gmail | whatsapp | plaud | manual
  id_externo text, remitente text, remitente_nombre text, asunto text, texto text, resumen text,
  fecha timestamptz not null default now(),
  proyecto_id uuid references public.proyectos(id) on delete set null, proyecto_confianza numeric(3,2), proyecto_confirmado boolean not null default false,
  propuesta jsonb,                            -- {titulo, descripcion, prioridad, requiere_atencion, instrucciones}
  estado text not null default 'nueva',       -- nueva | clasificada | convertida | archivada | descartada
  tarea_id uuid, adjuntos jsonb not null default '[]', url_original text, datos jsonb not null default '{}',
  creado_el timestamptz not null default now(), actualizado_el timestamptz not null default now(), unique (user_id, origen, id_externo)
);
create index bandeja_entradas_idx on public.bandeja_entradas(user_id, estado, fecha desc);
alter table public.bandeja_entradas enable row level security;
create policy bandeja_entradas_propietario on public.bandeja_entradas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter publication supabase_realtime add table public.bandeja_entradas;
alter table public.proyectos add column if not exists palabras_clave text[] not null default '{}';  -- sembradas por proyecto para clasificar sin IA
-- Cron: bandeja-gmail cada 10 min → lanzar_bandeja_sincronizar() (solo si Gmail está conectado) → función bandeja {accion: programado}
-- Secretos de Edge Functions necesarios para Gmail: GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET (URI de redirección: <url_funciones>/bandeja?accion=gmail_callback)
