-- ============================================================
-- Testes da migration v7 (rodam depois de 10 e 20).
-- ============================================================
\set ON_ERROR_STOP on

-- ---------- troca de função pela administração ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select t_expect_error($q$select public.admin_definir_funcao('00000000-0000-0000-0000-00000000000c', 'admin')$q$, 'usuária não se promove pela função');
select t_expect_error($q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c'$q$, 'usuária não se promove pela tabela');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t_expect_rows($q$select 1 where public.admin_definir_funcao('00000000-0000-0000-0000-00000000000c', 'dono') = 'dono'$q$, 1, 'admin muda usuária para dono');
select t_expect_rows($q$select * from public.admin_listar_usuarios() where id = '00000000-0000-0000-0000-00000000000c' and role = 'dono'$q$, 1, 'lista de pessoas mostra a nova função');
select t_expect_rows($q$select 1 where public.admin_definir_funcao('00000000-0000-0000-0000-00000000000c', 'admin') = 'admin'$q$, 1, 'admin promove a admin');
select t_expect_rows($q$select 1 where public.admin_definir_funcao('00000000-0000-0000-0000-00000000000c', 'usuario') = 'usuario'$q$, 1, 'admin volta para usuária');
select t_expect_error($q$select public.admin_definir_funcao('00000000-0000-0000-0000-00000000000c', 'superadmin')$q$, 'função inválida recusada');
select t_expect_error($q$select public.admin_definir_funcao('00000000-0000-0000-0000-00000000000a', 'usuario')$q$, 'admin não remove o próprio acesso');
select t_expect_error($q$select public.admin_definir_funcao('99999999-0000-0000-0000-000000000000', 'dono')$q$, 'conta inexistente recusada');
reset role;
insert into storage.objects (bucket_id, name, metadata, created_at) values
  ('brechos', '00000000-0000-0000-0000-00000000000b/orfao.webp', '{"size": 180000}', now() - interval '3 days'),
  ('brechos', '00000000-0000-0000-0000-00000000000b/usada.webp', '{"size": 90000}', now() - interval '3 days');
update public.brechos set foto_capa = 'https://x.supabase.co/storage/v1/object/public/brechos/00000000-0000-0000-0000-00000000000b/usada.webp'
  where id = '10000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t_expect_rows($q$select * from public.admin_uso_armazenamento() where caminho like '%/orfao.webp' and not em_uso and bytes = 180000$q$, 1, 'relatório marca arquivo sem uso');
select t_expect_rows($q$select * from public.admin_uso_armazenamento() where caminho like '%/usada.webp' and em_uso$q$, 1, 'relatório marca arquivo em uso');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select t_expect_error($q$select * from public.admin_uso_armazenamento()$q$, 'relatório de armazenamento é só da administração');
-- curtir continua funcionando depois do reparo (inclusive com id sem padrão no legado)
select t_expect_rows($q$select 1 where public.alternar_interacao('curtida', '20000000-0000-0000-0000-000000000001') = true$q$, 1, 'curtir grava após o reparo');
select t_expect_rows($q$select 1 where public.alternar_interacao('salvo', '20000000-0000-0000-0000-000000000001') <> public.alternar_interacao('salvo', '20000000-0000-0000-0000-000000000001')$q$, 1, 'salvar peça alterna após o reparo');
reset role;

-- ---------- CEP ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select t_expect_affected($q$update public.brechos set cep = '05422030' where id = '10000000-0000-0000-0000-000000000001'$q$, 1, 'dona salva o CEP');
select t_expect_error($q$update public.brechos set cep = '0542-030' where id = '10000000-0000-0000-0000-000000000001'$q$, 'CEP fora do formato é recusado');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_error($q$select cep from public.brechos_publicos$q$, 'CEP não aparece na view pública');
reset role;
