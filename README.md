# Repeteco — brechós de São Paulo

Plataforma de curadoria de brechós, sebos e antiquários de SP. Site estático (HTML, CSS e JavaScript sem etapa de build) conectado ao Supabase (Auth, Postgres com RLS e Storage).

Três experiências:

- **Visitante / pessoa usuária:** feed de peças, busca com filtros, brechós no mapa, editorial, curtidas, salvos e perfil.
- **Dono de brechó:** cadastro com aprovação, publicação de peças com foto, perfil do brechó com mapa e estatísticas.
- **Administração:** solicitações, brechós, pessoas, moderação de peças, editorial, mensagens e indicadores.

O que mudou em relação à versão anterior está em [AUDITORIA.md](AUDITORIA.md).

## Estrutura

```
index.html, feed.html, busca.html, brechos.html, brecho.html, peca.html,
salvos.html, perfil.html, entrar.html, nova-senha.html, editorial.html,
artigo.html, cadastro.html, contato.html, sobre.html, como-funciona.html,
sustentabilidade.html, acessibilidade.html, termos.html, privacidade.html,
eventos.html, evento.html, 404.html
dashboard/            painel (admin e dono) — rotas por hash (#pecas, #editorial…)
assets/css/           base.css (tokens e componentes) · pages.css
assets/js/            config, core (Supabase, sessão, SEO), layout (cabeçalho/rodapé),
                      a11y, interactions (curtir/salvar), media (compressão e upload),
                      cropper (recorte no navegador), map (Leaflet),
                      render, vocab, pages/*.js
assets/vendor/        supabase-js 2.117.2 e Leaflet 1.9.4 servidos localmente
supabase/             01_base_v4.sql · v5/ (6) · v6/ (3) · v7/ (2) · v8 · v9 · carga/ · diagnostico.sql · tests/
scripts/otimizar-html.js  versão (?v=hash) nos CSS/JS + preload; rode após editar arquivos (npm run html)
tests/e2e/            testes de navegador (Playwright + axe-core)
```

## Configurar o Supabase

1. No **SQL Editor**, rode `supabase/01_base_v4.sql` (só se o banco ainda não tiver a v4) e depois as seis partes de `supabase/v5/`, **em ordem e uma de cada vez**:
   `1_perfis.sql` → `2_brechos.sql` → `3_publicacoes_curtidas.sql` → `4_views_editorial_contato.sql` → `5_estatisticas.sql` → `6_storage.sql`.
   Para cada parte: abra uma consulta nova, cole o arquivo **inteiro** e clique em *Run*. Não divida um arquivo em pedaços: funções entre `$$ … $$` precisam ir completas, senão o Postgres acusa `syntax error at or near "$$"`. Todas as partes podem ser repetidas sem problema, inclusive depois de uma execução que falhou no meio. O começo da parte 1 lista exatamente o que a v5 altera.
   Depois rode as três partes de `supabase/v6/`, também em ordem e inteiras:
   `1_interacoes_pecas.sql` → `2_online_eventos.sql` → `3_views_resumo.sql`.
   A v6 só **acrescenta**: funções de curtir/salvar, galeria de até 8 fotos e promoção nas peças, brechó online, tabelas `eventos` e `evento_parcerias` (com RLS) e novas colunas nas views. Nenhuma tabela ou dado é apagado; o topo de cada parte descreve o que muda.
   Por fim, as duas partes de `supabase/v7/`: `1_reparos.sql` → `2_cep_armazenamento.sql`.
   A v7 corrige bancos antigos em que curtir/salvar e a troca de função falhavam (colunas sem valor padrão, regras antigas em `profiles.role`, permissões), cria a função `admin_definir_funcao`, a coluna `brechos.cep` e o relatório de armazenamento do painel. Nenhuma linha de dados é apagada; as mensagens (NOTICE) dizem o que foi ajustado.
   Depois rode `supabase/v8/1_colunas_legadas.sql`: ela sincroniza colunas antigas de pessoa (como `salvos.usuario_id`) com `user_id`, o que resolve o erro `null value in column "usuario_id"` ao curtir ou salvar.
   Em seguida `supabase/v9/1_curadoria.sql` e `supabase/v10/1_regra_de_funcao.sql` (refaz a regra antiga `profiles_role_check`, que não aceitava "dono" e impedia trocar a função ou aprovar brechós) (origem do perfil: cadastro, curadoria ou demonstração; o admin edita qualquer brechó).
   Por último as duas partes de `supabase/v11/`: `1_antispam.sql` limita o formulário de contato e o de parcerias a 3 envios do mesmo e-mail a cada 10 minutos e 30 envios por minuto no total (administração sem limite); `2_horarios.sql` cria `brechos.horarios` (horário por dia da semana, usado no "Aberto agora") e acrescenta essa coluna no fim da view `brechos_publicos`. Só acrescentam. Enquanto a v11 não for aplicada, o site continua funcionando como antes (o painel mostra o campo de horário em texto, sem a tabela por dia).
   **Carga inicial (opcional, para apresentar o projeto):** `supabase/carga/1_brechos_reais.sql` cadastra 13 brechós reais de São Paulo com endereço conferido em guias e sites oficiais (como perfis da curadoria, sem dono); `supabase/carga/2_acervo_demonstracao.sql` cria a loja "Acervo Repeteco" com 46 peças fotografadas (fotos do Unsplash, que não ocupam o Storage). Depois, no painel → **Brechós** → **Posicionar no mapa**, o site localiza todos pelo endereço; ajuste qualquer um em **Editar**. Para tirar a demonstração: `supabase/carga/3_remover_demonstracao.sql`.
   **Se algo ainda falhar**, rode `supabase/diagnostico.sql` (só leitura) e envie o resultado: ele mostra a estrutura de curtidas/salvos, as regras de `profiles` e o espaço usado, sem dados pessoais.
2. Em **Authentication → URL Configuration**:
   - *Site URL*: o endereço publicado (ex.: `https://seu-dominio`).
   - *Redirect URLs*: `https://seu-dominio/entrar.html*` e `https://seu-dominio/nova-senha.html` (inclua também `http://127.0.0.1:8090/*` para testes locais).
3. Em **Authentication → Providers → Email**, mantenha "Confirm email" ligado. O site já trata confirmação e reenvio. Em **Authentication → Policies/Password** (o nome varia), defina o mínimo de 8 caracteres e exija letras e números — a mesma regra que o site aplica. As senhas nunca passam pelas tabelas do site: o Supabase Auth guarda apenas o hash bcrypt (com sal) em `auth.users`, e o tráfego é sempre HTTPS.
4. Os buckets `avatars`, `brechos` e `editorial` são criados pela migration (públicos para leitura, até 2–5 MB, JPG/PNG/WebP). A escrita só é permitida na pasta `<id-do-usuário>/`.
5. Para criar a primeira conta administradora, cadastre-se pelo site e rode no SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'seu-email@exemplo.com');
   ```

A URL e a chave **publishable** ficam em `assets/js/config.js`. Nunca coloque a `service_role` no frontend.

### Alternativa: Supabase CLI

A pasta `supabase/migrations/` tem as mesmas versões acima, já em ordem, no formato do [Supabase CLI](https://supabase.com/docs/guides/local-development). Ela é **gerada** a partir dos arquivos de versão por `npm run migracoes` (não edite à mão; o CI confere que está em dia). O fluxo manual pelo SQL Editor continua valendo.

- **Banco novo:** `supabase link --project-ref <ref>` e `supabase db push`.
- **Banco que já recebeu as versões à mão** (o caso do Repeteco hoje): antes do primeiro `db push`, avise o CLI de que elas já foram aplicadas, senão ele tenta rodá-las de novo:
  ```bash
  # as 15 primeiras migrações = v4 até v10, já aplicadas pelo SQL Editor
  supabase migration repair --status applied $(ls supabase/migrations | cut -d_ -f1 | head -15)
  ```
  Marque só as versões que você realmente aplicou. As posteriores (ex.: `v11/`) ficam de fora do `repair` e são aplicadas pelo `db push`.
- **Ambiente local:** `supabase start` sobe Postgres, Auth e Storage em Docker com todas as migrações.
- Não use `supabase test db`: os testes de `supabase/tests/` são SQL puro, rodados por `npm run test:db`.

## Funções na Vercel (`api/`)

Não precisam de configuração: a Vercel publica automaticamente cada arquivo de `api/` (os que começam com `_` são só utilitários). Elas leem a URL e a chave publishable de `assets/js/config.js`; para usar outras, defina `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente do projeto.

- `api/preview.js` — prévia de link no WhatsApp, Instagram/Facebook, X, LinkedIn, Telegram etc. O `vercel.json` manda para ela **só** os robôs dessas redes (pelo User-Agent) quando acessam `brecho.html`, `peca.html`, `artigo.html` ou `evento.html`; pessoas recebem as páginas de sempre. Para conferir depois do deploy: cole um link de brechó no [depurador do Facebook](https://developers.facebook.com/tools/debug/) ou envie para você mesma no WhatsApp.
- `api/geocode.js` — endereço → coordenadas pelo OpenStreetMap, com cache de 30 dias na CDN e 1 consulta por segundo, como pede a política do Nominatim. Se a função falhar, o site consulta o Nominatim direto, como antes.
- `api/csp-report.js` — recebe os avisos da Content-Security-Policy, que está em modo **Report-Only** (não bloqueia nada). Veja em Vercel → Logs filtrando por `csp-violation`. Depois de alguns dias sem avisos de uso real (VLibras, mapa, uploads, login), troque no `vercel.json` o nome do cabeçalho `Content-Security-Policy-Report-Only` por `Content-Security-Policy`. Se algum domínio legítimo aparecer nos avisos, acrescente-o à diretiva indicada antes da troca.

## Métricas de visitas (opcional)

Desligadas por padrão. Para ligar Plausible ou Umami (sem cookies, compatíveis com a LGPD), preencha `analytics` em `assets/js/config.js` (há exemplos no arquivo) e acrescente o domínio do script em `script-src` e `connect-src` da CSP no `vercel.json`. O painel e as páginas pessoais (perfil, salvos, login) nunca são medidos, e quem ativa "Do Not Track"/GPC no navegador também não.

## Rodar localmente

```bash
npm run serve          # http://127.0.0.1:8090
```

Abrir os arquivos direto pelo `file://` não funciona com o login: use um servidor.

## Testes

```bash
npm ci
npm test               # lint + HTML + migrations + navegador (servidor em 8090 rodando)
npm run test:db        # requer PostgreSQL local (PGHOST/PGPORT/PGUSER)
npm run serve &        # em outro terminal
npm run test:e2e       # CHROMIUM_PATH opcional
```

- O GitHub Actions (`.github/workflows/ci.yml`) roda tudo isso a cada push e pull request, inclusive o `test:db` num Postgres 16.
- `npm run lint` procura erros prováveis no JavaScript (ESLint, sem impor estilo).
- `test:db` aplica as migrations num banco descartável, com um stub do `auth`/`storage` do Supabase, e verifica 64 cenários de permissão: quem lê, edita, publica, aprova, curte e envia arquivos.
- `test:e2e` usa um Supabase simulado que interpreta os filtros PostgREST e confere links, responsividade (375–1920px), axe-core WCAG 2.1 AA e os fluxos principais.

## Roteiro de verificação manual (Supabase real)

- **Pessoa usuária:** criar conta → confirmar e-mail → entrar → Meu perfil (nome, bio, foto) → curtir e salvar no feed → conferir em Salvos após recarregar → busca com filtros → sair.
- **Dono:** cadastrar brechó → (admin aprova) → Painel → Perfil do brechó (logo, capa, endereço, "Localizar endereço no mapa") → Publicar peça com 2+ fotos (recortar, reordenar, descrever) → marcar promoção → ver no feed, na aba “promoções” e na galeria da peça → editar, marcar vendida, excluir → mudar para “Só online” e conferir que sai do mapa → Visão geral.
- **Admin:** Solicitações → aprovar → Pessoas → Peças publicadas → Editorial (nova matéria, publicar, despublicar) → Eventos (criar, publicar, conferir em /eventos) → enviar interesse de parceria pela página do evento → Parcerias (mudar andamento) → Mensagens.

## Antes de lançar

- Revisar os textos de `termos.html` e `privacidade.html` com assessoria jurídica.
- Gerar `sitemap.xml` com o domínio definitivo e apontar no `robots.txt`.
- Personalizar os modelos de e-mail do Supabase Auth (confirmação e recuperação) em português.
