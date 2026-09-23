/* REPETECO — configurações públicas do frontend
   A chave do Google Maps deve ser restrita por domínio/localhost e por API.
   Não coloque chaves secretas aqui. */
window.REPETECO_CONFIG = Object.assign({
  googleMapsApiKey: "",
  googleMapsMapId: "DEMO_MAP_ID"
}, window.REPETECO_CONFIG || {});
