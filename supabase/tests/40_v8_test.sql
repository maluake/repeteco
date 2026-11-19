-- ============================================================
-- Testes da migration v8 (colunas antigas de pessoa).
-- No cenário legado-manual, salvos tem usuario_id uuid obrigatório e
-- curtidas tem id_usuario text obrigatório + coluna "origem".
-- ============================================================
\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select t_expect_rows($q$select 1 where public.alternar_interacao('salvo', '20000000-0000-0000-0000-000000000001') = true$q$, 1, 'v8: salvar grava com coluna antiga obrigatória');
select t_expect_rows($q$select 1 where public.alternar_interacao('curtida', '20000000-0000-0000-0000-000000000001') = true$q$, 1, 'v8: curtir grava com coluna antiga obrigatória');
select t_expect_rows($q$select * from public.minhas_interacoes()$q$, 2, 'v8: minhas_interacoes vê as duas');
reset role;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'salvos' and column_name = 'usuario_id') then
    if exists (select 1 from public.salvos where usuario_id is distinct from user_id) then
      raise exception 'FALHOU — v8: salvos.usuario_id diferente de user_id';
    end if;
    raise notice 'ok: v8: salvos.usuario_id acompanha user_id';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'curtidas' and column_name = 'id_usuario') then
    if exists (select 1 from public.curtidas where id_usuario is distinct from user_id::text) then
      raise exception 'FALHOU — v8: curtidas.id_usuario diferente de user_id';
    end if;
    raise notice 'ok: v8: curtidas.id_usuario (text) acompanha user_id';
  end if;
end $$;

-- inserção feita por código antigo (só com a coluna antiga) também preenche user_id
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'salvos' and column_name = 'usuario_id') then
    insert into public.salvos (usuario_id, publicacao_id) values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001');
    if not exists (select 1 from public.salvos where publicacao_id = '20000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-00000000000a') then
      raise exception 'FALHOU — v8: insert antigo não preencheu user_id';
    end if;
    raise notice 'ok: v8: insert só com usuario_id preenche user_id';
  end if;
end $$;
