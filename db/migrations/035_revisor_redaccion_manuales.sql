-- NexDeveloper · 035 · Revisor de redacción de manuales (0.35.0)
-- Añade a la configuración de manuales la pasada de revisión de redacción (ortografía, gramática, tono,
-- nombres de producto y guía de estilo propia) y guarda en cada manual el resumen de la revisión.

alter table public.manuales_config
  add column if not exists revisar_redaccion boolean not null default true,
  add column if not exists tratamiento text not null default 'usted',
  add column if not exists nivel_revision text not null default 'normal',
  add column if not exists usar_perfil_estilo boolean not null default true,
  add column if not exists glosario text[] not null default '{}';

alter table public.manuales_config
  drop constraint if exists manuales_config_tratamiento_check,
  add constraint manuales_config_tratamiento_check check (tratamiento in ('usted', 'tu')),
  drop constraint if exists manuales_config_nivel_revision_check,
  add constraint manuales_config_nivel_revision_check check (nivel_revision in ('ligera', 'normal', 'exhaustiva'));

comment on column public.manuales_config.revisar_redaccion is 'Pasar el Revisor de redacción (IA) a cada capítulo antes de publicar el manual.';
comment on column public.manuales_config.tratamiento is 'Tratamiento al lector: usted o tú.';
comment on column public.manuales_config.nivel_revision is 'ligera = solo errores; normal = errores + claridad; exhaustiva = además reescribe frases largas y unifica el tono.';
comment on column public.manuales_config.usar_perfil_estilo is 'Aplicar el perfil de estilo aprendido en PERSONAL → Editor de estilo.';
comment on column public.manuales_config.glosario is 'Nombres de producto y términos que el revisor debe respetar tal cual.';

alter table public.manuales
  add column if not exists revision jsonb,
  add column if not exists revisado_el timestamptz;

comment on column public.manuales.revision is 'Resumen de la revisión de redacción: {capitulos, correcciones, ejemplos[], nivel, tratamiento, modelo}.';
