-- 016_documentacion.sql — NexDeveloper 0.16.0 «Documentación automática y documentos con Proyectian»
create table if not exists public.cierres_version (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  version text not null, titulo text, resumen text,
  cambios jsonb not null default '[]', como_probar jsonb not null default '[]', pendiente_usuario jsonb not null default '[]', tecnico jsonb not null default '[]',
  estado text not null default 'borrador',    -- borrador | cerrada | error
  hoja_md text, hoja_html text, ruta_remota_html text, ruta_remota_md text,
  proyectian_version_id uuid, proyectian_ok boolean not null default false, github_tag text, github_changelog boolean not null default false,
  ruta_mac text, redactado_por text, error text, creado_el timestamptz not null default now(), cerrada_el timestamptz, unique (proyecto_id, version)
);
alter table public.cierres_version enable row level security;
create policy cierres_version_propietario on public.cierres_version for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table if not exists public.documentos_nex (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
  proyecto_id uuid references public.proyectos(id) on delete set null,
  tipo text not null default 'otro',          -- hoja_cambios | manual | comercial | informe | video | imagen | otro
  titulo text not null, version text, nombre_archivo text, mime text, bytes bigint,
  ruta_remota text, origen text not null default 'nexdeveloper', proyectian_documento_id uuid, ruta_mac text, creado_el timestamptz not null default now()
);
alter table public.documentos_nex enable row level security;
create policy documentos_nex_propietario on public.documentos_nex for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.proyectos add column if not exists version_actual text;
alter table public.proyectos add column if not exists proyectian_slug text;
alter table public.copias_destinos add column if not exists usar_para_documentos boolean not null default false;
-- RPC de servicio: guardar_secreto_copias_servicio(destino, secreto). En Proyectian: nex_registrar_version(slug, numero, fecha, titulo, notas, cambios jsonb).
