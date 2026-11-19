/* =====================================================
   REPETECO — prévia de link para redes sociais.

   WhatsApp, Instagram/Facebook, X, LinkedIn, Telegram etc. não rodam
   JavaScript: leem só as tags <meta> do HTML. Como brecho.html,
   peca.html, artigo.html e evento.html montam o conteúdo no navegador,
   o link compartilhado mostrava só o título genérico.

   O vercel.json manda para cá APENAS as requisições desses robôs
   (pelo User-Agent). Pessoas continuam recebendo as páginas estáticas
   de sempre. A resposta é um HTML mínimo com título, descrição e foto
   da página, e um link para a página real.
   ===================================================== */
const { selectOne, esc } = require("./_supabase");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enc = encodeURIComponent;
const cut = (s, n = 200) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const place = (bairro, cidade) => [bairro, cidade].filter(Boolean).join(", ");

// Para cada página: parâmetro do URL, consulta e montagem das tags.
// As consultas usam as mesmas views/tabelas públicas que o site.
const PAGES = {
  brecho: {
    file: "brecho.html", param: "b",
    async load(k) {
      const b = await selectOne("brechos_publicos", `select=nome,slug,descricao,bairro,cidade,modalidade,foto_capa,logo_url&${UUID.test(k) ? "id" : "slug"}=eq.${enc(k)}`);
      if (!b) return null;
      const where = b.modalidade === "online" ? " — brechó online" : b.bairro ? ` — brechó em ${b.bairro}` : "";
      return { title: `${b.nome}${where}`, description: b.descricao || `${b.nome}, ${place(b.bairro, b.cidade)}. Veja as peças publicadas e como chegar.`, image: b.foto_capa || b.logo_url, type: "profile" };
    }
  },
  peca: {
    file: "peca.html", param: "id",
    async load(k) {
      if (!UUID.test(k)) return null;
      const p = await selectOne("feed_publicacoes", `select=titulo,descricao,imagem_url,brecho_nome,bairro,cidade&id=eq.${enc(k)}`);
      if (!p) return null;
      return { title: `${p.titulo} — ${p.brecho_nome}`, description: p.descricao || `${p.titulo} no ${p.brecho_nome}, ${place(p.bairro, p.cidade)}.`, image: p.imagem_url, type: "product" };
    }
  },
  artigo: {
    file: "artigo.html", param: "slug",
    async load(k) {
      const a = await selectOne("artigos", `select=titulo,subtitulo,conteudo,capa_url&status=eq.publicado&slug=eq.${enc(k)}`);
      if (!a) return null;
      return { title: a.titulo, description: a.subtitulo || a.conteudo, image: a.capa_url, type: "article" };
    }
  },
  evento: {
    file: "evento.html", param: "e",
    async load(k) {
      const e = await selectOne("eventos", `select=titulo,resumo,descricao,capa_url&status=eq.publicado&${UUID.test(k) ? "id" : "slug"}=eq.${enc(k)}`);
      if (!e) return null;
      return { title: e.titulo, description: e.resumo || e.descricao, image: e.capa_url, type: "website" };
    }
  }
};

function absolute(u, origin) {
  if (!u) return `${origin}/assets/img/og-repeteco.png`;
  try {
    const url = new URL(u, origin + "/");
    return /^https?:$/.test(url.protocol) ? url.href : `${origin}/assets/img/og-repeteco.png`;
  } catch {
    return `${origin}/assets/img/og-repeteco.png`;
  }
}

function html({ title, description, image, type, url }) {
  const t = esc(`${cut(title, 110)} — Repeteco`);
  const d = esc(cut(description || "Brechós, sebos e antiquários de São Paulo no Repeteco."));
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="Repeteco">
<meta property="og:locale" content="pt_BR">
<meta property="og:type" content="${esc(type || "website")}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(image)}">
</head>
<body><p><a href="${esc(url)}">${t}</a></p><p>${d}</p></body>
</html>`;
}

async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${host}`;
  const q = new URL(req.url, origin).searchParams;
  const page = PAGES[q.get("tipo")];

  // Página desconhecida: volta para a home, sem consultar nada.
  if (!page) { res.statusCode = 302; res.setHeader("Location", "/"); return res.end(); }

  const key = (q.get(page.param) || "").slice(0, 200);
  const url = `${origin}/${page.file}${key ? `?${page.param}=${enc(key)}` : ""}`;
  const data = key ? await page.load(key) : null;
  const meta = data || { title: "Repeteco", description: "", image: null, type: "website" };

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache curto na CDN: mudanças no brechó aparecem em até 10 min.
  res.setHeader("Cache-Control", data ? "public, s-maxage=600, stale-while-revalidate=86400" : "public, s-maxage=60");
  res.setHeader("X-Robots-Tag", "noindex");
  res.end(html({ ...meta, image: absolute(meta.image, origin), url }));
}

module.exports = handler;
module.exports.PAGES = PAGES;
