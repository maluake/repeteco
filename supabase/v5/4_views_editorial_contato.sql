-- ============================================================
-- REPETECO — migration v5, parte 4 de 6: views públicas, editorial e contato
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor e clique em Run.
-- Rode as partes em ordem (1 → 6). Cada uma pode ser repetida
-- sem problema (idempotente).
-- ============================================================

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
  (select count(*) from public.curtidas c where c.brecho_id::text = b.id::text)::int as total_curtidas
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
