-- ============================================================
-- REPETECO — migration v9, parte 1 de 1: perfis de curadoria
-- Rode DEPOIS da v8. Cole ESTE ARQUIVO INTEIRO no SQL Editor e
-- clique em Run. Pode ser repetida sem problema.
--
-- O que muda (nada é apagado):
--   * brechos ganha "origem": 'cadastro' (feito pelo próprio dono,
--     padrão para tudo o que já existe), 'curadoria' (perfil montado
--     pela equipe com informações públicas, ainda sem dono) ou
--     'demonstracao' (acervo de exemplo, removível).
--   * a view brechos_publicos passa a mostrar "origem" (para o site
--     avisar quando o perfil é da curadoria) — nada mais é exposto.
--   * Storage: a administração pode enviar fotos no bucket "brechos"
--     (para editar perfis da curadoria), sempre na própria pasta.
-- ============================================================

alter table public.brechos add column if not exists origem text not null default 'cadastro';

do $$ begin
  alter table public.brechos add constraint brechos_origem_check
    check (origem in ('cadastro', 'curadoria', 'demonstracao')) not valid;
exception when duplicate_object then null; end $$;

-- Só a administração define a origem (o dono não consegue mudar).
create or replace function public.brechos_origem_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_client_request() then
    if tg_op = 'INSERT' then
      new.origem := 'cadastro';
    elsif new.origem is distinct from old.origem then
      new.origem := old.origem;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists brechos_origem_guard on public.brechos;
create trigger brechos_origem_guard
before insert or update on public.brechos
for each row execute function public.brechos_origem_guard();

-- Mesma view da v6, com "origem" no fim (create or replace mantém as permissões).
create or replace view public.brechos_publicos as
select
  b.id, b.slug, b.nome, b.descricao, b.cidade, b.bairro, b.endereco,
  b.endereco_formatado, b.latitude, b.longitude, b.categorias,
  b.whatsapp, b.instagram, b.site, b.horario, b.foto_capa, b.logo_url,
  b.modalidade, b.loja_online_url, b.created_at,
  (select count(*) from public.publicacoes p where p.brecho_id = b.id and p.status = 'publicado')::int as total_publicacoes,
  (select count(*) from public.curtidas c where c.brecho_id::text = b.id::text)::int as total_curtidas,
  b.origem
from public.brechos b
where b.status = 'approved';

grant select on public.brechos_publicos to anon, authenticated;

drop policy if exists "repeteco_storage_insert" on storage.objects;
create policy "repeteco_storage_insert"
on storage.objects for insert
with check (
  (storage.foldername(name))[1] = auth.uid()::text
  and (
    bucket_id = 'avatars'
    or (bucket_id = 'brechos' and (public.is_admin() or exists (select 1 from public.brechos b where b.user_id = auth.uid() or b.dono_id = auth.uid())))
    or (bucket_id = 'editorial' and public.is_admin())
  )
);
