/* Testes de api/csp-report.js. */
const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../../api/csp-report");

function call(method, body) {
  const avisos = [];
  const orig = console.warn;
  console.warn = (...a) => avisos.push(a.join(" "));
  return new Promise(resolve => {
    const res = { statusCode: 0, setHeader() {}, end: () => { console.warn = orig; resolve({ status: res.statusCode, avisos }); } };
    handler({ method, body }, res);
  });
}

test("formato report-uri vira uma linha de log sem query string da página", async () => {
  const r = await call("POST", JSON.stringify({ "csp-report": { "document-uri": "https://site/brecho.html?b=x", "violated-directive": "img-src", "blocked-uri": "https://evil.example/a.png" } }));
  assert.equal(r.status, 204);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /^csp-violation .*"page":"https:\/\/site\/brecho\.html"/);
  assert.match(r.avisos[0], /evil\.example/);
});

test("formato Reporting API (lista) também é aceito", async () => {
  const r = await call("POST", [{ type: "csp-violation", body: { documentURL: "https://site/", effectiveDirective: "script-src-elem", blockedURL: "https://x/y.js" } }]);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /script-src-elem/);
});

test("corpo inválido ou GET não loga nada e responde 204", async () => {
  assert.deepEqual(await call("POST", "isso não é json"), { status: 204, avisos: [] });
  assert.deepEqual(await call("GET"), { status: 204, avisos: [] });
});
