-- ============================================================
-- REPETECO — migration v6, parte 1 de 3: curtir/salvar e peças
-- Rode DEPOIS da v5 completa. Cole ESTE ARQUIVO INTEIRO no SQL
-- Editor e clique em Run. Rode as partes em ordem (1 → 3).
-- Todas podem ser repetidas sem problema (idempotentes).
--
-- O que muda (nada é apagado):
--   * curtir/salvar passam a usar funções do banco, que conferem o
--     login e se a peça/brechó está publicado. Assim deixam de
--     depender de regras antigas das tabelas curtidas/salvos.
--   * publicacoes ganha: imagens (várias fotos), thumb_url
--     (miniatura leve para o feed) e preco_original (promoção).
-- ============================================================

-- ------------------------------------------------------------
-- Curtir / salvar: uma chamada que alterna o estado.
-- Retorna true (agora curtido/salvo) ou false (removido).
-- ------------------------------------------------------------
create or replace function public.alternar_interacao(
  p_tipo text,
  p_publicacao_id uuid default null,
  p_brecho_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tabela text;
  v_existe boolean;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para curtir ou salvar.' using errcode = '42501';
  end if;
  if p_tipo = 'curtida' then v_tabela := 'curtidas';
  elsif p_tipo = 'salvo' then v_tabela := 'salvos';
  else raise exception 'Tipo de interação inválido.' using errcode = '22023';
  end if;
  if num_nonnulls(p_publicacao_id, p_brecho_id) <> 1 then
    raise exception 'Informe uma peça ou um brechó.' using errcode = '22023';
  end if;

  if p_publicacao_id is not null then
    execute format('select exists (select 1 from public.%I where user_id = $1 and publicacao_id = $2)', v_tabela)
      into v_existe using v_user, p_publicacao_id;
    if v_existe then
      execute format('delete from public.%I where user_id = $1 and publicacao_id = $2', v_tabela)
        using v_user, p_publicacao_id;
      return false;
    end if;
    if not public.publicacao_visivel(p_publicacao_id) then
      raise exception 'Esta peça não está disponível.' using errcode = '42501';
    end if;
    execute format('insert into public.%I (user_id, publicacao_id) values ($1, $2)', v_tabela)
      using v_user, p_publicacao_id;
    return true;
  end if;

  -- brecho_id pode ser text ou uuid conforme a origem da tabela:
  -- compara como texto e insere como literal (vale para os dois tipos).
  execute format('select exists (select 1 from public.%I where user_id = $1 and brecho_id::text = $2)', v_tabela)
    into v_existe using v_user, p_brecho_id::text;
  if v_existe then
    execute format('delete from public.%I where user_id = $1 and brecho_id::text = $2', v_tabela)
      using v_user, p_brecho_id::text;
    return false;
  end if;
  if not public.brecho_aprovado(p_brecho_id) then
    raise exception 'Este brechó não está disponível.' using errcode = '42501';
  end if;
  execute format('insert into public.%I (user_id, brecho_id) values ($1, %L)', v_tabela, p_brecho_id::text)
    using v_user;
  return true;
end;
$$;

-- Curtidas e salvos da própria conta (nunca de outra pessoa).
create or replace function public.minhas_interacoes()
returns table (tipo text, publicacao_id uuid, brecho_id text)
language sql
stable
security definer
set search_path = public
as $$
  select 'curtida'::text, c.publicacao_id, c.brecho_id::text from public.curtidas c where c.user_id = auth.uid()
  union all
  select 'salvo'::text, s.publicacao_id, s.brecho_id::text from public.salvos s where s.user_id = auth.uid();
$$;

revoke execute on function public.alternar_interacao(text, uuid, uuid) from anon;
revoke execute on function public.minhas_interacoes() from anon;
grant execute on function public.alternar_interacao(text, uuid, uuid) to authenticated;
grant execute on function public.minhas_interacoes() to authenticated;

-- ------------------------------------------------------------
-- Peças: várias fotos, miniatura e promoção
-- imagens = [{ "url", "path", "thumb_url", "thumb_path", "alt" }]
-- A primeira foto é a capa (imagem_url / thumb_url).
-- ------------------------------------------------------------
alter table public.publicacoes add column if not exists imagens jsonb not null default '[]'::jsonb;
alter table public.publicacoes add column if not exists thumb_url text;
alter table public.publicacoes add column if not exists thumb_path text;
alter table public.publicacoes add column if not exists preco_original numeric(10, 2);

do $$ begin
  alter table public.publicacoes add constraint publicacoes_imagens_max
    check (jsonb_typeof(imagens) = 'array' and jsonb_array_length(imagens) <= 8) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.publicacoes add constraint publicacoes_promocao_valida
    check (preco_original is null or (preco is not null and preco_original > preco)) not valid;
exception when duplicate_object then null; end $$;

-- Peças antigas: a foto única vira a primeira da galeria.
update public.publicacoes
set imagens = jsonb_build_array(jsonb_build_object('url', imagem_url, 'path', imagem_path, 'alt', alt_text))
where imagens = '[]'::jsonb and imagem_url is not null;

create index if not exists idx_publicacoes_promocao on public.publicacoes(preco_original) where preco_original is not null;

-- O tamanho do bucket de fotos de brechó cai para 2 MB: as fotos já
-- são reduzidas no navegador (normalmente ficam entre 80 e 200 KB).
update storage.buckets set file_size_limit = 2097152 where id = 'brechos';
