-- ============================================================
-- REPETECO — migration v5 (produto)
--
-- Rode DEPOIS de 01_base_v4.sql, no SQL Editor do Supabase.
-- É idempotente: pode ser executada mais de uma vez.
--
-- Nada é apagado. Alterações em estruturas existentes:
--   * profiles: trigger impede que não-admins alterem a própria role
--     (antes qualquer usuário podia se promover a admin via API).
--   * brechos: trigger impede que donos aprovem o próprio brechó ou
--     troquem o user_id; status 'aprovado'/'recusado' (pt) são
--     normalizados para 'approved'/'rejected'; nova coluna slug.
--   * brechos: a leitura pública direta da tabela deixa de existir.
--     O público passa a ler a view brechos_publicos, que não expõe
--     nome/e-mail do responsável. Dono e admin continuam lendo a tabela.
--   * curtidas/salvos: brecho_id deixa de ser obrigatório para permitir
--     curtir/salvar publicações (nova coluna publicacao_id).
-- Novas estruturas: publicacoes, artigos, contatos, views públicas,
-- funções de estatística e buckets/policies do Storage.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 0. Utilitários
-- ------------------------------------------------------------
create or replace function public.slugify(txt text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(
    lower(translate(coalesce(txt, ''),
      'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g')), ''), 'item')
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Verdadeiro quando a requisição vem de um cliente (anon/authenticated)
-- sem privilégio de administrador. Funções security definer e o SQL
-- Editor rodam como postgres e não são afetados.
create or replace function public.is_client_request()
returns boolean
language sql
stable
as $$
  select current_user in ('anon', 'authenticated') and not public.is_admin()
$$;

create or replace function public.brecho_aprovado(p_brecho_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.brechos where id = p_brecho_id and status = 'approved');
$$;

-- ------------------------------------------------------------
-- 1. PROFILES — impedir escalonamento de privilégio
-- ------------------------------------------------------------
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.profiles add constraint profiles_role_check
    check (role in ('usuario', 'dono', 'admin')) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_nome_len check (char_length(nome) <= 80) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_bio_len check (char_length(bio) <= 280) not valid;
exception when duplicate_object then null; end $$;

create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_client_request() then
    if tg_op = 'INSERT' then
      new.role := 'usuario';
    elsif new.role is distinct from old.role then
      raise exception 'Somente administradores podem alterar a função de um perfil.'
        using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
before insert or update on public.profiles
for each row execute function public.profiles_guard();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid() and role = 'usuario');

-- ------------------------------------------------------------
-- 2. BRECHOS — slug, campos de apresentação e proteção de status
-- ------------------------------------------------------------
alter table public.brechos add column if not exists slug text;
alter table public.brechos add column if not exists logo_url text;
alter table public.brechos add column if not exists site text;
alter table public.brechos add column if not exists horario text;
alter table public.brechos add column if not exists updated_at timestamptz not null default now();

update public.brechos set status = 'approved' where status in ('aprovado', 'aprovada');
update public.brechos set status = 'rejected' where status in ('rejeitado', 'recusado', 'recusada');
update public.brechos set status = 'pending'  where status in ('pendente') or status is null;

do $$ begin
  alter table public.brechos add constraint brechos_status_check
    check (status in ('pending', 'approved', 'rejected')) not valid;
exception when duplicate_object then null; end $$;

create or replace function public.brechos_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base text;
begin
  if public.is_client_request() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.user_id := auth.uid();
    else
      if new.user_id is distinct from old.user_id or new.dono_id is distinct from old.dono_id then
        raise exception 'Não é permitido transferir um brechó.' using errcode = '42501';
      end if;
      if new.status is distinct from old.status then
        raise exception 'Somente administradores podem alterar o status do brechó.' using errcode = '42501';
      end if;
      -- Editar um cadastro recusado o reenvia para análise.
      if old.status = 'rejected' then
        new.status := 'pending';
      end if;
    end if;
  end if;

  if new.slug is null or new.slug = '' or (tg_op = 'UPDATE' and new.nome is distinct from old.nome and new.slug = old.slug) then
    base := public.slugify(new.nome);
    new.slug := base;
    if exists (select 1 from public.brechos where slug = new.slug and id <> new.id) then
      new.slug := base || '-' || left(replace(new.id::text, '-', ''), 6);
    end if;
  else
    new.slug := public.slugify(new.slug);
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists brechos_guard on public.brechos;
create trigger brechos_guard
before insert or update on public.brechos
for each row execute function public.brechos_guard();

-- Preenche slugs existentes (roda como postgres, não altera status).
-- Uma linha por comando para que slugs repetidos sejam detectados.
do $$
declare r record;
begin
  for r in select id from public.brechos where slug is null order by created_at loop
    update public.brechos set slug = null where id = r.id;
  end loop;
end $$;
create unique index if not exists brechos_slug_key on public.brechos(slug);

-- Aprovação/recusa sincroniza a role do responsável no banco,
-- em vez de depender do navegador do admin.
create or replace function public.brechos_sync_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;
  if new.status = 'approved' then
    update public.profiles set role = 'dono' where id = new.user_id and role = 'usuario';
  elsif old.status = 'approved' then
    update public.profiles set role = 'usuario'
    where id = new.user_id and role = 'dono'
      and not exists (
        select 1 from public.brechos
        where user_id = new.user_id and status = 'approved' and id <> new.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists brechos_sync_role on public.brechos;
create trigger brechos_sync_role
after update of status on public.brechos
for each row when (old.status is distinct from new.status)
execute function public.brechos_sync_role();

-- Leitura direta da tabela: somente dono e admin (dados de contato privados).
drop policy if exists "brechos_public_read_approved" on public.brechos;
drop policy if exists "brechos_select_owner_or_admin" on public.brechos;
create policy "brechos_select_owner_or_admin"
on public.brechos for select
using (user_id = auth.uid() or dono_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- 3. PUBLICAÇÕES (peças publicadas pelos brechós)
-- ------------------------------------------------------------
create table if not exists public.publicacoes (
  id uuid primary key default gen_random_uuid(),
  brecho_id uuid not null references public.brechos(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 2 and 90),
  descricao text check (char_length(descricao) <= 1200),
  imagem_url text not null,
  imagem_path text,
  alt_text text check (char_length(alt_text) <= 240),
  tipo text,
  tamanho text,
  preco numeric(10, 2) check (preco is null or preco >= 0),
  condicao text check (condicao is null or condicao in ('nova', 'otimo', 'bom', 'marcas')),
  estilo text,
  genero text check (genero is null or genero in ('feminino', 'masculino', 'unissex', 'infantil')),
  disponivel boolean not null default true,
  status text not null default 'publicado' check (status in ('publicado', 'rascunho')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_publicacoes_brecho on public.publicacoes(brecho_id);
create index if not exists idx_publicacoes_created on public.publicacoes(created_at desc);
create index if not exists idx_publicacoes_tipo on public.publicacoes(tipo);

drop trigger if exists publicacoes_touch on public.publicacoes;
create trigger publicacoes_touch
before update on public.publicacoes
for each row execute function public.touch_updated_at();

alter table public.publicacoes enable row level security;

drop policy if exists "publicacoes_select" on public.publicacoes;
create policy "publicacoes_select"
on public.publicacoes for select
using (
  (status = 'publicado' and public.brecho_aprovado(brecho_id))
  or public.is_owner_of_brecho(brecho_id)
  or public.is_admin()
);

drop policy if exists "publicacoes_insert_owner" on public.publicacoes;
create policy "publicacoes_insert_owner"
on public.publicacoes for insert
with check (
  (public.is_owner_of_brecho(brecho_id) and public.brecho_aprovado(brecho_id))
  or public.is_admin()
);

drop policy if exists "publicacoes_update_owner" on public.publicacoes;
create policy "publicacoes_update_owner"
on public.publicacoes for update
using (public.is_owner_of_brecho(brecho_id) or public.is_admin())
with check (
  (public.is_owner_of_brecho(brecho_id) and public.brecho_aprovado(brecho_id))
  or public.is_admin()
);

drop policy if exists "publicacoes_delete_owner" on public.publicacoes;
create policy "publicacoes_delete_owner"
on public.publicacoes for delete
using (public.is_owner_of_brecho(brecho_id) or public.is_admin());

create or replace function public.publicacao_visivel(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.publicacoes p
    join public.brechos b on b.id = p.brecho_id
    where p.id = p_id and p.status = 'publicado' and b.status = 'approved'
  );
$$;

-- ------------------------------------------------------------
-- 4. CURTIDAS / SALVOS — brechós e publicações
-- ------------------------------------------------------------
alter table public.curtidas add column if not exists publicacao_id uuid references public.publicacoes(id) on delete cascade;
alter table public.salvos   add column if not exists publicacao_id uuid references public.publicacoes(id) on delete cascade;
alter table public.curtidas alter column brecho_id drop not null;
alter table public.salvos   alter column brecho_id drop not null;
alter table public.curtidas add column if not exists created_at timestamptz not null default now();
alter table public.salvos   add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table public.curtidas add constraint curtidas_alvo_unico check (num_nonnulls(brecho_id, publicacao_id) = 1) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.salvos add constraint salvos_alvo_unico check (num_nonnulls(brecho_id, publicacao_id) = 1) not valid;
exception when duplicate_object then null; end $$;

create unique index if not exists curtidas_user_publicacao_key on public.curtidas(user_id, publicacao_id) where publicacao_id is not null;
create unique index if not exists salvos_user_publicacao_key   on public.salvos(user_id, publicacao_id)   where publicacao_id is not null;
create index if not exists idx_curtidas_publicacao on public.curtidas(publicacao_id);
create index if not exists idx_salvos_publicacao   on public.salvos(publicacao_id);
create index if not exists idx_curtidas_brecho     on public.curtidas(brecho_id);
create index if not exists idx_salvos_brecho       on public.salvos(brecho_id);

create or replace function public.alvo_interacao_valido(p_brecho_id text, p_publicacao_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_publicacao_id is not null then
    return public.publicacao_visivel(p_publicacao_id);
  end if;
  return exists (select 1 from public.brechos where id::text = p_brecho_id and status = 'approved');
end;
$$;

drop policy if exists "curtidas_insert_own" on public.curtidas;
create policy "curtidas_insert_own"
on public.curtidas for insert
with check (user_id = auth.uid() and public.alvo_interacao_valido(brecho_id, publicacao_id));

drop policy if exists "salvos_insert_own" on public.salvos;
create policy "salvos_insert_own"
on public.salvos for insert
with check (user_id = auth.uid() and public.alvo_interacao_valido(brecho_id, publicacao_id));

-- Eventos: só tipos conhecidos e só para brechós publicados.
drop policy if exists "eventos_public_insert" on public.brecho_eventos;
create policy "eventos_public_insert"
on public.brecho_eventos for insert
with check (
  (user_id is null or user_id = auth.uid())
  and tipo in ('view', 'map_click', 'contact_click')
  and public.brecho_aprovado(brecho_id)
);

-- ------------------------------------------------------------
-- 5. VIEWS PÚBLICAS (somente colunas públicas, somente aprovados)
-- As views rodam com o dono (postgres) e por isso já filtram o
-- que pode ser exibido. Contadores são agregados: nenhuma view
-- revela QUEM curtiu ou salvou.
-- ------------------------------------------------------------
drop view if exists public.feed_publicacoes;
drop view if exists public.brechos_publicos;

create view public.brechos_publicos as
select
  b.id, b.slug, b.nome, b.descricao, b.cidade, b.bairro, b.endereco,
  b.endereco_formatado, b.latitude, b.longitude, b.categorias,
  b.whatsapp, b.instagram, b.site, b.horario, b.foto_capa, b.logo_url,
  b.created_at,
  (select count(*) from public.publicacoes p where p.brecho_id = b.id and p.status = 'publicado')::int as total_publicacoes,
  (select count(*) from public.curtidas c where c.brecho_id = b.id::text)::int as total_curtidas
from public.brechos b
where b.status = 'approved';

create view public.feed_publicacoes as
select
  p.id, p.brecho_id, p.titulo, p.descricao, p.imagem_url, p.alt_text,
  p.tipo, p.tamanho, p.preco, p.condicao, p.estilo, p.genero,
  p.disponivel, p.created_at,
  b.nome as brecho_nome, b.slug as brecho_slug, b.bairro, b.cidade,
  b.logo_url as brecho_logo, b.whatsapp as brecho_whatsapp, b.instagram as brecho_instagram,
  (select count(*) from public.curtidas c where c.publicacao_id = p.id)::int as total_curtidas
from public.publicacoes p
join public.brechos b on b.id = p.brecho_id
where p.status = 'publicado' and b.status = 'approved';

grant select on public.brechos_publicos to anon, authenticated;
grant select on public.feed_publicacoes to anon, authenticated;

-- ------------------------------------------------------------
-- 6. EDITORIAL
-- ------------------------------------------------------------
create table if not exists public.artigos (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  titulo text not null check (char_length(titulo) between 3 and 140),
  subtitulo text check (char_length(subtitulo) <= 240),
  conteudo text not null default '',
  capa_url text,
  capa_path text,
  capa_alt text check (char_length(capa_alt) <= 240),
  categoria text not null default 'moda' check (categoria in (
    'moda', 'sustentabilidade', 'consumo-consciente', 'brechos',
    'cultura', 'tendencias', 'historia-da-moda', 'guias')),
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_artigos_status on public.artigos(status, publicado_em desc);
create index if not exists idx_artigos_categoria on public.artigos(categoria);

create or replace function public.artigos_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base text;
begin
  if new.slug is null or new.slug = '' then
    base := public.slugify(new.titulo);
    new.slug := base;
    if exists (select 1 from public.artigos where slug = new.slug and id <> new.id) then
      new.slug := base || '-' || left(replace(new.id::text, '-', ''), 6);
    end if;
  else
    new.slug := public.slugify(new.slug);
  end if;

  if tg_op = 'INSERT' and new.autor_id is null then
    new.autor_id := auth.uid();
  end if;
  if new.autor_nome is null and new.autor_id is not null then
    select nome into new.autor_nome from public.profiles where id = new.autor_id;
  end if;

  if new.status = 'publicado' and new.publicado_em is null then
    new.publicado_em := now();
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists artigos_prepare on public.artigos;
create trigger artigos_prepare
before insert or update on public.artigos
for each row execute function public.artigos_prepare();

alter table public.artigos enable row level security;

drop policy if exists "artigos_select" on public.artigos;
create policy "artigos_select"
on public.artigos for select
using (status = 'publicado' or public.is_admin());

drop policy if exists "artigos_admin_insert" on public.artigos;
create policy "artigos_admin_insert"
on public.artigos for insert with check (public.is_admin());

drop policy if exists "artigos_admin_update" on public.artigos;
create policy "artigos_admin_update"
on public.artigos for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "artigos_admin_delete" on public.artigos;
create policy "artigos_admin_delete"
on public.artigos for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 7. CONTATO
-- ------------------------------------------------------------
create table if not exists public.contatos (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null check (char_length(nome) between 2 and 80),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 160),
  assunto text not null default 'duvida' check (assunto in ('duvida', 'brecho', 'imprensa', 'parceria', 'privacidade', 'acessibilidade', 'outro')),
  mensagem text not null check (char_length(mensagem) between 10 and 3000),
  lido boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contatos enable row level security;

drop policy if exists "contatos_insert_any" on public.contatos;
create policy "contatos_insert_any"
on public.contatos for insert
with check ((user_id is null or user_id = auth.uid()) and lido = false);

drop policy if exists "contatos_admin_select" on public.contatos;
create policy "contatos_admin_select"
on public.contatos for select using (public.is_admin());

drop policy if exists "contatos_admin_update" on public.contatos;
create policy "contatos_admin_update"
on public.contatos for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "contatos_admin_delete" on public.contatos;
create policy "contatos_admin_delete"
on public.contatos for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 8. ESTATÍSTICAS (calculadas no banco, com checagem de permissão)
-- ------------------------------------------------------------
create or replace function public.estatisticas_brecho(p_brecho_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultado json;
begin
  if not (public.is_owner_of_brecho(p_brecho_id) or public.is_admin()) then
    raise exception 'Sem permissão para ver as estatísticas deste brechó.' using errcode = '42501';
  end if;

  select json_build_object(
    'visitas_30d', (select count(*) from brecho_eventos where brecho_id = p_brecho_id and tipo = 'view' and created_at >= now() - interval '30 days'),
    'cliques_mapa_30d', (select count(*) from brecho_eventos where brecho_id = p_brecho_id and tipo = 'map_click' and created_at >= now() - interval '30 days'),
    'cliques_contato_30d', (select count(*) from brecho_eventos where brecho_id = p_brecho_id and tipo = 'contact_click' and created_at >= now() - interval '30 days'),
    'curtidas_brecho', (select count(*) from curtidas where brecho_id = p_brecho_id::text),
    'salvos_brecho', (select count(*) from salvos where brecho_id = p_brecho_id::text),
    'curtidas_publicacoes', (select count(*) from curtidas c join publicacoes p on p.id = c.publicacao_id where p.brecho_id = p_brecho_id),
    'salvos_publicacoes', (select count(*) from salvos s join publicacoes p on p.id = s.publicacao_id where p.brecho_id = p_brecho_id),
    'publicacoes', (select count(*) from publicacoes where brecho_id = p_brecho_id and status = 'publicado'),
    'rascunhos', (select count(*) from publicacoes where brecho_id = p_brecho_id and status = 'rascunho'),
    'visitas_por_dia', (
      select json_agg(json_build_object('dia', d::date, 'total', coalesce(e.total, 0)) order by d)
      from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') d
      left join (
        select created_at::date as dia, count(*) as total
        from brecho_eventos
        where brecho_id = p_brecho_id and tipo = 'view' and created_at >= now() - interval '14 days'
        group by 1
      ) e on e.dia = d::date
    ),
    'top_publicacoes', (
      select coalesce(json_agg(t), '[]'::json) from (
        select p.id, p.titulo, p.imagem_url,
          (select count(*) from curtidas c where c.publicacao_id = p.id) as curtidas,
          (select count(*) from salvos s where s.publicacao_id = p.id) as salvos
        from publicacoes p
        where p.brecho_id = p_brecho_id
        order by 4 desc, 5 desc, p.created_at desc
        limit 5
      ) t
    )
  ) into resultado;
  return resultado;
end;
$$;

create or replace function public.admin_resumo()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultado json;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores.' using errcode = '42501';
  end if;

  select json_build_object(
    'usuarios', (select count(*) from profiles),
    'donos', (select count(*) from profiles where role = 'dono'),
    'admins', (select count(*) from profiles where role = 'admin'),
    'brechos_aprovados', (select count(*) from brechos where status = 'approved'),
    'brechos_pendentes', (select count(*) from brechos where status = 'pending'),
    'brechos_recusados', (select count(*) from brechos where status = 'rejected'),
    'brechos_sem_localizacao', (select count(*) from brechos where status = 'approved' and (latitude is null or longitude is null)),
    'publicacoes', (select count(*) from publicacoes where status = 'publicado'),
    'artigos_publicados', (select count(*) from artigos where status = 'publicado'),
    'artigos_rascunho', (select count(*) from artigos where status = 'rascunho'),
    'curtidas', (select count(*) from curtidas),
    'salvos', (select count(*) from salvos),
    'visitas_30d', (select count(*) from brecho_eventos where tipo = 'view' and created_at >= now() - interval '30 days'),
    'mensagens_nao_lidas', (select count(*) from contatos where not lido),
    'semanas', (
      select json_agg(json_build_object(
        'semana', w::date,
        'usuarios', (select count(*) from profiles where created_at >= w and created_at < w + interval '7 days'),
        'brechos', (select count(*) from brechos where created_at >= w and created_at < w + interval '7 days'),
        'publicacoes', (select count(*) from publicacoes where created_at >= w and created_at < w + interval '7 days'),
        'interacoes', (select count(*) from curtidas where created_at >= w and created_at < w + interval '7 days')
                    + (select count(*) from salvos where created_at >= w and created_at < w + interval '7 days')
      ) order by w)
      from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w
    )
  ) into resultado;
  return resultado;
end;
$$;

create or replace function public.admin_listar_usuarios()
returns table (
  id uuid, nome text, email text, role text, cidade text, avatar_url text,
  created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores.' using errcode = '42501';
  end if;
  return query
    select p.id, p.nome, u.email::text, p.role, p.cidade, p.avatar_url, p.created_at, u.last_sign_in_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_resumo() from anon;
revoke execute on function public.admin_listar_usuarios() from anon;
revoke execute on function public.estatisticas_brecho(uuid) from anon;

-- ------------------------------------------------------------
-- 9. STORAGE — buckets públicos para leitura, escrita por pasta
-- Estrutura de caminhos: <bucket>/<auth.uid()>/<arquivo>
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',   'avatars',   true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('brechos',   'brechos',   true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('editorial', 'editorial', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "repeteco_storage_select_own" on storage.objects;
create policy "repeteco_storage_select_own"
on storage.objects for select
using (
  bucket_id in ('avatars', 'brechos', 'editorial')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "repeteco_storage_insert" on storage.objects;
create policy "repeteco_storage_insert"
on storage.objects for insert
with check (
  (storage.foldername(name))[1] = auth.uid()::text
  and (
    bucket_id = 'avatars'
    or (bucket_id = 'brechos' and exists (select 1 from public.brechos b where b.user_id = auth.uid() or b.dono_id = auth.uid()))
    or (bucket_id = 'editorial' and public.is_admin())
  )
);

drop policy if exists "repeteco_storage_update" on storage.objects;
create policy "repeteco_storage_update"
on storage.objects for update
using (bucket_id in ('avatars', 'brechos', 'editorial') and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id in ('avatars', 'brechos', 'editorial') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "repeteco_storage_delete" on storage.objects;
create policy "repeteco_storage_delete"
on storage.objects for delete
using (
  bucket_id in ('avatars', 'brechos', 'editorial')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
