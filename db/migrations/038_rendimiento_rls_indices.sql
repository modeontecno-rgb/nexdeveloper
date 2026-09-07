-- ============================================================================
-- 038 · Rendimiento: políticas RLS con (select auth.uid()) e índices en claves
--       foráneas · NexDeveloper 0.37.0 · 7 de septiembre de 2026
-- Se ejecuta entero o no se ejecuta: si al final queda alguna política sin
-- reescribir, se lanza una excepción y todo se deshace.
-- ============================================================================

-- 1. Políticas RLS: auth.uid() → (select auth.uid()) para que se evalúe una
--    vez por consulta y no una vez por fila.
do $$
declare
  p record;
  v_qual text; v_wc text; v_sql text; n int := 0; restantes int;
begin
  for p in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') ~ '(?<!\(\s?select\s)auth\.uid\(\)'
        or coalesce(with_check,'') ~ '(?<!\(\s?select\s)auth\.uid\(\)')
  loop
    v_qual := regexp_replace(p.qual,       '(?<!\(\s?select\s)auth\.uid\(\)', '(select auth.uid())', 'g');
    v_wc   := regexp_replace(p.with_check, '(?<!\(\s?select\s)auth\.uid\(\)', '(select auth.uid())', 'g');

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);

    v_sql := format('create policy %I on public.%I as %s for %s to %s',
                    p.policyname, p.tablename, p.permissive, p.cmd,
                    array_to_string(p.roles, ', '));
    if v_qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if v_wc   is not null then v_sql := v_sql || format(' with check (%s)', v_wc); end if;
    execute v_sql;
    n := n + 1;
  end loop;

  select count(*) into restantes from pg_policies
   where schemaname = 'public'
     and (coalesce(qual,'') ~ '(?<!\(\s?select\s)auth\.uid\(\)'
       or coalesce(with_check,'') ~ '(?<!\(\s?select\s)auth\.uid\(\)');
  if restantes > 0 then
    raise exception 'Quedan % políticas sin reescribir; se deshace todo', restantes;
  end if;
  raise notice 'Políticas reescritas: %', n;
end $$;

-- 2. Índices en las claves foráneas que no tenían ninguno.
do $$
declare f record; n int := 0;
begin
  for f in
    select c.conrelid::regclass as tabla,
           c.conname,
           (select string_agg(a.attname, ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as columnas,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as sufijo,
           c.conrelid::regclass::text as tabla_txt
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey
      )
  loop
    execute format('create index if not exists %I on %s (%s)',
                   left('idx_' || replace(f.tabla_txt, 'public.', '') || '_' || f.sufijo, 63),
                   f.tabla, f.columnas);
    n := n + 1;
  end loop;
  raise notice 'Índices creados: %', n;
end $$;
