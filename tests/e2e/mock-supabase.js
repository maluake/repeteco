/* Mock do Supabase para os testes de navegador.
   Interpreta o subconjunto de filtros PostgREST que o Repeteco usa,
   para que os testes verifiquem que filtros mudam de fato a consulta. */
const { fixtures } = require("./fixtures");

const SUPABASE = "https://xhtjrmxkusuqmtpbebzv.supabase.co";

function svgImage(label, hue) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <rect width="600" height="800" fill="hsl(${hue},35%,62%)"/>
    <circle cx="300" cy="300" r="140" fill="hsl(${(hue + 40) % 360},40%,45%)"/>
    <text x="300" y="640" font-family="Georgia" font-size="44" text-anchor="middle" fill="#fafae8">${label}</text></svg>`;
}

function parseValue(v) {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return decodeURIComponent(v);
}

function likeToRegex(pattern) {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*");
  return new RegExp(`^${esc}$`, "i");
}

function test(row, col, op, raw) {
  const val = row[col];
  switch (op) {
    case "eq": return String(val) === String(parseValue(raw));
    case "neq": return String(val) !== String(parseValue(raw));
    case "lte": return val !== null && val !== undefined && Number(val) <= Number(raw);
    case "gte": return val !== null && val !== undefined && (isNaN(Number(raw)) ? String(val) >= raw : Number(val) >= Number(raw));
    case "lt": return Number(val) < Number(raw);
    case "gt": return Number(val) > Number(raw);
    case "ilike": return val !== null && val !== undefined && likeToRegex(decodeURIComponent(raw)).test(String(val));
    case "is": return raw === "null" ? val === null || val === undefined : val === parseValue(raw);
    case "in": {
      const items = decodeURIComponent(raw).replace(/^\(|\)$/g, "").split(",").map(s => s.replace(/^"|"$/g, ""));
      return items.includes(String(val));
    }
    case "cs": {
      const want = JSON.parse(decodeURIComponent(raw).replace(/^\{/, "[").replace(/\}$/, "]"));
      return Array.isArray(val) && want.every(w => val.includes(w));
    }
    default: throw new Error(`operador não suportado no mock: ${op}`);
  }
}

function applyFilter(row, key, value) {
  if (key === "or") {
    const inner = decodeURIComponent(value).replace(/^\(|\)$/g, "");
    return inner.split(",").some(part => {
      const [col, op, ...rest] = part.split(".");
      return test(row, col, op, rest.join("."));
    });
  }
  let [op, ...rest] = value.split(".");
  let negate = false;
  if (op === "not") { negate = true; [op, ...rest] = rest; }
  const r = test(row, key, op, rest.join("."));
  return negate ? !r : r;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function query(table, url, headers) {
  let rows = (fixtures.tables[table] || []).slice();
  for (const [key, value] of url.searchParams) {
    if (RESERVED.has(key)) continue;
    rows = rows.filter(r => applyFilter(r, key, value));
  }
  const order = url.searchParams.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    rows.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === "desc" ? -1 : 1));
  }
  const total = rows.length;
  const offset = Number(url.searchParams.get("offset") || 0);
  const limit = url.searchParams.get("limit");
  rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
  const select = url.searchParams.get("select");
  if (select && select !== "*" && !select.includes("(")) {
    const cols = select.split(",").map(s => s.trim());
    rows = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
  }
  return { rows, total };
}

async function install(context, { session = null, log = [] } = {}) {
  await context.route(/fonts\.(googleapis|gstatic)\.com|vlibras\.gov\.br/, route => route.abort());
  await context.route(/tile\.openstreetmap\.org/, route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8ead8"/><path d="M0 128h256M128 0v256" stroke="#fff" stroke-width="6"/></svg>'
  }));
  await context.route(/nominatim\.openstreetmap\.org/, route => route.fulfill({
    json: [{ lat: "-23.5614", lon: "-46.6916", display_name: "Rua dos Pinheiros, 500, Pinheiros, São Paulo" }]
  }));
  await context.route(/img\.test\//, route => {
    const name = new URL(route.request().url()).pathname.split("/").pop().replace(/\.\w+$/, "");
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    route.fulfill({ contentType: "image/svg+xml", body: svgImage(name, hue) });
  });

  await context.route(`${SUPABASE}/**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const path = url.pathname;
    const entry = { method, path, search: decodeURIComponent(url.search), body: req.postData() };
    log.push(entry);

    if (path.startsWith("/auth/v1/")) {
      if (path.endsWith("/user")) {
        if (method === "PUT") return route.fulfill({ json: session?.user || {} });
        return session ? route.fulfill({ json: session.user }) : route.fulfill({ status: 401, json: { message: "Auth session missing" } });
      }
      if (path.endsWith("/token")) {
        const body = JSON.parse(req.postData() || "{}");
        if (body.password === "senha-errada") return route.fulfill({ status: 400, json: { error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" } });
        return route.fulfill({ json: fixtures.sessionFor(body.email) });
      }
      if (path.endsWith("/signup")) return route.fulfill({ json: { id: "new-user", email: JSON.parse(req.postData()).email, identities: [{}] } });
      if (path.endsWith("/recover")) return route.fulfill({ json: {} });
      if (path.endsWith("/logout")) return route.fulfill({ status: 204, body: "" });
      return route.fulfill({ json: {} });
    }

    if (path.startsWith("/storage/v1/")) {
      if (method === "POST") return route.fulfill({ json: { Key: path, Id: "x" } });
      return route.fulfill({ json: [] });
    }

    if (path.startsWith("/rest/v1/rpc/")) {
      const fn = path.split("/").pop();
      const result = fixtures.rpc[fn];
      if (!result) return route.fulfill({ status: 404, json: { message: `function ${fn} not found` } });
      return route.fulfill({ json: typeof result === "function" ? result(session) : result });
    }

    if (path.startsWith("/rest/v1/")) {
      const table = path.split("/").pop();
      if (method === "GET" || method === "HEAD") {
        const { rows, total } = query(table, url, req.headers());
        const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
        const headers = { "content-range": `0-${Math.max(0, rows.length - 1)}/${total}`, "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" };
        if (single) return route.fulfill({ headers, json: rows[0] ?? null, status: rows[0] ? 200 : 406 });
        return route.fulfill({ headers, json: method === "HEAD" ? undefined : rows });
      }
      if (method === "POST") {
        const body = JSON.parse(req.postData() || "{}");
        const rows = Array.isArray(body) ? body : [body];
        const created = rows.map(r => ({ id: r.id || `${table}-${Date.now()}`, created_at: new Date().toISOString(), ...r }));
        const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
        return route.fulfill({ status: 201, json: single ? created[0] : created });
      }
      if (method === "PATCH") {
        const { rows } = query(table, url, req.headers());
        const body = JSON.parse(req.postData() || "{}");
        const updated = rows.map(r => ({ ...r, ...body }));
        const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
        return route.fulfill({ json: single ? updated[0] : updated });
      }
      if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ status: 404, json: { message: "mock: rota desconhecida" } });
  });

  if (session) {
    await context.addInitScript(s => {
      localStorage.setItem("sb-xhtjrmxkusuqmtpbebzv-auth-token", JSON.stringify(s));
    }, session);
  }
}

module.exports = { install, SUPABASE };
