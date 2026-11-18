-- Testes da v11 (limite de envios em contatos e evento_parcerias).
\set ON_ERROR_STOP on

reset role;
delete from public.contatos where email in ('spam@x.com', 'outra@x.com');

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_affected($q$insert into public.contatos (nome, email, mensagem) values ('Spam', 'spam@x.com', 'mensagem número um')$q$, 1, 'v11: 1º envio aceito');
select t_expect_affected($q$insert into public.contatos (nome, email, mensagem) values ('Spam', 'SPAM@x.com', 'mensagem número dois')$q$, 1, 'v11: 2º envio aceito (e-mail sem diferenciar maiúsculas)');
select t_expect_affected($q$insert into public.contatos (nome, email, mensagem) values ('Spam', 'spam@x.com', 'mensagem número três')$q$, 1, 'v11: 3º envio aceito');
select t_expect_error($q$insert into public.contatos (nome, email, mensagem) values ('Spam', 'spam@x.com', 'mensagem número quatro')$q$, 'v11: 4º envio do mesmo e-mail em 10 min é recusado');
select t_expect_affected($q$insert into public.contatos (nome, email, mensagem) values ('Outra', 'outra@x.com', 'mensagem de outra pessoa')$q$, 1, 'v11: outro e-mail continua podendo enviar');
reset role;

-- envios antigos não contam
update public.contatos set created_at = now() - interval '11 minutes' where email ilike 'spam@x.com';
set role anon;
select t_expect_affected($q$insert into public.contatos (nome, email, mensagem) values ('Spam', 'spam@x.com', 'depois de esperar')$q$, 1, 'v11: depois de 10 minutos volta a aceitar');
reset role;

-- admin não tem limite
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t_expect_affected($q$insert into public.contatos (nome, email, mensagem) select 'Admin', 'spam@x.com', 'teste da administração ' || g from generate_series(1, 4) g$q$, 4, 'v11: admin não é limitado');
reset role;

-- limite total por minuto
delete from public.contatos where email ilike 'spam@x.com' or email = 'outra@x.com';
insert into public.contatos (nome, email, mensagem, created_at) select 'Robô', 'robo' || g || '@x.com', 'mensagem automática', now() from generate_series(1, 30) g;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_error($q$insert into public.contatos (nome, email, mensagem) values ('Nova', 'nova@x.com', 'mensagem legítima')$q$, 'v11: acima de 30 envios por minuto é recusado');
reset role;
delete from public.contatos where email like 'robo%@x.com';

-- a regra também vale para parcerias de eventos
select t_expect_rows($q$select 1 from pg_trigger where tgname = 'evento_parcerias_limitar_envios'$q$, 1, 'v11: trigger em evento_parcerias');
