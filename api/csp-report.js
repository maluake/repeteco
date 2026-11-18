/* =====================================================
   REPETECO — recebe relatórios da Content-Security-Policy.

   A CSP está em modo "Report-Only": o navegador não bloqueia nada, só
   avisa aqui o que SERIA bloqueado. Cada aviso vira uma linha nos logs
   da Vercel (Project → Logs, filtre por "csp-violation"). Quando os
   logs ficarem limpos por alguns dias de uso real (incluindo VLibras,
   mapa e uploads), troque no vercel.json o nome do cabeçalho
   "Content-Security-Policy-Report-Only" por "Content-Security-Policy".
   ===================================================== */
const MAX = 16 * 1024;

function readBody(req) {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
  return new Promise(resolve => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > MAX) { data = ""; req.destroy?.(); } });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

// Aceita os dois formatos: report-uri ({"csp-report": {...}}) e
// Reporting API ([{type: "csp-violation", body: {...}}]).
function normalize(raw) {
  let j;
  try { j = JSON.parse(raw); } catch { return []; }
  const list = Array.isArray(j) ? j.map(r => r && r.body) : [j && j["csp-report"]];
  return list.filter(Boolean).slice(0, 20).map(r => ({
    directive: r["effective-directive"] || r.effectiveDirective || r["violated-directive"] || "",
    blocked: String(r["blocked-uri"] || r.blockedURL || "").slice(0, 300),
    page: String(r["document-uri"] || r.documentURL || "").replace(/[?#].*$/, "").slice(0, 300),
    source: String(r["source-file"] || r.sourceFile || "").replace(/[?#].*$/, "").slice(0, 300)
  }));
}

async function handler(req, res) {
  if (req.method === "POST") {
    const raw = await readBody(req);
    for (const v of normalize(raw.slice(0, MAX))) console.warn("csp-violation", JSON.stringify(v));
  }
  res.statusCode = 204;
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

module.exports = handler;
module.exports.normalize = normalize;
