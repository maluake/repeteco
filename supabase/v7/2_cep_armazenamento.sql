-- ============================================================
-- REPETECO — migration v7, parte 2 de 2: CEP e relatório de armazenamento
-- Rode DEPOIS da parte 1. Cole ESTE ARQUIVO INTEIRO no SQL Editor
-- e clique em Run. Pode ser repetida sem problema.
--
-- O que muda (nada é apagado):
--   * brechos ganha a coluna "cep" (8 dígitos, opcional). Ela não
--     aparece na view pública: o público continua vendo só o endereço.
--   * buckets: limite por arquivo menor (avatars 1 MB, editorial 2 MB;
--     brechos já está em 2 MB). O site envia imagens bem menores que
--     isso; o limite só barra envios feitos por fora do site.
--   * nova função admin_uso_armazenamento (somente admin): lista os
--     arquivos dos buckets com tamanho e se algum registro ainda usa
--     cada arquivo. O painel usa isso para mostrar o espaço ocupado e
--     apagar, pela API do Storage, arquivos que ninguém usa mais.
-- ============================================================

alter table public.brechos add column if not exists cep text;

do $$ begin
  alter table public.brechos add constraint brechos_cep_formato check (cep is null or cep ~ '^[0-9]{8}$') not valid;
exception when duplicate_object then null; end $$;

update storage.buckets set file_size_limit = 1048576 where id = 'avatars';
update storage.buckets set file_size_limit = 2097152 where id in ('brechos', 'editorial');

create or replace function public.admin_uso_armazenamento()
returns table (
  bucket text, caminho text, bytes bigint, criado_em timestamptz, em_uso boolean
)
language plpgsql
stable
security definer
set search_path = public, storage
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores.' using errcode = '42501';
  end if;
  return query
  with refs as (
    -- todo texto do banco que pode apontar para um arquivo (URL ou caminho)
    select avatar_url as r from public.profiles where avatar_url is not null
    union all select logo_url from public.brechos where logo_url is not null
    union all select foto_capa from public.brechos where foto_capa is not null
    union all select imagem_url from public.publicacoes where imagem_url is not null
    union all select thumb_url from public.publicacoes where thumb_url is not null
    union all select imagens::text from public.publicacoes where imagens is not null and imagens <> '[]'::jsonb
    union all select capa_url from public.artigos where capa_url is not null
    union all select capa_url from public.eventos where capa_url is not null
  )
  select o.bucket_id::text, o.name::text,
         coalesce((o.metadata->>'size')::bigint, 0),
         o.created_at,
         exists (select 1 from refs where position(o.name in refs.r) > 0)
  from storage.objects o
  where o.bucket_id in ('avatars', 'brechos', 'editorial')
  order by coalesce((o.metadata->>'size')::bigint, 0) desc;
end;
$$;

revoke execute on function public.admin_uso_armazenamento() from public, anon;
grant execute on function public.admin_uso_armazenamento() to authenticated;
