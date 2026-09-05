-- 005_politica_aprendido.sql
-- Estrategia de enrutado «aprendido», vista de rendimiento por tarea y modelo,
-- y columna «cuenta» para proveedores conectados por OAuth (Canva).
-- Este guion es repetible: se puede ejecutar varias veces sin romper nada.

/* ------------------------- Estrategia «aprendido» -------------------------- */

-- Nota: ejecuta esta línea sola (fuera de cualquier transacción) si tu cliente
-- de SQL agrupa todo el guion en una transacción.
alter type estrategia_enrutado add value if not exists 'aprendido';


/* ------------------ Cuenta conectada (OAuth, p. ej. Canva) ----------------- */

alter table public.proveedores_ia add column if not exists cuenta text;

grant select (cuenta) on public.proveedores_ia to authenticated;
grant update (cuenta) on public.proveedores_ia to authenticated;

create or replace view public.v_proveedores_ia
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.nombre,
  p.clave_slug,
  p.tipo,
  p.activo,
  (p.clave_cifrada is not null and p.clave_cifrada <> '') as tiene_clave,
  p.url_base,
  p.notas,
  p.cuenta,
  p.created_at,
  p.updated_at
from public.proveedores_ia p;

grant select on public.v_proveedores_ia to authenticated;
grant all on public.v_proveedores_ia to service_role;

/* ------------------------- Rendimiento por modelo -------------------------- */

-- Métricas de los últimos 30 días agrupadas por tipo de trabajo y modelo.
-- El tipo de trabajo se toma de las tareas aconsejadas del propio modelo,
-- que es lo que usa la política de enrutado para elegir candidatos.
create or replace view public.v_rendimiento_modelos
with (security_invoker = true) as
select
  c.user_id,
  t.tarea,
  c.modelo_id,
  count(*)::integer                                                       as trabajos,
  round(avg(case when c.resultado = 'ok' then 1 else 0 end) * 100, 1)     as porcentaje_ok,
  round(avg(c.coste), 6)                                                  as coste_medio,
  round(avg(c.duracion_ms))::integer                                      as duracion_media_ms,
  max(c.created_at)                                                       as ultimo_uso
from public.consumos_ia c
join public.modelos_ia m on m.id = c.modelo_id
cross join lateral unnest(m.tareas_aconsejadas) as t(tarea)
where c.created_at >= now() - interval '30 days'
group by c.user_id, t.tarea, c.modelo_id;

grant select on public.v_rendimiento_modelos to authenticated;
grant all on public.v_rendimiento_modelos to service_role;
