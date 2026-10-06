/* =====================================================
   REPETECO — componentes de apresentação reutilizados
   (feed, busca, brechó, salvos, home, editorial)
   ===================================================== */
(function () {
  const R = window.R;
  const u = R.url;

  const pecaHref = id => u(`peca.html?id=${encodeURIComponent(id)}`);
  const brechoHref = b => u(`brecho.html?b=${encodeURIComponent(b.slug || b.brecho_slug || b.id || b.brecho_id)}`);
  const artigoHref = a => u(`artigo.html?slug=${encodeURIComponent(a.slug)}`);
  R.links = { peca: pecaHref, brecho: brechoHref, artigo: artigoHref };

  // Cartão de peça (cabeçalho com o brechó, imagem, texto e ações),
  // no padrão dos cartões "mais recente no nosso feed".
  function tile(p, { eager = false } = {}) {
    const alt = p.alt_text || `${p.titulo}${p.brecho_nome ? `, peça do ${p.brecho_nome}` : ""}`;
    const meta = [R.fmt.price(p.preco), p.tamanho ? `tam. ${p.tamanho}` : ""].filter(Boolean).join(" · ");
    return `
      <article class="piece-card${p.disponivel === false ? " is-sold" : ""}">
        <header class="piece-card-head">
          ${p.brecho_nome ? `<a href="${brechoHref(p)}">${R.esc(p.brecho_nome)}</a>` : "<span></span>"}
          ${R.saveButton("p", p.id, { title: p.titulo, variant: "act-icon" })}
        </header>
        <a class="piece-card-media" href="${pecaHref(p.id)}">
          ${R.img(p.imagem_url, alt, { eager })}
          ${p.disponivel === false ? '<span class="sold-flag">vendida</span>' : ""}
        </a>
        <div class="piece-card-body">
          <h3><a href="${pecaHref(p.id)}">${R.esc(p.titulo)}</a></h3>
          ${meta ? `<p>${R.esc(meta)}</p>` : ""}
        </div>
        <footer class="piece-card-foot">
          ${R.likeButton("p", p.id, { title: p.titulo, count: p.total_curtidas ?? null, variant: "act-icon" })}
          <a class="link-arrow" href="${pecaHref(p.id)}">ver peça <span aria-hidden="true">→</span></a>
        </footer>
      </article>`;
  }

  // Bloco do mosaico do feed: a imagem é a protagonista.
  const MOSAIC = ["m-big", "", "", "m-wide", "", "m-tall", "", "", "m-wide", "", "m-big", "", "m-tall", "", ""];
  function mosaic(p, i, { eager = false } = {}) {
    const alt = p.alt_text || `${p.titulo}${p.brecho_nome ? `, peça do ${p.brecho_nome}` : ""}`;
    return `
      <article class="mosaic-item ${MOSAIC[i % MOSAIC.length]}${p.disponivel === false ? " is-sold" : ""}">
        <a class="mosaic-link" href="${pecaHref(p.id)}">
          ${R.img(p.imagem_url, alt, { eager })}
          <span class="mosaic-caption"><strong>${R.esc(p.titulo)}</strong>${R.esc([p.brecho_nome, R.fmt.price(p.preco)].filter(Boolean).join(" · "))}</span>
        </a>
        <div class="mosaic-actions">${R.actionButtons("p", p.id, { title: p.titulo, variant: "on-image" })}</div>
      </article>`;
  }

  // Cartão de brechó (diretório, busca, salvos, home).
  function brechoRow(b) {
    const cover = b.foto_capa || b.logo_url;
    const cats = Array.isArray(b.categorias) ? b.categorias.slice(0, 2) : [];
    return `
      <article class="shop-card" data-brecho="${R.esc(b.id)}">
        <header class="piece-card-head">
          <a href="${brechoHref(b)}">${R.esc(b.nome)}</a>
          ${R.saveButton("b", b.id, { title: b.nome, variant: "act-icon" })}
        </header>
        <a class="piece-card-media" href="${brechoHref(b)}" tabindex="-1" aria-hidden="true">${R.img(cover, "")}</a>
        <div class="piece-card-body">
          <p class="shop-card-place">${R.esc(R.fmt.place(b.bairro, b.cidade) || "São Paulo")}</p>
          ${b.descricao ? `<p class="shop-card-desc">${R.esc(b.descricao)}</p>` : ""}
          ${cats.length ? `<div class="tag-row">${cats.map(c => `<a class="tag" href="${u(`busca.html?tipo_busca=brechos&cat=${encodeURIComponent(c)}`)}">${R.esc(c)}</a>`).join("")}</div>` : ""}
        </div>
        <footer class="piece-card-foot shop-card-foot">
          <span class="small muted">${b.total_publicacoes ? R.esc(R.fmt.count(b.total_publicacoes, "peça", "peças")) : ""}</span>
          <a class="link-arrow" href="${brechoHref(b)}">ver brechó <span aria-hidden="true">→</span></a>
        </footer>
      </article>`;
  }

  function articleCard(a, { large = false } = {}) {
    return `
      <article class="story${large ? " story-lead" : ""}">
        <a class="story-media" href="${artigoHref(a)}" tabindex="-1" aria-hidden="true">${R.img(a.capa_url, "")}</a>
        <div class="story-body">
          <a class="tag" href="${u(`editorial.html?categoria=${encodeURIComponent(a.categoria)}`)}">${R.esc(R.label("editorial", a.categoria))}</a>
          <h3 class="story-title"><a href="${artigoHref(a)}">${R.esc(a.titulo)}</a></h3>
          ${a.subtitulo ? `<p class="story-sub">${R.esc(a.subtitulo)}</p>` : ""}
          <p class="story-meta">${R.esc([a.autor_nome, R.fmt.date(a.publicado_em)].filter(Boolean).join(" · "))}</p>
        </div>
      </article>`;
  }

  function state(kind, title, text = "", action = "") {
    return `<div class="state${kind === "error" ? " is-error" : ""}" ${kind === "error" ? 'role="alert"' : ""}>
      <h2>${R.esc(title)}</h2>${text ? `<p>${R.esc(text)}</p>` : ""}${action}</div>`;
  }

  function skeletonTiles(n = 8) {
    return Array.from({ length: n }, () => '<div class="piece-card" aria-hidden="true"><div class="piece-card-media skeleton"></div><div class="piece-card-body"><span class="skeleton sk-line"></span></div></div>').join("");
  }
  function skeletonMosaic(n = 10) {
    return Array.from({ length: n }, (_, i) => `<div class="mosaic-item ${MOSAIC[i % MOSAIC.length]} skeleton" aria-hidden="true"></div>`).join("");
  }

  // Texto editorial → HTML seguro. Suporta: ## / ### títulos, > citação,
  // listas com "- ", **negrito**, *itálico* e [texto](https://link).
  function articleHtml(text) {
    const inline = s => R.esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
        const safe = R.safeUrl(href.replace(/&amp;/g, "&"));
        return safe ? `<a href="${R.esc(safe)}"${safe.startsWith(location.origin) ? "" : ' rel="noopener" target="_blank"'}>${label}</a>` : label;
      });
    const blocks = String(text || "").replace(/\r/g, "").split(/\n{2,}/);
    return blocks.map(block => {
      const b = block.trim();
      if (!b) return "";
      if (b.startsWith("### ")) return `<h3>${inline(b.slice(4))}</h3>`;
      if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
      if (b.startsWith("> ")) return `<blockquote><p>${inline(b.replace(/^>\s?/gm, ""))}</p></blockquote>`;
      const lines = b.split("\n");
      if (lines.every(l => /^[-*]\s+/.test(l))) return `<ul>${lines.map(l => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    }).join("\n");
  }

  R.render = { tile, mosaic, brechoRow, articleCard, state, skeletonTiles, skeletonMosaic, articleHtml };
})();
