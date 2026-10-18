-- ============================================================
-- Testes de segurança (RLS, triggers e funções) da migration v5.
-- Rodar em Postgres local após 00_supabase_stub, 01 e 02:
--   ./supabase/tests/run.sh
-- Qualquer falha interrompe o script com ON_ERROR_STOP.
-- ============================================================
\set ON_ERROR_STOP on

-- Helpers (rodam com os privilégios de quem chama)
create or replace function public.t_expect_error(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok (bloqueado): % -> %', p_label, sqlerrm;
    return;
  end;
  raise exception 'FALHOU — deveria ter sido bloqueado: %', p_label;
end $$;

create or replace function public.t_expect_rows(p_sql text, p_expected int, p_label text)
returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || p_sql || ') t' into n;
  if n <> p_expected then
    raise exception 'FALHOU — %: esperado %, obtido %', p_label, p_expected, n;
  end if;
  raise notice 'ok: % (%)', p_label, n;
end $$;

create or replace function public.t_expect_affected(p_sql text, p_expected int, p_label text)
returns void language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  if n <> p_expected then
    raise exception 'FALHOU — %: esperado % linha(s) afetada(s), obtido %', p_label, p_expected, n;
  end if;
  raise notice 'ok: %', p_label;
end $$;
grant execute on function public.t_expect_error(text, text), public.t_expect_rows(text, int, text), public.t_expect_affected(text, int, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Seed (como postgres)
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@x.com', '{"nome":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'dona@x.com',  '{"nome":"Dona Um"}'),
  ('00000000-0000-0000-0000-00000000000c', 'user@x.com',  '{"nome":"Usuária"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dona2@x.com', '{"nome":"Dona Dois"}');

do $$ begin
  if (select count(*) from public.profiles) <> 4 then raise exception 'FALHOU — trigger handle_new_user não criou perfis'; end if;
  if exists (select 1 from public.profiles where role <> 'usuario') then raise exception 'FALHOU — perfil novo deveria ser usuario'; end if;
end $$;

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.brechos (id, user_id, nome, cidade, bairro, email_responsavel, nome_responsavel, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Garimpo da Vila', 'São Paulo', 'Pinheiros', 'privado@dona.com', 'Dona Um', 'pending'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', 'Garimpo da Vila', 'São Paulo', 'Moema', 'privado2@dona.com', 'Dona Dois', 'pending');

update public.brechos set status = 'approved' where id = '10000000-0000-0000-0000-000000000001';

do $$ begin
  if (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000b') <> 'dono' then
    raise exception 'FALHOU — aprovação não promoveu responsável a dono';
  end if;
  if (select slug from public.brechos where id = '10000000-0000-0000-0000-000000000001') <> 'garimpo-da-vila' then
    raise exception 'FALHOU — slug não gerado';
  end if;
  if (select slug from public.brechos where id = '10000000-0000-0000-0000-000000000002') = 'garimpo-da-vila' then
    raise exception 'FALHOU — slug duplicado';
  end if;
  raise notice 'ok: seed, trigger de role e slugs';
end $$;

-- ------------------------------------------------------------
-- Visitante anônimo
-- ------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_rows('select * from public.brechos', 0, 'anon não lê a tabela brechos (dados privados)');
select t_expect_rows('select * from public.brechos_publicos', 1, 'anon lê somente brechós aprovados pela view');
select t_expect_error('select email_responsavel from public.brechos_publicos', 'view pública não expõe e-mail do responsável');
select t_expect_rows('select * from public.profiles', 0, 'anon não lê perfis');
select t_expect_error($q$insert into public.curtidas (user_id, brecho_id) values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001')$q$, 'anon não curte em nome de outra pessoa');
select t_expect_affected($q$insert into public.contatos (nome, email, mensagem) values ('Ana', 'ana@x.com', 'Mensagem de teste com tamanho')$q$, 1, 'anon envia contato');
select t_expect_rows('select * from public.contatos', 0, 'anon não lê contatos');
select t_expect_affected($q$insert into public.brecho_eventos (brecho_id, tipo) values ('10000000-0000-0000-0000-000000000001', 'view')$q$, 1, 'anon registra visita em brechó aprovado');
select t_expect_error($q$insert into public.brecho_eventos (brecho_id, tipo) values ('10000000-0000-0000-0000-000000000002', 'view')$q$, 'evento em brechó pendente é recusado');
reset role;

-- ------------------------------------------------------------
-- Usuária comum
-- ------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select t_expect_error($q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c'$q$, 'usuária não se promove a admin');
select t_expect_affected($q$update public.profiles set nome = 'Usuária Nova', bio = 'garimpo', avatar_url = 'https://x/a.webp' where id = '00000000-0000-0000-0000-00000000000c'$q$, 1, 'usuária edita o próprio perfil');
select t_expect_affected($q$update public.profiles set nome = 'hack' where id = '00000000-0000-0000-0000-00000000000b'$q$, 0, 'usuária não edita perfil alheio');
select t_expect_rows('select * from public.profiles', 1, 'usuária lê só o próprio perfil');
select t_expect_error($q$insert into public.publicacoes (brecho_id, titulo, imagem_url) values ('10000000-0000-0000-0000-000000000001', 'Golpe', 'https://x')$q$, 'usuária não publica em brechó alheio');
select t_expect_error($q$select public.estatisticas_brecho('10000000-0000-0000-0000-000000000001')$q$, 'usuária não vê estatísticas de brechó');
select t_expect_error('select public.admin_resumo()', 'usuária não vê resumo admin');
select t_expect_error('select * from public.admin_listar_usuarios()', 'usuária não lista usuários');
select t_expect_error($q$insert into public.artigos (titulo, conteudo) values ('Artigo falso', 'x')$q$, 'usuária não cria artigo');
select t_expect_affected($q$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000c/avatar.webp')$q$, 1, 'usuária envia avatar na própria pasta');
select t_expect_error($q$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000b/avatar.webp')$q$, 'usuária não envia arquivo na pasta de outra pessoa');
select t_expect_error($q$insert into storage.objects (bucket_id, name) values ('brechos', '00000000-0000-0000-0000-00000000000c/x.webp')$q$, 'usuária sem brechó não usa bucket brechos');
select t_expect_error($q$insert into storage.objects (bucket_id, name) values ('editorial', '00000000-0000-0000-0000-00000000000c/x.webp')$q$, 'usuária não usa bucket editorial');
-- cadastro de brechó: status forçado para pending
insert into public.brechos (id, user_id, nome, cidade, bairro, status) values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', 'Meu Brechó', 'São Paulo', 'Sé', 'approved');
select t_expect_rows($q$select * from public.brechos where id = '10000000-0000-0000-0000-000000000003' and status = 'pending'$q$, 1, 'cadastro com status approved é forçado para pending');
reset role;

-- ------------------------------------------------------------
-- Dona de brechó aprovado
-- ------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select t_expect_affected($q$update public.brechos set descricao = 'Peças dos anos 80', latitude = -23.56, longitude = -46.69 where id = '10000000-0000-0000-0000-000000000001'$q$, 1, 'dona edita o próprio brechó');
select t_expect_affected($q$update public.brechos set descricao = 'hack' where id = '10000000-0000-0000-0000-000000000002'$q$, 0, 'dona não edita brechó alheio');
select t_expect_error($q$update public.brechos set user_id = '00000000-0000-0000-0000-00000000000c' where id = '10000000-0000-0000-0000-000000000001'$q$, 'dona não transfere o brechó');
select t_expect_affected($q$insert into public.publicacoes (id, brecho_id, titulo, imagem_url, tipo, tamanho, preco, condicao) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Vestido midi floral', 'https://x/v.webp', 'vestido', 'M', 80, 'otimo')$q$, 1, 'dona publica peça');
select t_expect_affected($q$insert into public.publicacoes (id, brecho_id, titulo, imagem_url, status) values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Rascunho', 'https://x/r.webp', 'rascunho')$q$, 1, 'dona salva rascunho');
select t_expect_error($q$insert into public.publicacoes (brecho_id, titulo, imagem_url) values ('10000000-0000-0000-0000-000000000002', 'Golpe', 'https://x')$q$, 'dona não publica em brechó alheio');
select t_expect_affected($q$insert into storage.objects (bucket_id, name) values ('brechos', '00000000-0000-0000-0000-00000000000b/peca.webp')$q$, 1, 'dona envia imagem para o bucket brechos');
select t_expect_rows($q$select public.estatisticas_brecho('10000000-0000-0000-0000-000000000001')$q$, 1, 'dona vê estatísticas do próprio brechó');
select t_expect_error($q$select public.estatisticas_brecho('10000000-0000-0000-0000-000000000002')$q$, 'dona não vê estatísticas de outro brechó');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select t_expect_error($q$update public.brechos set status = 'approved' where id = '10000000-0000-0000-0000-000000000002'$q$, 'dona com cadastro pendente não se autoaprova');
select t_expect_error($q$insert into public.publicacoes (brecho_id, titulo, imagem_url) values ('10000000-0000-0000-0000-000000000002', 'Antes da aprovação', 'https://x')$q$, 'brechó pendente não publica');
select t_expect_rows('select * from public.brechos', 1, 'dona pendente lê o próprio cadastro');
reset role;

-- ------------------------------------------------------------
-- Curtidas e salvos
-- ------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select t_expect_affected($q$insert into public.curtidas (user_id, publicacao_id) values ('00000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000001')$q$, 1, 'usuária curte peça');
select t_expect_error($q$insert into public.curtidas (user_id, publicacao_id) values ('00000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000001')$q$, 'curtida duplicada é recusada');
select t_expect_affected($q$insert into public.salvos (user_id, publicacao_id) values ('00000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000001')$q$, 1, 'usuária salva peça');
select t_expect_affected($q$insert into public.salvos (user_id, brecho_id) values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001')$q$, 1, 'usuária salva brechó');
select t_expect_error($q$insert into public.curtidas (user_id, publicacao_id) values ('00000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000002')$q$, 'não curte rascunho');
select t_expect_error($q$insert into public.curtidas (user_id, publicacao_id) values ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001')$q$, 'não curte em nome de outra pessoa');
select t_expect_error($q$insert into public.curtidas (user_id, brecho_id, publicacao_id) values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')$q$, 'curtida precisa de um único alvo');
select t_expect_rows('select * from public.feed_publicacoes where total_curtidas = 1', 1, 'contador público de curtidas');
select t_expect_rows('select * from public.feed_publicacoes', 1, 'feed não mostra rascunho');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select t_expect_rows('select * from public.curtidas', 0, 'dona não vê quem curtiu (só agregados)');
select t_expect_affected($q$delete from public.curtidas where publicacao_id = '20000000-0000-0000-0000-000000000001'$q$, 0, 'dona não remove curtida alheia');
select t_expect_rows($q$select 1 where (public.estatisticas_brecho('10000000-0000-0000-0000-000000000001')->>'curtidas_publicacoes')::int = 1$q$, 1, 'estatística conta curtidas reais');
select t_expect_rows('select * from public.publicacoes', 2, 'dona vê os próprios rascunhos');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select t_expect_affected($q$delete from public.curtidas where publicacao_id = '20000000-0000-0000-0000-000000000001'$q$, 1, 'usuária remove a própria curtida');
reset role;

-- ------------------------------------------------------------
-- Administração
-- ------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select t_expect_rows('select * from public.brechos', 3, 'admin lê todos os brechós');
select t_expect_rows('select * from public.admin_listar_usuarios() where email is not null', 4, 'admin lista usuários com e-mail');
select t_expect_rows($q$select 1 where (public.admin_resumo()->>'brechos_pendentes')::int = 2$q$, 1, 'resumo admin com dados reais');
select t_expect_rows('select * from public.contatos', 1, 'admin lê mensagens de contato');
select t_expect_affected($q$update public.brechos set status = 'approved' where id = '10000000-0000-0000-0000-000000000002'$q$, 1, 'admin aprova brechó');
select t_expect_affected($q$insert into public.artigos (id, titulo, subtitulo, conteudo, categoria) values ('30000000-0000-0000-0000-000000000001', 'Como garimpar em São Paulo', 'Guia', 'Texto', 'guias')$q$, 1, 'admin cria rascunho');
select t_expect_affected($q$update public.artigos set status = 'publicado' where id = '30000000-0000-0000-0000-000000000001'$q$, 1, 'admin publica artigo');
select t_expect_affected($q$insert into storage.objects (bucket_id, name) values ('editorial', '00000000-0000-0000-0000-00000000000a/capa.webp')$q$, 1, 'admin envia capa editorial');
select t_expect_affected($q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c'$q$, 1, 'admin altera role');
select t_expect_affected($q$update public.profiles set role = 'usuario' where id = '00000000-0000-0000-0000-00000000000c'$q$, 1, 'admin reverte role');
reset role;

do $$ begin
  if (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000d') <> 'dono' then
    raise exception 'FALHOU — aprovação pelo admin não promoveu a dona 2';
  end if;
  if (select slug from public.artigos where id = '30000000-0000-0000-0000-000000000001') <> 'como-garimpar-em-sao-paulo' then
    raise exception 'FALHOU — slug do artigo';
  end if;
  if (select publicado_em from public.artigos where id = '30000000-0000-0000-0000-000000000001') is null
     or (select autor_nome from public.artigos where id = '30000000-0000-0000-0000-000000000001') <> 'Admin' then
    raise exception 'FALHOU — publicado_em/autor_nome';
  end if;
  raise notice 'ok: aprovação, slug, autoria e data de publicação';
end $$;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_rows($q$select * from public.artigos$q$, 1, 'artigo publicado aparece para o público');
reset role;

-- Recusa rebaixa a role; edição da dona reenvia para análise.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.brechos set status = 'rejected' where id = '10000000-0000-0000-0000-000000000002';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select t_expect_affected($q$update public.brechos set descricao = 'corrigido' where id = '10000000-0000-0000-0000-000000000002'$q$, 1, 'dona corrige cadastro recusado');
reset role;
do $$ begin
  if (select status from public.brechos where id = '10000000-0000-0000-0000-000000000002') <> 'pending' then
    raise exception 'FALHOU — edição de cadastro recusado deveria voltar para pending';
  end if;
  if (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000d') <> 'usuario' then
    raise exception 'FALHOU — recusa deveria rebaixar para usuario';
  end if;
  raise notice 'ok: recusa e reenvio';
end $$;

\echo '>>> TODOS OS TESTES DE SEGURANÇA PASSARAM'
