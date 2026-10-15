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

## 6.1 v6 — correções e novidades pedidas depois da v5

- **Mapa por cima do menu:** o Leaflet cria camadas com `z-index` alto; o contêiner do mapa agora isola o próprio empilhamento (`isolation: isolate`), e um teste confere com `elementFromPoint` que o cabeçalho fica por cima.
- **Curtir e salvar não gravavam:** no banco real, `curtidas/salvos.brecho_id` é `uuid` (legado), o que quebrava as políticas antigas. Curtir/salvar passou a usar a função `alternar_interacao` (security definer, valida `auth.uid()`, tipo de alvo e visibilidade) e `minhas_interacoes`; o resultado do banco é a fonte da verdade e o erro real aparece na tela.
- **Várias fotos por peça, com recorte no site:** até 8 fotos, recorte (3:4, 4:5, 1:1, 16:9 ou original), zoom, girar, reordenar e texto alternativo por foto. Galeria na página da peça com miniaturas, setas, teclado e gesto.
- **Imagens leves no Storage:** compressão adaptativa no navegador (WebP, ou JPEG quando não houver suporte): foto principal até 1440 px (~200 KB) e miniatura de 480 px (~35 KB) usada no feed e nas listas; logos 400 px, capas 1600 px. Arquivos substituídos ou de peças excluídas são apagados; bucket `brechos` limitado a 2 MB por arquivo.
- **Promoções:** preço anterior (`preco_original` maior que o preço) gera o selo de desconto e a aba “promoções” no feed e o filtro na busca.
- **Calçados e numeração:** tipos agrupados (roupas, calçados, acessórios, casa, cultura); calçados usam numeração 33–46 no cadastro e na busca.
- **Estilo livre:** o brechó escolhe uma sugestão ou escreve o próprio estilo; a busca lista os estilos que existem no banco.
- **Brechó online:** modalidade física, online ou ambos, com link da loja. Brechós só online não pedem endereço, não entram no mapa e têm aba própria em “mapa”.
- **Eventos e parcerias:** aba “eventos” no menu, agenda (próximos/passados), página do evento e formulário de interesse em parceria. Só a equipe cria eventos e lê os pedidos (RLS); o painel tem as seções “Eventos” e “Parcerias”.

## 6.2 v7 — reparos e novidades

- **Curtir/salvar e troca de função ainda falhando no banco real:** a causa mais provável são tabelas antigas criadas à mão (id sem valor padrão, `created_at` obrigatório sem padrão) e regras antigas em `profiles.role`. Um cenário de teste reproduz esse banco; a v7 corrige essas colunas, remove regras de `role` incompatíveis (listando cada uma), devolve o motivo real das falhas e concede permissões explícitas — só depois de conferir que todas as tabelas têm RLS.
- **Troca de função:** o painel usava `update` direto em `profiles`; quando a RLS recusava, nada mudava e nenhum erro aparecia. Agora usa `admin_definir_funcao` (confere `is_admin()` no banco, impede tirar o próprio acesso) e mostra o motivo técnico se falhar. Donos com brechó já aprovado que estavam como "usuario" passam a "dono".
- **Senhas:** o site nunca grava senhas. O Supabase Auth guarda só o hash bcrypt com sal; o site passou a exigir 8+ caracteres com letras e números e recusa senhas muito comuns.
- **CEP:** cadastro e perfil do brechó consultam o ViaCEP e preenchem rua, bairro e cidade; no painel, o mapa já se posiciona pelo CEP. O CEP não aparece na view pública.
- **Imagens:** tamanhos centralizados (peça 1280 px/150 KB, miniatura 400 px/24 KB, perfil e logo 320 px/35 KB, capas 1440 px/180 KB), sempre WebP, com teto de bytes garantido (reduz dimensões se a qualidade não bastar). O painel ganhou "Armazenamento": espaço por bucket, maiores arquivos e limpeza de arquivos que nada usa. Limites dos buckets reduzidos (perfil 1 MB, demais 2 MB).

## 7. Limitações e pendências

- **Não testado contra o Supabase real:** o ambiente desta revisão não tinha acesso de rede ao projeto. É preciso rodar as migrations v5 e v6 e fazer o roteiro manual do README.
- **Exclusão de conta** é feita a pedido (formulário de contato), pois apagar `auth.users` exige uma Edge Function com chave de serviço.
- **`sitemap.xml`** depende do domínio definitivo.
- **Textos legais** (termos e privacidade) descrevem o funcionamento real, mas devem ser revisados juridicamente antes do lançamento.
- **`documentacao.html`** descreve a v4 e foi mantida apenas como histórico.
