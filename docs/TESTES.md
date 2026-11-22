# Testes

Como rodar o site localmente e cada suíte de testes. Conteúdo movido do README sem alterações.

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
