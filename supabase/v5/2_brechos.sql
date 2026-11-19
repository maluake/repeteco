-- ============================================================
-- REPETECO — migration v5, parte 2 de 6: brechos: slug, proteção de status e sincronização de role
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor e clique em Run.
-- Rode as partes em ordem (1 → 6). Cada uma pode ser repetida
-- sem problema (idempotente).
-- ============================================================

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
