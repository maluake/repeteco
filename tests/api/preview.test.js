/* Testes da função de prévia de link (api/preview.js), sem rede:
   o fetch é substituído por respostas simuladas do PostgREST. */
const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../../api/preview");

function call(url, rows = [], { ok = true } = {}) {
  const pedidos = [];
  global.fetch = async (u, opts) => { pedidos.push({ url: String(u), headers: opts.headers }); return { ok, json: async () => rows }; };
  return new Promise(resolve => {
    const headers = {};
    const res = {
      statusCode: 0,
      setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
      end: body => resolve({ status: res.statusCode, headers, body: body || "", pedidos })
    };
    handler({ url, headers: { host: "repeteco.example", "x-forwarded-proto": "https" } }, res);
  });
}

test("brechó por slug: título, descrição, foto e link para a página real", async () => {
  const r = await call("/api/preview?tipo=brecho&b=sebo-liberdade", [{ nome: "Sebo Liberdade", bairro: "Liberdade", cidade: "São Paulo", descricao: "Livros e discos.", foto_capa: "https://x.supabase.co/storage/v1/object/public/brechos/capa.webp" }]);
  assert.equal(r.status, 200);
  assert.match(r.body, /<meta property="og:title" content="Sebo Liberdade — brechó em Liberdade — Repeteco">/);
  assert.match(r.body, /og:description" content="Livros e discos\."/);
  assert.match(r.body, /og:image" content="https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/brechos\/capa\.webp"/);
  assert.match(r.body, /og:url" content="https:\/\/repeteco\.example\/brecho\.html\?b=sebo-liberdade"/);
  assert.match(r.pedidos[0].url, /\/rest\/v1\/brechos_publicos\?select=.*&slug=eq\.sebo-liberdade&limit=1$/);
  assert.ok(r.pedidos[0].headers.apikey, "usa a chave publishable");
  assert.match(r.headers["cache-control"], /s-maxage=600/);
});

test("escapa HTML vindo do banco", async () => {
  const r = await call("/api/preview?tipo=brecho&b=x", [{ nome: '"><script>alert(1)</script>', descricao: "<img src=x onerror=alert(1)>" }]);
  assert.doesNotMatch(r.body, /<script>|<img/);
  assert.match(r.body, /&lt;script&gt;/);
});

test("peça só consulta com id válido (uuid)", async () => {
  const r = await call("/api/preview?tipo=peca&id=1 or 1=1", [{ titulo: "x" }]);
  assert.equal(r.pedidos.length, 0);
  assert.match(r.body, /og:title" content="Repeteco — Repeteco"/);
  assert.match(r.headers["cache-control"], /s-maxage=60\b/);
});

test("peça encontrada vira tipo product com nome do brechó", async () => {
  const id = "20000000-0000-0000-0000-000000000001";
  const r = await call(`/api/preview?tipo=peca&id=${id}`, [{ titulo: "Jaqueta jeans", brecho_nome: "Bê Brechó", bairro: "Pinheiros", cidade: "São Paulo", imagem_url: "https://x/y.webp" }]);
  assert.match(r.body, /og:type" content="product"/);
  assert.match(r.body, /og:title" content="Jaqueta jeans — Bê Brechó — Repeteco"/);
  assert.match(r.body, /og:description" content="Jaqueta jeans no Bê Brechó, Pinheiros, São Paulo\."/);
  assert.match(r.pedidos[0].url, new RegExp(`id=eq\\.${id}`));
});

test("artigo e evento só consultam conteúdo publicado", async () => {
  const a = await call("/api/preview?tipo=artigo&slug=garimpo", [{ titulo: "Garimpo", subtitulo: "Guia" }]);
  assert.match(a.pedidos[0].url, /status=eq\.publicado/);
  const e = await call("/api/preview?tipo=evento&e=feira", [{ titulo: "Feira", resumo: "Domingo" }]);
  assert.match(e.pedidos[0].url, /status=eq\.publicado/);
  assert.match(e.body, /og:title" content="Feira — Repeteco"/);
});

test("sem foto usa a imagem padrão absoluta; foto com protocolo estranho é ignorada", async () => {
  const r = await call("/api/preview?tipo=brecho&b=x", [{ nome: "X", foto_capa: "javascript:alert(1)" }]);
  assert.match(r.body, /og:image" content="https:\/\/repeteco\.example\/assets\/img\/og-repeteco\.png"/);
});

test("Supabase fora do ar: responde a prévia genérica em vez de erro", async () => {
  const r = await call("/api/preview?tipo=brecho&b=x", [], { ok: false });
  assert.equal(r.status, 200);
  assert.match(r.body, /og:title" content="Repeteco — Repeteco"/);
});

test("tipo desconhecido redireciona para a home", async () => {
  const r = await call("/api/preview?tipo=../../etc");
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, "/");
});
