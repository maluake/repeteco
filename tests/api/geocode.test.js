/* Testes da função api/geocode.js, sem rede (fetch simulado). */
const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../../api/geocode");

function call(url, { reply = [{ lat: "-23.5", lon: "-46.6", display_name: "Rua X, São Paulo", osm_id: 1, extra: "x" }], ok = true, fail = false, method = "GET" } = {}) {
  const pedidos = [];
  global.fetch = async (u, opts) => {
    pedidos.push({ url: String(u), at: Date.now(), ua: opts.headers["User-Agent"] });
    if (fail) throw new Error("rede");
    return { ok, status: ok ? 200 : 503, json: async () => reply };
  };
  return new Promise(resolve => {
    const headers = {};
    const res = { statusCode: 0, setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end: b => resolve({ status: res.statusCode, headers, body: b ? JSON.parse(b) : null, pedidos }) };
    handler({ url, method }, res);
  });
}

test("devolve só lat/lon/display_name, com cache longo na CDN e User-Agent próprio", async () => {
  const r = await call("/api/geocode?q=Avenida%20S%C3%A3o%20Lu%C3%ADs%2C%20187");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, [{ lat: "-23.5", lon: "-46.6", display_name: "Rua X, São Paulo" }]);
  assert.match(r.headers["cache-control"], /s-maxage=2592000/);
  assert.match(r.pedidos[0].ua, /^Repeteco\//);
  assert.match(r.pedidos[0].url, /countrycodes=br.*q=Avenida%20S%C3%A3o%20Lu%C3%ADs%2C%20187$/);
});

test("consulta curta, longa ou método errado não chega ao OpenStreetMap", async () => {
  for (const [url, method, status] of [["/api/geocode?q=abc", "GET", 400], [`/api/geocode?q=${"a".repeat(201)}`, "GET", 400], ["/api/geocode?q=Rua%20Augusta%2C%20100", "POST", 405]]) {
    const r = await call(url, { method });
    assert.equal(r.status, status);
    assert.equal(r.pedidos.length, 0);
    assert.equal(r.headers["cache-control"], "no-store");
  }
});

test("falha do Nominatim vira 502 sem cache (o site cai no Nominatim direto)", async () => {
  assert.equal((await call("/api/geocode?q=Rua%20Augusta%2C%20100", { ok: false })).status, 502);
  assert.equal((await call("/api/geocode?q=Rua%20Augusta%2C%20100", { fail: true })).status, 502);
});

test("endereço não encontrado: lista vazia com cache curto", async () => {
  const r = await call("/api/geocode?q=Rua%20que%20nao%20existe%2C%201", { reply: [] });
  assert.deepEqual(r.body, []);
  assert.match(r.headers["cache-control"], /s-maxage=86400$/);
});

test("consultas seguidas respeitam 1 por segundo", async () => {
  const pedidos = [];
  global.fetch = async u => { pedidos.push(Date.now()); return { ok: true, json: async () => [] }; };
  const one = q => new Promise(resolve => handler({ url: `/api/geocode?q=${q}`, method: "GET" }, { setHeader() {}, end: resolve }));
  await Promise.all([one("Rua%20A%2C%2010"), one("Rua%20B%2C%2020")]);
  assert.equal(pedidos.length, 2);
  assert.ok(pedidos[1] - pedidos[0] >= 1000, `intervalo ${pedidos[1] - pedidos[0]}ms`);
});
