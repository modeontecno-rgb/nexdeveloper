-- 020b · Segundo motor de ejecución: Claude + GitHub (rama y solicitud de cambios), además de Lovable
alter table public.ejecuciones_orden
  add column if not exists motor text not null default 'lovable',      -- lovable | claude
  add column if not exists estado_agente jsonb,                        -- conversación y progreso del agente (reanudable)
  add column if not exists cambios jsonb,                              -- archivos modificados {ruta: contenido}
  add column if not exists rama text,
  add column if not exists pr_url text,
  add column if not exists pr_numero integer,
  add column if not exists pasos integer not null default 0,
  add column if not exists tokens_entrada integer not null default 0,
  add column if not exists tokens_salida integer not null default 0,
  add column if not exists coste_ia numeric not null default 0,
  add column if not exists comprobar_desde timestamptz;
alter table public.ejecucion_config
  add column if not exists motor_preferido text not null default 'auto',   -- auto | lovable | claude
  add column if not exists modelo_claude text not null default 'claude-sonnet-4-5',
  add column if not exists max_pasos smallint not null default 40,
  add column if not exists max_coste_ia numeric not null default 3;        -- € por orden con el motor Claude
