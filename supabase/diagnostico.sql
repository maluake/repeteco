-- ============================================================
-- REPETECO — diagnóstico (SOMENTE LEITURA: não altera nada)
-- Cole no SQL Editor, clique em Run e envie o resultado
-- (botão de copiar/baixar CSV da tabela de resultado).
-- Não mostra e-mails, senhas nem dados pessoais.
-- ============================================================
select * from (
  select 1 as ordem, 'versão' as grupo, x.item, x.valor from (values
    ('função alternar_interacao (v6)', (to_regprocedure('public.alternar_interacao(text,uuid,uuid)') is not null)::text),
    ('tabela eventos (v6)', (to_regclass('public.eventos') is not null)::text),
    ('função admin_definir_funcao (v7)', (to_regprocedure('public.admin_definir_funcao(uuid,text)') is not null)::text),
    ('coluna brechos.cep (v7)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'brechos' and column_name = 'cep')::text)
  ) as x(item, valor)

  union all
  select 2, 'funções (role) em profiles', coalesce(role, '(vazio)'), count(*)::text
  from public.profiles group by role

  union all
  select 3, 'contas sem perfil', 'auth.users sem linha em profiles',
         (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id))::text

  union all
  select 4, 'colunas ' || c.table_name, c.column_name,
         c.data_type || case when c.is_nullable = 'NO' then ' · obrigatória' else '' end
         || coalesce(' · padrão ' || c.column_default, '') || case when c.is_identity = 'YES' then ' · identity' else '' end
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name in ('curtidas', 'salvos')

  union all
  select 5, 'restrições ' || cl.relname, con.conname, pg_get_constraintdef(con.oid)
  from pg_constraint con join pg_class cl on cl.oid = con.conrelid
  where cl.relnamespace = 'public'::regnamespace and cl.relname in ('profiles', 'curtidas', 'salvos')

  union all
  select 6, 'policies ' || tablename, policyname || ' (' || cmd || ')',
         coalesce('using: ' || qual, '') || coalesce(' · check: ' || with_check, '')
  from pg_policies
  where schemaname = 'public' and tablename in ('profiles', 'curtidas', 'salvos')

  union all
  select 7, 'triggers ' || event_object_table, trigger_name, action_timing || ' ' || event_manipulation || ': ' || action_statement
  from information_schema.triggers
  where event_object_schema = 'public' and event_object_table in ('profiles', 'curtidas', 'salvos')

  union all
  select 8, 'RLS ligada', cl.relname, cl.relrowsecurity::text
  from pg_class cl
  where cl.relnamespace = 'public'::regnamespace and cl.relkind = 'r'

  union all
  select 9, 'permissões authenticated', table_name, string_agg(privilege_type, ', ' order by privilege_type)
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'authenticated' and table_name in ('profiles', 'curtidas', 'salvos', 'publicacoes')
  group by table_name

  union all
  select 10, 'linhas', 'curtidas', (select count(*) from public.curtidas)::text
  union all
  select 10, 'linhas', 'salvos', (select count(*) from public.salvos)::text

  union all
  select 11, 'armazenamento', bucket_id, count(*) || ' arquivos · ' || pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0))
  from storage.objects group by bucket_id
) d
order by ordem, grupo, item;
