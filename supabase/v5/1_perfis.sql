-- ============================================================
-- REPETECO — migration v5, parte 1 de 6: utilitários e proteção de profiles
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor e clique em Run.
-- Rode as partes em ordem (1 → 6). Cada uma pode ser repetida
-- sem problema (idempotente).
-- ============================================================
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
