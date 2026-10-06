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
sustentabilidade.html, acessibilidade.html, termos.html, privacidade.html, 404.html
dashboard/            painel (admin e dono) — rotas por hash (#pecas, #editorial…)
assets/css/           base.css (tokens e componentes) · pages.css
assets/js/            config, core (Supabase, sessão, SEO), layout (cabeçalho/rodapé),
                      a11y, interactions (curtir/salvar), media (imagens), map (Leaflet),
                      render, vocab, pages/*.js
assets/vendor/        supabase-js 2.117.2 e Leaflet 1.9.4 servidos localmente
supabase/             01_base_v4.sql · 02_v5_produto.sql · tests/
tests/e2e/            testes de navegador (Playwright + axe-core)
```

## Configurar o Supabase

1. No **SQL Editor**, rode `supabase/01_base_v4.sql` (se o banco ainda não tiver a v4) e depois `supabase/02_v5_produto.sql`. As duas são idempotentes. O início da v5 lista exatamente o que ela altera.
2. Em **Authentication → URL Configuration**:
   - *Site URL*: o endereço publicado (ex.: `https://seu-dominio`).
   - *Redirect URLs*: `https://seu-dominio/entrar.html*` e `https://seu-dominio/nova-senha.html` (inclua também `http://127.0.0.1:8090/*` para testes locais).
3. Em **Authentication → Providers → Email**, mantenha "Confirm email" ligado. O site já trata confirmação e reenvio.
4. Os buckets `avatars`, `brechos` e `editorial` são criados pela migration (públicos para leitura, até 2–5 MB, JPG/PNG/WebP). A escrita só é permitida na pasta `<id-do-usuário>/`.
5. Para criar a primeira conta administradora, cadastre-se pelo site e rode no SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'seu-email@exemplo.com');
   ```

A URL e a chave **publishable** ficam em `assets/js/config.js`. Nunca coloque a `service_role` no frontend.

## Rodar localmente

```bash
npm run serve          # http://127.0.0.1:8090
```

Abrir os arquivos direto pelo `file://` não funciona com o login: use um servidor.

## Testes

```bash
npm install
npm run test:db        # requer PostgreSQL local (PGHOST/PGPORT/PGUSER)
npm run serve &        # em outro terminal
npm run test:e2e       # CHROMIUM_PATH opcional
```

- `test:db` aplica as migrations num banco descartável, com um stub do `auth`/`storage` do Supabase, e verifica 64 cenários de permissão: quem lê, edita, publica, aprova, curte e envia arquivos.
- `test:e2e` usa um Supabase simulado que interpreta os filtros PostgREST e confere links, responsividade (375–1920px), axe-core WCAG 2.1 AA e os fluxos principais.

## Roteiro de verificação manual (Supabase real)

- **Pessoa usuária:** criar conta → confirmar e-mail → entrar → Meu perfil (nome, bio, foto) → curtir e salvar no feed → conferir em Salvos após recarregar → busca com filtros → sair.
- **Dono:** cadastrar brechó → (admin aprova) → Painel → Perfil do brechó (logo, capa, endereço, "Localizar endereço no mapa") → Publicar peça → ver no feed e no mapa → editar, marcar vendida, excluir → Visão geral.
- **Admin:** Solicitações → aprovar → Pessoas → Peças publicadas → Editorial (nova matéria, publicar, despublicar) → Mensagens.

## Antes de lançar

- Revisar os textos de `termos.html` e `privacidade.html` com assessoria jurídica.
- Gerar `sitemap.xml` com o domínio definitivo e apontar no `robots.txt`.
- Personalizar os modelos de e-mail do Supabase Auth (confirmação e recuperação) em português.
