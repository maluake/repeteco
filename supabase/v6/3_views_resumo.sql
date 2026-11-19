-- ============================================================
-- REPETECO — migration v6, parte 3 de 3: views públicas e resumo
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor e clique em Run.
-- Pode ser repetida sem problema (idempotente).
--
-- Recria as views públicas com os campos novos (galeria, miniatura,
-- promoção, modalidade e loja online) e atualiza o resumo do admin.
-- Esta parte substitui as views da v5 parte 4: se um dia rodar a v5
-- de novo, rode esta parte em seguida.
-- ============================================================
drop view if exists public.feed_publicacoes;
drop view if exists public.brechos_publicos;

create view public.brechos_publicos as
select
  b.id, b.slug, b.nome, b.descricao, b.cidade, b.bairro, b.endereco,
  b.endereco_formatado, b.latitude, b.longitude, b.categorias,
  b.whatsapp, b.instagram, b.site, b.horario, b.foto_capa, b.logo_url,
  b.modalidade, b.loja_online_url, b.created_at,
  (select count(*) from public.publicacoes p where p.brecho_id = b.id and p.status = 'publicado')::int as total_publicacoes,
  (select count(*) from public.curtidas c where c.brecho_id::text = b.id::text)::int as total_curtidas
from public.brechos b
where b.status = 'approved';

create view public.feed_publicacoes as
select
  p.id, p.brecho_id, p.titulo, p.descricao, p.imagem_url, p.thumb_url, p.imagens, p.alt_text,
  p.tipo, p.tamanho, p.preco, p.preco_original, p.condicao, p.estilo, p.genero,
  p.disponivel, p.created_at,
  (p.preco_original is not null and p.preco is not null and p.preco_original > p.preco) as em_promocao,
  b.nome as brecho_nome, b.slug as brecho_slug, b.bairro, b.cidade, b.modalidade as brecho_modalidade,
  b.logo_url as brecho_logo, b.whatsapp as brecho_whatsapp, b.instagram as brecho_instagram,
  b.loja_online_url as brecho_loja_online,
  (select count(*) from public.curtidas c where c.publicacao_id = p.id)::int as total_curtidas
from public.publicacoes p
join public.brechos b on b.id = p.brecho_id
where p.status = 'publicado' and b.status = 'approved';

grant select on public.brechos_publicos to anon, authenticated;
grant select on public.feed_publicacoes to anon, authenticated;

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
    'brechos_online', (select count(*) from brechos where status = 'approved' and modalidade <> 'fisica'),
    'brechos_sem_localizacao', (select count(*) from brechos where status = 'approved' and modalidade <> 'online' and (latitude is null or longitude is null)),
    'publicacoes', (select count(*) from publicacoes where status = 'publicado'),
    'promocoes', (select count(*) from publicacoes where status = 'publicado' and preco_original is not null),
    'artigos_publicados', (select count(*) from artigos where status = 'publicado'),
    'artigos_rascunho', (select count(*) from artigos where status = 'rascunho'),
    'eventos_proximos', (select count(*) from eventos where status = 'publicado' and coalesce(data_fim, data_inicio) >= now()),
    'parcerias_novas', (select count(*) from evento_parcerias where status = 'nova'),
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
