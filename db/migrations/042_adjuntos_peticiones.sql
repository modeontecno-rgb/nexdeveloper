-- 042 · Adjuntos de peticiones (capturas, PDF y documentos) · NexDeveloper 0.42.0
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos-peticiones', 'adjuntos-peticiones', false, 20971520,
  array['image/png','image/jpeg','image/webp','image/heic','image/gif','application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv','text/plain','text/markdown','application/json'])
on conflict (id) do nothing;

create table if not exists public.peticiones_adjuntos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  peticion_id uuid references public.peticiones_directas(id) on delete set null, -- también vale para borradores (son filas de peticiones_directas en estado «borrador»)
  conversacion_id uuid,
  chat_id uuid references public.chats(id) on delete set null,
  ruta text not null unique,
  nombre text not null,
  tipo_mime text not null,
  tamano_bytes bigint not null check (tamano_bytes >= 0 and tamano_bytes <= 20971520),
  texto_extraido text,
  estado text not null default 'subido' check (estado in ('subido','analizado','sin_texto','error')),
  creado_el timestamptz not null default now()
);

create index if not exists peticiones_adjuntos_user_idx on public.peticiones_adjuntos(user_id, creado_el desc);
create index if not exists peticiones_adjuntos_peticion_idx on public.peticiones_adjuntos(peticion_id);

alter table public.peticiones_adjuntos enable row level security;

drop policy if exists "adjuntos: propietario" on public.peticiones_adjuntos;
create policy "adjuntos: propietario" on public.peticiones_adjuntos
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.peticiones_adjuntos to authenticated;

drop policy if exists "adjuntos: leer los propios" on storage.objects;
create policy "adjuntos: leer los propios" on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos-peticiones' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "adjuntos: subir los propios" on storage.objects;
create policy "adjuntos: subir los propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos-peticiones' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "adjuntos: borrar los propios" on storage.objects;
create policy "adjuntos: borrar los propios" on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos-peticiones' and (storage.foldername(name))[1] = (select auth.uid())::text);
