# Arquitetura

Visão técnica do Repeteco: como as partes se conectam, onde fica cada coisa e por que algumas decisões foram tomadas.

## Visão geral

```
Navegador (HTML + CSS + JavaScript, sem etapa de build)
   │
   ├── supabase-js ──► Supabase
   │                    ├─ Auth      contas, confirmação de e-mail, recuperação de senha
   │                    ├─ Postgres  tabelas protegidas por RLS, views públicas e funções
   │                    └─ Storage   fotos (avatars, brechos, editorial), escrita só na pasta do próprio usuário
   │
   ├── Leaflet + OpenStreetMap      mapa dos brechós
   │
   └── Vercel (hospedagem estática + funções em api/)
          ├─ api/preview.js      prévia de link (Open Graph) para robôs de redes sociais
          ├─ api/geocode.js      endereço → coordenadas, com cache, respeitando o limite do Nominatim
          └─ api/csp-report.js   recebe avisos da Content-Security-Policy (modo Report-Only)
```

- **Sem servidor próprio nem build:** cada página é um HTML com o seu script em `assets/js/pages/`. Isso simplifica a hospedagem; a contrapartida é que toda regra de segurança precisa estar **no banco**, não no navegador.
- **Segurança no banco:** o navegador usa só a chave *publishable* do Supabase. O que cada pessoa pode ler ou alterar é decidido por políticas de RLS, gatilhos e funções no Postgres:
  - `profiles_guard`: só a administração muda a função (`role`) de alguém;
  - `brechos_guard`: o dono não consegue aprovar o próprio brechó nem transferi-lo;
  - a view `brechos_publicos` expõe só as colunas públicas (sem nome e e-mail do responsável);
  - `estatisticas_brecho()` e `admin_resumo()` devolvem só totais, nunca quem curtiu ou salvou.
- **Bibliotecas servidas localmente** (`assets/vendor/`): supabase-js e Leaflet, sem depender de CDN.

## Organização das pastas

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
api/                  funções da Vercel (prévia de link, geocodificação, relatórios da CSP)
supabase/             01_base_v4.sql · v5/ … v11/ · migrations/ (gerada) · carga/ · diagnostico.sql · tests/
scripts/              otimizar-html.js (versão ?v=hash nos CSS/JS) · gerar-migracoes.js
tests/                api/ (funções da Vercel) · e2e/ (navegador com Supabase simulado)
docs/                 esta documentação
```

As páginas HTML ficam na raiz porque são as rotas públicas do site (`/brecho.html`, `/feed.html`…). Movê-las mudaria os endereços publicados.

## Banco de dados em versões

O banco evoluiu em versões (`supabase/v5/` a `supabase/v11/`), cada uma em partes pequenas que podem ser coladas no SQL Editor do Supabase e **repetidas sem efeito colateral** (idempotentes). A pasta `supabase/migrations/` traz as mesmas versões no formato do Supabase CLI e é gerada automaticamente por `npm run migracoes`. O passo a passo está em [CONFIGURACAO.md](CONFIGURACAO.md), e o histórico das correções de segurança em [AUDITORIA.md](AUDITORIA.md).

## Qualidade

- **Testes de banco:** aplicam todas as versões num Postgres descartável, em três cenários de bancos antigos, e verificam as regras de permissão (quem lê, edita, publica, aprova, curte e envia arquivos).
- **Testes de navegador (Playwright):** usam um Supabase simulado e conferem os fluxos principais, a responsividade de 375 a 1920 px e a acessibilidade com axe-core (WCAG 2.1 AA).
- **Testes das funções da Vercel** com `node:test`.
- **CI:** o GitHub Actions roda lint, testes de navegador, de API e de banco a cada push e pull request.

Como rodar cada suíte: [TESTES.md](TESTES.md).
