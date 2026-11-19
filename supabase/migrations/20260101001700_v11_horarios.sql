-- Gerado por scripts/gerar-migracoes.js a partir de supabase/v11/2_horarios.sql.
-- Não edite aqui: edite o arquivo de origem e rode `npm run migracoes`.

-- =====================================================================
-- REPETECO v11 — parte 2: horário de funcionamento por dia da semana
--
-- O que muda:
--   * brechos.horarios (jsonb, opcional): 7 itens, de domingo a sábado,
--     cada um {"abre": "HH:MM", "fecha": "HH:MM"} ou null (fechado).
--     A página do brechó usa para mostrar "Aberto agora".
--   * A view brechos_publicos ganha a coluna horarios no fim (as demais
--     colunas e permissões ficam iguais).
--   * O campo de texto brechos.horario continua existindo e continua
--     aparecendo como observação.
-- Só acrescenta. Pode ser executado mais de uma vez.
-- =====================================================================

alter table public.brechos add column if not exists horarios jsonb;

create or replace function public.horarios_validos(h jsonb)
returns boolean
language sql
immutable
as $$
  select h is null or (
    jsonb_typeof(h) = 'array'
    and jsonb_array_length(h) = 7
    and not exists (
      select 1 from jsonb_array_elements(h) d
      where jsonb_typeof(d) <> 'null'
        and not (
          jsonb_typeof(d) = 'object'
          and coalesce(d->>'abre', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          and coalesce(d->>'fecha', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        )
    )
  );
$$;

alter table public.brechos drop constraint if exists brechos_horarios_validos;
alter table public.brechos add constraint brechos_horarios_validos check (public.horarios_validos(horarios));

-- Mesma view da v9, com "horarios" no fim.
create or replace view public.brechos_publicos as
select
  b.id, b.slug, b.nome, b.descricao, b.cidade, b.bairro, b.endereco,
  b.endereco_formatado, b.latitude, b.longitude, b.categorias,
  b.whatsapp, b.instagram, b.site, b.horario, b.foto_capa, b.logo_url,
  b.modalidade, b.loja_online_url, b.created_at,
  (select count(*) from public.publicacoes p where p.brecho_id = b.id and p.status = 'publicado')::int as total_publicacoes,
  (select count(*) from public.curtidas c where c.brecho_id::text = b.id::text)::int as total_curtidas,
  b.origem,
  b.horarios
from public.brechos b
where b.status = 'approved';

grant select on public.brechos_publicos to anon, authenticated;
