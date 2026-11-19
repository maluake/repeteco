-- ============================================================
-- REPETECO — carga 1 de 3: brechós reais de São Paulo (perfis da curadoria)
-- Rode DEPOIS da v9. Cole ESTE ARQUIVO INTEIRO no SQL Editor e
-- clique em Run. Pode ser repetido: brechó já existente (mesmo slug)
-- não é duplicado.
--
-- São 13 brechós reais, com endereço conferido em guias
-- (Catraca Livre, São Paulo Secreto, Guia da Semana, Steal the Look…)
-- e nos sites/perfis oficiais. Entram como origem 'curadoria': aprovados,
-- sem conta responsável, e a página pública avisa que o perfil foi
-- montado com informações públicas e convida o dono a assumir.
--
-- Posição no mapa: depois de rodar, abra o painel → Brechós →
-- "Posicionar no mapa" (consulta o OpenStreetMap pelo endereço e
-- grava as coordenadas). Cada brechó pode ser ajustado em "Editar".
--
-- Antes de usar em produção, recomendamos avisar cada brechó.
-- Fontes consultadas (resumo):
--   Brechó Capricho à Toa: https://www.brechocaprichoatoa.com.br/contato, https://www.brechocaprichoatoa.com.br/sobre, https://www.instagram.com/caprichoatoa/
--   Vó Judith Brechó: https://stealthelook.com.br/guia-definitivo-dos-melhores-brechos-de-sao-paulo-para-voce-conhecer/, https://www.corner.inc/place/po3Kg2GhpJFg, https://www.tiktok.com/@vojudithvintage
--   Brechó No Fundinho: https://catracalivre.com.br/gira/guia-de-brechos-em-sp/, https://saopaulosecreto.com/en/second-hand-clothing-stores-in-sao-paulo, https://stealthelook.com.br/guia-definitivo-dos-melhores-brechos-de-sao-paulo-para-voce-conhecer/
--   Brechó Vertical — Edifício Santa Victoria: https://saopaulosecreto.com/en/brecho-vertical-sp-en/, https://catracalivre.com.br/gira/guia-de-brechos-em-sp/
--   Fugaz Vintage: https://ma.to/venue/fugazvintage, https://stealthelook.com.br/guia-definitivo-dos-melhores-brechos-de-sao-paulo-para-voce-conhecer/, https://www.metropoles.com/sao-paulo/roteiro-sp/passeios-sp/o-renascimento-da-galeria-metropole
--   Brechó e Bazar Restaurar: https://catracalivre.com.br/gira/guia-de-brechos-em-sp/, https://www.benditoguia.com.br/segmento/loja-de-artigos-usados
--   Brechó Boutique Vintage: https://www.instagram.com/brechoboutiquevintage/, https://saopaulosecreto.com/brechos-em-sao-paulo/, https://visitesaopaulo.com/lugares-vintage-descubra-3-que-valem-a-visita/
--   Peça Rara Brechó — Tatuapé: https://site.pecararabrecho.com.br/, https://meubrecho.app/ponto/brecho-peca-rara-tatuape/
--   Peça Rara Brechó — Vila Mariana: https://site.pecararabrecho.com.br/
--   Cresci e Perdi — Pamplona: https://saopauloparacriancas.com.br/compras/cresci-e-perdi-loja-rua-pamplona/, https://www.diariocidade.com/sp/sao-paulo/guia/cresci-perdi-sp-pamplona-47819722000136/, https://linktr.ee/crescieperdi_pamplonasp
--   Enjoei — Loja Frei Caneca: https://www.enjoei.com.br/c/lojas-fisicas, https://www.instagram.com/enjoei_freicaneca/, https://mercadoeconsumo.com.br/20/08/2024/noticias-varejo/enjoei-abre-terceira-loja-fisica-com-pecas-de-roupa-masculina-em-sao-paulo/
--   Cansei Vendi: https://startups.com.br/negocios/apos-fechar-loja-fisica-cansei-vendi-reduz-operacao-e-prioriza-equilibrio-de-caixa/, https://mercadoeconsumo.com.br/11/05/2017/noticias/brecho-on-line-de-luxo-que-nasceu-no-instagram-recebe-aporte-de-400-mil-reais-e-aposta-no-publico-masculino/, https://imginn.com/cansei_vendi/
--   Repassa: https://fastcompanybrasil.com/news/startup-atualiza-conceito-de-brecho-e-estimula-consumo-circular/, https://neofeed.com.br/negocios/por-que-a-renner-comprou-o-brecho-online-repassa-fabio-faccio-explica-a-transacao/, https://mercadoeconsumo.com.br/11/03/2024/sustentabilidade/brecho-repassa-da-lojas-renner-vai-doar-105-mil-pecas-de-roupa-para-seis-ongs/
--
-- Ficaram de fora até confirmar o endereço:
--   * Minha Avó Tinha: Endereço conflitante. Facebook, dois guias e o CNPJ (distrito da Lapa) indicam Rua Tomé de Souza, 100. Fontes mais antigas (D Comércio, Guia da Semana) apontam Rua Itapicuru, 760, em Perdizes, onde a loja funcionou por muitos anos. Não confirmei qual endereço está ativo hoje, nem se a loja segue aberta. Um guia traz horário de seg a sex 9h–18h30 e sáb 9h–16h, sem data. Coordenadas não obtidas.
--   * Frou Frou Vintage: Várias fontes trazem o mesmo endereço, mas todas são guias sem data ou antigos. Não encontrei sinal de atividade em 2024–2026 nem o Instagram oficial. Confirmar se a loja segue aberta antes de publicar. Coordenadas não obtidas.
-- ============================================================

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Brechó Capricho à Toa', 'capricho-a-toa', 'Brechó de grande porte ao lado do metrô Vila Madalena, com roupas masculinas, femininas e infantis, acessórios, calçados e bolsas de grife organizados por categoria e tamanho. Recebe peças em consignação e também vende pela loja online com envio para todo o Brasil.', 'São Paulo', 'Vila Madalena', 'Rua Heitor Penteado, 1096 (casa 8)', null, '["brechó", "infantil", "calçados", "luxo"]'::jsonb,
       'caprichoatoa', 'https://www.brechocaprichoatoa.com.br', null, 'ambos', 'https://www.brechocaprichoatoa.com.br', 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'capricho-a-toa');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Vó Judith Brechó', 'vo-judith-brecho', 'Brechó vintage tradicional de São Paulo, que hoje funciona na Rua Cayowaá, perto do metrô Vila Madalena.', 'São Paulo', 'Sumaré', 'Rua Cayowaá, 2304', null, '["brechó", "moda vintage"]'::jsonb,
       null, null, null, 'fisica', null, 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'vo-judith-brecho');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Brechó No Fundinho', 'brecho-no-fundinho', 'Brechó dentro de uma sala do Edifício Esther, prédio histórico do centro, conhecido por peças de alfaiataria e de estilo clássico.', 'São Paulo', 'República', 'Rua Basílio da Gama, 29 (Edifício Esther)', null, '["brechó", "moda vintage"]'::jsonb,
       null, null, null, 'fisica', null, 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'brecho-no-fundinho');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Brechó Vertical — Edifício Santa Victoria', 'brecho-vertical', 'Prédio de seis andares perto da Galeria do Rock, ocupado por vários brechós independentes, cada um com sua curadoria, que vendem roupas vintage, calçados e acessórios de segunda mão.', 'São Paulo', 'República', 'Rua Dom José de Barros, 337', null, '["brechó", "moda vintage", "calçados"]'::jsonb,
       null, null, 'Seg a sáb, 11h às 19h (varia por loja)', 'fisica', null, 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'brecho-vertical');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Fugaz Vintage', 'fugaz-vintage', 'Loja na Galeria Metrópole especializada em peças vintage de grife autenticadas, dos anos 1980 ao início dos anos 2000, como Yves Saint Laurent, Jean Paul Gaultier e Christian Dior. Também vende pelo próprio e-commerce.', 'São Paulo', 'República', 'Avenida São Luís, 187 (Galeria Metrópole, 2º piso, loja 06)', null, '["brechó", "moda vintage", "luxo"]'::jsonb,
       null, 'https://www.fugazvintage.com.br', null, 'ambos', 'https://www.fugazvintage.com.br', 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'fugaz-vintage');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Brechó e Bazar Restaurar', 'brecho-restaurar', 'Brechó e bazar na Liberdade que vende roupas do dia a dia e de festa, roupas infantis, fantasias, brinquedos, sapatos e objetos de decoração.', 'São Paulo', 'Liberdade', 'Rua Tamandaré, 448', null, '["brechó", "infantil", "calçados", "casa e decoração"]'::jsonb,
       null, null, 'Seg a sex, 10h às 19h; sáb, 10h às 18h', 'fisica', null, 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'brecho-restaurar');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Brechó Boutique Vintage', 'brecho-boutique-vintage', 'Brechó e antiquário na Mooca com roupas, acessórios, bijuterias, sapatos, louças e itens de decoração. O espaço também funciona como bar.', 'São Paulo', 'Mooca', 'Rua da Mooca, 1721', null, '["brechó", "moda vintage", "antiquário", "casa e decoração", "calçados"]'::jsonb,
       'brechoboutiquevintage', 'https://www.brechoboutiquevintage.com.br', null, 'fisica', null, 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'brecho-boutique-vintage');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Peça Rara Brechó — Tatuapé', 'peca-rara-tatuape', 'Unidade da rede de franquias de brechós Peça Rara, com seções feminina e masculina e um andar dedicado a roupas infantis.', 'São Paulo', 'Tatuapé', 'Rua Emílio Mallet, 376', '03320000', '["brechó", "infantil"]'::jsonb,
       'pecarara.tatuape', 'https://site.pecararabrecho.com.br', null, 'fisica', null, 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'peca-rara-tatuape');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Peça Rara Brechó — Vila Mariana', 'peca-rara-vila-mariana', 'Unidade da rede de franquias de brechós Peça Rara, que compra e revende roupas e acessórios seminovos.', 'São Paulo', 'Vila Mariana', 'Rua Santa Cruz, 893', '04121000', '["brechó"]'::jsonb,
       'pecarara.vilamariana', 'https://site.pecararabrecho.com.br', null, 'fisica', null, 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'peca-rara-vila-mariana');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Cresci e Perdi — Pamplona', 'cresci-e-perdi-pamplona', 'Unidade da rede de brechós infantis Cresci e Perdi perto da Avenida Paulista. Compra itens infantis usados, avaliados na loja em lotes de no mínimo 20 peças, e paga via PIX ou em crédito para compras.', 'São Paulo', 'Jardim Paulista', 'Rua Pamplona, 1451', null, '["brechó", "infantil"]'::jsonb,
       null, 'https://linktr.ee/crescieperdi_pamplonasp', null, 'fisica', null, 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'cresci-e-perdi-pamplona');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Enjoei — Loja Frei Caneca', 'enjoei-frei-caneca', 'Terceira loja física do brechó online Enjoei em São Paulo e a primeira da rede com curadoria de peças masculinas, além das femininas. Aceita peças para avaliação com agendamento pelo site.', 'São Paulo', 'Consolação', 'Rua Frei Caneca, 645 (loja 02)', null, '["brechó"]'::jsonb,
       'enjoei_freicaneca', 'https://www.enjoei.com.br/c/lojas-fisicas', 'Seg a sex, 10h30 às 19h30; sáb, 10h30 às 18h', 'ambos', 'https://www.enjoei.com.br/c/lojas-fisicas', 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'enjoei-frei-caneca');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Cansei Vendi', 'cansei-vendi', 'Brechó online de artigos de luxo seminovos vendidos por consignação, com autenticação de cada peça antes da venda. Nasceu no Instagram em 2013.', 'São Paulo', null, null, null, '["brechó", "luxo"]'::jsonb,
       'cansei_vendi', null, null, 'online', 'https://www.canseivendi.com.br', 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'cansei-vendi');

insert into public.brechos (nome, slug, descricao, cidade, bairro, endereco, cep, categorias, instagram, site, horario, modalidade, loja_online_url, status, origem, user_id)
select 'Repassa', 'repassa', 'Brechó online de roupas, calçados e acessórios usados que pertence à Lojas Renner. O vendedor envia as peças na ''Sacola do Bem'', a plataforma faz curadoria e fotografia, e ele recebe parte do valor da venda.', 'São Paulo', null, null, null, '["brechó", "calçados"]'::jsonb,
       null, null, null, 'online', 'https://www.repassa.com.br', 'approved', 'curadoria', null
where not exists (select 1 from public.brechos where slug = 'repassa');

-- conferência: lista o que entrou
select nome, bairro, modalidade, (latitude is not null) as no_mapa from public.brechos where origem = 'curadoria' order by nome;
