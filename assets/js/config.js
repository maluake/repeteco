/* REPETECO — configuração pública do frontend.
   A chave abaixo é a publishable/anon: é segura no navegador porque
   todas as tabelas são protegidas por RLS. Nunca coloque a service_role aqui. */
window.REPETECO_CONFIG = Object.assign({
  supabaseUrl: "https://xhtjrmxkusuqmtpbebzv.supabase.co",
  supabaseKey: "sb_publishable_d_2f1B2O-VMeRtp2wg607g_WNUQNcg7",
  siteName: "Repeteco",
  // Centro padrão do mapa (Praça da Sé) quando não há brechós com coordenadas.
  mapCenter: [-23.55052, -46.63331],
  mapZoom: 12
}, window.REPETECO_CONFIG || {});
