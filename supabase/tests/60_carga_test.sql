-- Testes da carga (brechós reais + acervo de demonstração).
\set ON_ERROR_STOP on
select t_expect_rows($q$select * from public.brechos where origem = 'curadoria' and status = 'approved' and user_id is null and slug in ('capricho-a-toa', 'fugaz-vintage', 'repassa')$q$, 3, 'carga: brechós reais entram aprovados, sem dono');
select t_expect_rows($q$select slug from public.brechos group by slug having count(*) > 1$q$, 0, 'carga: rodar duas vezes não duplica brechós');
select t_expect_rows($q$select * from public.publicacoes p join public.brechos b on b.id = p.brecho_id where b.slug = 'acervo-repeteco'$q$, 46, 'carga: acervo com 46 peças, sem duplicar');
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_rows($q$select * from public.feed_publicacoes where brecho_slug = 'acervo-repeteco' and em_promocao$q$, 13, 'carga: promoções aparecem no feed');
select t_expect_rows($q$select * from public.feed_publicacoes where brecho_slug = 'acervo-repeteco' and tipo in ('tenis','bota','sandalia','sapato') and tamanho ~ '^[0-9]{2}$'$q$, 8, 'carga: calçados com numeração');
select t_expect_rows($q$select * from public.brechos_publicos where origem = 'curadoria' and modalidade = 'online'$q$, 2, 'carga: brechós só online');
reset role;
