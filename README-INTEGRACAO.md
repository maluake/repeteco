# Repeteco — versão integrada para TCC e apresentação

Esta versão mantém a identidade visual do Repeteco e organiza o sistema em três experiências principais:

- **Cliente:** navega pelo site, encontra brechós, curte e salva espaços.
- **Dono de brechó:** possui painel próprio, edição do perfil e indicadores reais.
- **Administrador:** possui painel de moderação, fila de aprovação e visão geral dos cadastros.

## O que foi profissionalizado

- autenticação persistente via Supabase Auth;
- roles `usuario`, `dono` e `admin`;
- aprovação de brechós;
- publicação somente após aprovação;
- RLS para proteger perfis, brechós, curtidas, salvos e analytics;
- dashboard administrativo com fila e detalhe de aprovação;
- dashboard do proprietário com visitas, cliques no mapa, curtidas e salvamentos;
- gráfico de visitas dos últimos 7 dias;
- editor de perfil do brechó com prévia do card público;
- rastreamento de visualizações e cliques no mapa;
- tratamento de estados vazios, carregamento e erros;
- responsividade para apresentação em desktop e telas menores.

## Banco de dados

Execute `supabase_migration.sql` no SQL Editor do Supabase.

A migration cria/atualiza as tabelas necessárias e adiciona `brecho_eventos` para as métricas do painel.

## Importante para uma apresentação real

O projeto usa a chave **publishable/anon** do Supabase no frontend. Isso é esperado para aplicações web quando as tabelas estão protegidas por RLS. Não coloque uma `service_role` key no frontend.

Para uma versão comercial, recomenda-se:

1. configurar domínio próprio;
2. configurar Supabase Storage para upload de fotos;
3. configurar e-mail de recuperação/confirmação;
4. substituir dados de demonstração por dados reais;
5. revisar textos legais (privacidade/termos) antes de publicar;
6. configurar analytics e monitoramento de erros em produção.
