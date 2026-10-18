-- ============================================================
-- Testes da migration v6 (rodam depois de 10_rls_test.sql, que
-- cria os usuários, brechós e peças usados aqui).
-- ============================================================
\set ON_ERROR_STOP on

-- ---------- curtir / salvar via função ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_error($q$select public.alternar_interacao('curtida', '20000000-0000-0000-0000-000000000001')$q$, 'anon não usa alternar_interacao');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select t_expect_rows($q$select 1 where public.alternar_interacao('curtida', '20000000-0000-0000-0000-000000000001') = true$q$, 1, 'função curte a peça');
select t_expect_rows($q$select * from public.minhas_interacoes() where tipo = 'curtida' and publicacao_id = '20000000-0000-0000-0000-000000000001'$q$, 1, 'minhas_interacoes devolve a curtida');
select t_expect_rows($q$select 1 where public.alternar_interacao('curtida', '20000000-0000-0000-0000-000000000001') = false$q$, 1, 'segunda chamada descurte');
select t_expect_rows($q$select 1 where public.alternar_interacao('salvo', null, '10000000-0000-0000-0000-000000000001') = false$q$, 1, 'salvo de brechó já existente é removido');
select t_expect_rows($q$select 1 where public.alternar_interacao('salvo', null, '10000000-0000-0000-0000-000000000001') = true$q$, 1, 'função salva o brechó (brecho_id text ou uuid)');
select t_expect_error($q$select public.alternar_interacao('curtida', '20000000-0000-0000-0000-000000000002')$q$, 'não curte rascunho pela função');
select t_expect_error($q$select public.alternar_interacao('salvo', null, '10000000-0000-0000-0000-000000000002')$q$, 'não salva brechó não aprovado');
select t_expect_error($q$select public.alternar_interacao('hack', '20000000-0000-0000-0000-000000000001')$q$, 'tipo inválido recusado');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select t_expect_rows($q$select * from public.minhas_interacoes()$q$, 0, 'minhas_interacoes não mostra a conta de outra pessoa');
-- galeria e promoção
select t_expect_affected($q$update public.publicacoes set imagens = '[{"url":"https://x/1.webp"},{"url":"https://x/2.webp"}]', preco_original = 120 where id = '20000000-0000-0000-0000-000000000001'$q$, 1, 'dona salva galeria e promoção');
select t_expect_error($q$update public.publicacoes set preco_original = 10 where id = '20000000-0000-0000-0000-000000000001'$q$, 'preço original menor que o atual é recusado');
select t_expect_error($q$update public.publicacoes set imagens = '[1,2,3,4,5,6,7,8,9]' where id = '20000000-0000-0000-0000-000000000001'$q$, 'mais de 8 fotos é recusado');
select t_expect_affected($q$update public.brechos set modalidade = 'ambos', loja_online_url = 'https://loja.x' where id = '10000000-0000-0000-0000-000000000001'$q$, 1, 'dona define brechó físico + online');
select t_expect_error($q$update public.brechos set modalidade = 'nuvem' where id = '10000000-0000-0000-0000-000000000001'$q$, 'modalidade inválida recusada');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_rows($q$select * from public.feed_publicacoes where em_promocao and jsonb_array_length(imagens) = 2$q$, 1, 'feed expõe galeria e promoção');
select t_expect_rows($q$select * from public.brechos_publicos where modalidade = 'ambos' and loja_online_url is not null$q$, 1, 'view pública mostra modalidade e loja online');
reset role;

-- ---------- eventos e parcerias ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select t_expect_error($q$insert into public.eventos (titulo, data_inicio) values ('Feira falsa', now() + interval '3 days')$q$, 'usuária não cria evento');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t_expect_affected($q$insert into public.eventos (id, titulo, data_inicio, status) values ('40000000-0000-0000-0000-000000000001', 'Feira de Brechós da Vila', now() + interval '10 days', 'publicado')$q$, 1, 'admin cria evento publicado');
select t_expect_affected($q$insert into public.eventos (id, titulo, data_inicio) values ('40000000-0000-0000-0000-000000000002', 'Evento em preparo', now() + interval '20 days')$q$, 1, 'admin cria rascunho de evento');
select t_expect_error($q$insert into public.eventos (titulo, data_inicio, data_fim) values ('Datas trocadas', now() + interval '2 days', now())$q$, 'fim antes do início é recusado');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_rows('select * from public.eventos', 1, 'público vê só eventos publicados');
select t_expect_affected($q$insert into public.evento_parcerias (evento_id, nome, email, tipo, mensagem) values ('40000000-0000-0000-0000-000000000001', 'Ana', 'ana@x.com', 'expositor', 'Quero expor')$q$, 1, 'visitante manifesta interesse em parceria');
select t_expect_error($q$insert into public.evento_parcerias (evento_id, nome, email) values ('40000000-0000-0000-0000-000000000002', 'Ana', 'ana@x.com')$q$, 'parceria em rascunho é recusada');
select t_expect_error($q$insert into public.evento_parcerias (evento_id, nome, email, status) values ('40000000-0000-0000-0000-000000000001', 'Ana', 'ana@x.com', 'confirmada')$q$, 'visitante não marca parceria como confirmada');
select t_expect_rows('select * from public.evento_parcerias', 0, 'visitante não lê parcerias');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select t_expect_affected($q$insert into public.evento_parcerias (evento_id, user_id, nome, email) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'Clara', 'c@x.com')$q$, 1, 'usuária envia interesse vinculado à conta');
select t_expect_error($q$insert into public.evento_parcerias (evento_id, nome, email, brecho_id) values ('40000000-0000-0000-0000-000000000001', 'Clara', 'c@x.com', '10000000-0000-0000-0000-000000000001')$q$, 'usuária não se passa por brechó alheio');
select t_expect_rows('select * from public.evento_parcerias', 1, 'usuária vê só o próprio interesse');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t_expect_rows('select * from public.evento_parcerias', 2, 'admin vê todas as parcerias');
select t_expect_affected($q$update public.evento_parcerias set status = 'em_conversa' where nome = 'Ana'$q$, 1, 'admin atualiza status da parceria');
select t_expect_rows($q$select 1 where (public.admin_resumo()->>'eventos_proximos')::int = 1 and (public.admin_resumo()->>'parcerias_novas')::int = 1$q$, 1, 'resumo admin conta eventos e parcerias');
reset role;

\echo '>>> TESTES DA V6 PASSARAM'
