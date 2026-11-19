/* Utilitários compartilhados pelas funções da Vercel (arquivos com "_"
   não viram rotas). A URL e a chave publishable vêm de variáveis de
   ambiente, se existirem, ou do mesmo assets/js/config.js do site. */
const fs = require("fs");
const path = require("path");

let cache;
function config() {
  if (cache) return cache;
  let url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    const src = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "config.js"), "utf8");
    url = url || /supabaseUrl:\s*"([^"]+)"/.exec(src)[1];
    key = key || /supabaseKey:\s*"([^"]+)"/.exec(src)[1];
  }
  cache = { url: url.replace(/\/$/, ""), key };
  return cache;
}

// Consulta o PostgREST com a chave pública (sujeita às mesmas regras RLS
// do site). Devolve a primeira linha ou null; nunca lança.
async function selectOne(table, query, { timeoutMs = 4000 } = {}) {
  const { url, key } = config();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/rest/v1/${table}?${query}&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: ctrl.signal
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = { config, selectOne, esc };
