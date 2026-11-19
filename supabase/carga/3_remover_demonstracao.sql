-- ============================================================
-- REPETECO — carga 3 de 3: remover o acervo de demonstração
-- ATENÇÃO: apaga a loja "Acervo Repeteco" e TODAS as peças dela
-- (e as curtidas/salvos dessas peças). Não mexe nos brechós reais
-- nem em nenhum outro dado. Rode só quando quiser tirar a demonstração.
-- ============================================================
delete from public.publicacoes where brecho_id in (select id from public.brechos where origem = 'demonstracao');
delete from public.brechos where origem = 'demonstracao';
