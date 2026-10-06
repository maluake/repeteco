-- ============================================================
-- REPETECO — migration v5, parte 3 de 6: publicações, curtidas e salvos
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor e clique em Run.
-- Rode as partes em ordem (1 → 6). Cada uma pode ser repetida
-- sem problema (idempotente).
-- ============================================================

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
-- brecho_id pode ser text (migration v4) ou uuid (tabelas criadas antes);
-- por isso as comparações convertem os dois lados para text.
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
with check (user_id = auth.uid() and public.alvo_interacao_valido(brecho_id::text, publicacao_id));

drop policy if exists "salvos_insert_own" on public.salvos;
create policy "salvos_insert_own"
on public.salvos for insert
with check (user_id = auth.uid() and public.alvo_interacao_valido(brecho_id::text, publicacao_id));

-- Eventos: só tipos conhecidos e só para brechós publicados.
drop policy if exists "eventos_public_insert" on public.brecho_eventos;
create policy "eventos_public_insert"
on public.brecho_eventos for insert
with check (
  (user_id is null or user_id = auth.uid())
  and tipo in ('view', 'map_click', 'contact_click')
  and public.brecho_aprovado(brecho_id)
);
