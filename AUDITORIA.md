# Auditoria do Repeteco — v4 → v5

Registro do que foi encontrado na auditoria inicial, do que foi preservado e do que mudou.

## 1. Estrutura encontrada (v4)

- **Frontend:** site estático (HTML + JS sem build). `index.html` era uma página única que alternava "páginas" com `showPage()` (Início, Mapa, Feed), sem URLs próprias. `cadastro.html` e `dashboard/` eram as únicas páginas separadas.
- **Supabase:** cliente em `supabase.js` (chave publishable), tabelas `profiles`, `brechos`, `curtidas`, `salvos`, `brecho_eventos`; trigger `handle_new_user`; funções `is_admin()` e `is_owner_of_brecho()`; RLS habilitado.
- **Mapa:** Google Maps (sem chave configurada), com um SVG desenhado como mapa "falso".
- **Storage:** não usado. A URL da foto de capa era digitada à mão; o campo de arquivo do cadastro era ignorado.

## 2. Falhas de segurança confirmadas

Reproduzidas em Postgres local com a migration v4 (`supabase/tests/`):

| Falha | Impacto | Correção (v5) |
|---|---|---|
| A policy `profiles_update_own_or_admin` permitia `update profiles set role='admin'` no próprio perfil | Qualquer conta virava administradora | Trigger `profiles_guard`: só admin altera `role`; insert de cliente é forçado para `usuario` |
| A policy de update em `brechos` não restringia colunas | O dono aprovava o próprio brechó (`status='approved'`) ou transferia o `user_id` | Trigger `brechos_guard`: status e dono só mudam por admin; o cadastro sempre entra como `pending` |
| A leitura pública de `brechos` expunha todas as colunas | Visitantes anônimos liam o nome e o e-mail privados do responsável | O público lê a view `brechos_publicos` (só colunas públicas); a tabela fica restrita a dono e admin |
| A role "dono" era gravada pelo navegador do admin | Falha silenciosa deixava aprovados sem acesso ao painel | Trigger `brechos_sync_role` no banco |
| `curtidas`/`salvos` só tinham leitura "própria" | O painel do dono sempre mostrava 0 curtidas (contagem impossível via RLS) | Funções `estatisticas_brecho()` e `admin_resumo()` com checagem de permissão, retornando apenas agregados |

## 3. Funcionalidades simuladas na v4

- Carrosséis e "Novidades no feed" com nomes inventados, fixos no HTML.
- Pinos do mapa em SVG apontando para índices fixos (`openModal(0)`).
- Rodapé com cinco colunas intituladas "Categorias" e quase todos os links em `href="#"`.
- Busca filtrando só o que já estava em memória.
- Painel de acessibilidade: o tamanho de fonte não mudava nada (CSS em `px` + `zoom: 1.25`), e "simulação de daltonismo" aplicava um filtro que piorava a leitura em vez de ajudar.
- VLibras carregado sem a marcação exigida pelo widget.
- Upload de fotos do cadastro inexistente.
- `dashboard/login.html` só redirecionava para a home.

## 4. Preservado

Identidade visual do projeto (layouts de referência do site e do painel): paleta `#340C3D`, `#4E3557`, `#A0CAC6`, `#B6D6DA` e `#FFFFDF`; Lilita One no logo "RePeteco" e nos títulos e DM Sans nos textos (fontes servidas pelo próprio site); barra roxa, botões em pílula, cartões arredondados; estrutura original da home (foto de SP, busca, carrossel, manifesto, faixa roxa, chamada para divulgar), do mapa, do feed em mosaico e do painel (menu lateral creme, cartões brancos). O verde-água dos títulos sobre o creme foi escurecido o mínimo (`#569A93`) para atingir contraste 3:1. Também foram preservados os nomes das tabelas e colunas, o modelo de roles (`usuario`/`dono`/`admin`), o fluxo de aprovação de brechós, as métricas de visitas e cliques no mapa (`brecho_eventos`), o editor de perfil do dono, o VLibras e o painel de acessibilidade, agora funcionando de verdade.

## 5. O que mudou

- **Rotas reais:** 20 páginas com URL própria (`brecho.html?b=<slug>`, `peca.html?id=`, `artigo.html?slug=`, `editorial.html?categoria=`), cabeçalho e rodapé vindos de uma única fonte (`assets/js/layout.js`).
- **Feed editorial** inspirado na referência: grade de ponta a ponta com imagens 3:4, filtros só em texto, legenda discreta e curtir/salvar por peça.
- **Publicações (`publicacoes`)**: o dono publica peças com foto (comprimida no navegador e enviada ao Storage), preço, tamanho, condição, estilo, gênero e disponibilidade.
- **Busca** com filtros combináveis consultando o banco, estado no URL, chips removíveis e "limpar tudo".
- **Mapa** com OpenStreetMap + Leaflet servido localmente; geocodificação por Nominatim e marcador arrastável no painel; brechós sem coordenadas continuam na lista.
- **Autenticação:** cadastro com confirmação e reenvio de e-mail, recuperação e redefinição de senha, mensagens de erro em português, `?next=` validado contra open redirect e páginas privadas protegidas.
- **Perfil** com foto (Storage), bio, cidade e troca de senha.
- **Editorial** público e editor no painel admin (rascunho, publicar, despublicar, capa, categoria, slug, pré-visualização, exclusão), protegido por RLS.
- **Painel admin:** indicadores e crescimento semanal calculados no banco, solicitações, brechós, pessoas (com mudança de função), moderação de peças, editorial e mensagens de contato.
- **Painel do dono:** estatísticas reais, peças, perfil completo, checklist de completude.
- **Acessibilidade:** tipografia em `rem`, foco visível, skip link, headings, labels e erros ligados por `aria-describedby`, `aria-live`, alvos ≥ 24px, `prefers-reduced-motion`, alto contraste por tokens, cores seguras para daltonismo, espaçamento de texto (WCAG 1.4.12), estados que não dependem só de cor.
- **SEO:** title, description, Open Graph e canonical por página (dinâmicos nas páginas de brechó, peça e artigo), `robots.txt`.
- **Remoções:** emojis decorativos, `zoom` no CSS, DM Sans 800, Google Maps, arquivos substituídos (`app.js`, `maps.js`, `style.css`, `accessibility.js`, `supabase.js`, `config.js`, `cadastro.js`, `dashboard/dashboard.js`).

## 6. Como foi verificado

- `npm run test:db`: 64 cenários de segurança (RLS, triggers, funções, Storage) em Postgres 16 local, com stub de `auth`/`storage`. A migration roda duas vezes para provar que é idempotente.
- `npm run test:e2e`: 94 testes em Chromium com Supabase simulado por um interpretador de filtros PostgREST:
  - links e nomes acessíveis em 33 telas (pública, usuária, dona, admin);
  - sem rolagem horizontal em 375, 768, 1024, 1440 e 1920px;
  - axe-core WCAG 2.1 A/AA, também com alto contraste e texto em 160%;
  - painel de acessibilidade e teclado;
  - fluxos completos: login, cadastro, curtir/salvar, busca, perfil com foto, contato, publicação de peça, geocodificação, aprovação e editorial.

## 7. Limitações e pendências

- **Não testado contra o Supabase real:** o ambiente desta revisão não tinha acesso de rede ao projeto. É preciso rodar a migration v5 e fazer o roteiro manual do README.
- **Exclusão de conta** é feita a pedido (formulário de contato), pois apagar `auth.users` exige uma Edge Function com chave de serviço.
- **`sitemap.xml`** depende do domínio definitivo.
- **Textos legais** (termos e privacidade) descrevem o funcionamento real, mas devem ser revisados juridicamente antes do lançamento.
- **`documentacao.html`** descreve a v4 e foi mantida apenas como histórico.
