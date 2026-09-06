-- NexDeveloper · Migración 031b · Editor de estilo propio (tu voz) y guía de estilo por proyecto · v0.31.0
alter table public.personal_config add column if not exists muestras_estilo text[] not null default '{}';
alter table public.personal_config add column if not exists perfil_estilo text;
alter table public.personal_config add column if not exists perfil_estilo_el timestamptz;
alter table public.proyectos add column if not exists guia_estilo text;
create table if not exists public.estilo_reescrituras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  modo text not null default 'mi_voz',                 -- mi_voz | tutor | marca
  texto_original text not null,
  texto_resultado text,
  notas jsonb,                                         -- en modo tutor: {esquema, correcciones, preguntas, fuentes_sugeridas}
  asistido_por_ia boolean not null default true,
  coste numeric not null default 0,
  creado_el timestamptz not null default now()
);
alter table public.estilo_reescrituras enable row level security;
drop policy if exists "estilo_reescrituras propias" on public.estilo_reescrituras;
create policy "estilo_reescrituras propias" on public.estilo_reescrituras for all using (user_id = auth.uid()) with check (user_id = auth.uid());
