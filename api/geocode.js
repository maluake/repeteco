/* =====================================================
   REPETECO — endereço → coordenadas (proxy do Nominatim).

   A política do Nominatim (OpenStreetMap) pede no máximo 1 consulta por
   segundo, um User-Agent que identifique o app e cache dos resultados.
   Esta função:
   - identifica o Repeteco no User-Agent;
   - fila as consultas da mesma instância (1 por segundo);
   - deixa a CDN da Vercel guardar cada resposta por 30 dias, então o
     mesmo endereço não volta a consultar o OpenStreetMap.
   O site usa esta rota primeiro e, se ela falhar, consulta o Nominatim
   direto como antes (assets/js/map.js).
   ===================================================== */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Repeteco/1.0 (curadoria de brechos de Sao Paulo; geocodificacao de enderecos cadastrados)";

let fila = Promise.resolve();
let ultima = 0;
function naVez(fn) {
  const vez = fila.then(async () => {
    const espera = ultima + 1100 - Date.now();
    if (espera > 0) await new Promise(r => setTimeout(r, espera));
    ultima = Date.now();
    return fn();
  });
  fila = vez.catch(() => {});
  return vez;
}

function json(res, status, body, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(body));
}

async function handler(req, res) {
  if (req.method && req.method !== "GET") return json(res, 405, { error: "use GET" }, "no-store");
  const q = (new URL(req.url, "http://x").searchParams.get("q") || "").replace(/\s+/g, " ").trim();
  if (q.length < 5 || q.length > 200) return json(res, 400, { error: "consulta inválida" }, "no-store");

  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
  let data;
  try {
    data = await naVez(async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      try {
        const r = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: ctrl.signal });
        if (!r.ok) throw new Error(`nominatim ${r.status}`);
        return await r.json();
      } finally {
        clearTimeout(t);
      }
    });
  } catch {
    return json(res, 502, { error: "serviço de endereços indisponível" }, "no-store");
  }

  // Devolve só o necessário, no mesmo formato do Nominatim.
  const rows = Array.isArray(data) ? data.slice(0, 1).map(d => ({ lat: d.lat, lon: d.lon, display_name: d.display_name })) : [];
  // Endereço não encontrado fica em cache por menos tempo (pode ser cadastrado depois no OSM).
  json(res, 200, rows, rows.length ? "public, s-maxage=2592000, stale-while-revalidate=86400" : "public, s-maxage=86400");
}

module.exports = handler;
