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

  // Bloco de peça para o grid editorial (imagem protagonista).
  function tile(p, { eager = false } = {}) {
    const alt = p.alt_text || `${p.titulo}${p.brecho_nome ? `, peça do ${p.brecho_nome}` : ""}`;
    const meta = [R.fmt.price(p.preco), p.tamanho ? `Tam. ${p.tamanho}` : ""].filter(Boolean).join(" · ");
    return `
      <article class="tile${p.disponivel === false ? " is-sold" : ""}">
        <a class="tile-media" href="${pecaHref(p.id)}">
          ${R.img(p.imagem_url, alt, { eager })}
          ${p.disponivel === false ? '<span class="tile-flag">Vendida</span>' : ""}
          <span class="visually-hidden">${R.esc(p.titulo)}</span>
        </a>
        <div class="tile-actions">${R.actionButtons("p", p.id, { title: p.titulo, variant: "on-image" })}</div>
        <div class="tile-caption">
          ${p.brecho_nome ? `<a class="tile-shop" href="${brechoHref(p)}">${R.esc(p.brecho_nome)}</a>` : ""}
          <a class="tile-title" href="${pecaHref(p.id)}" tabindex="-1" aria-hidden="true">${R.esc(p.titulo)}</a>
          ${meta ? `<span class="tile-meta">${R.esc(meta)}</span>` : ""}
        </div>
      </article>`;
  }

  // Linha editorial de brechó (lista, busca, salvos).
  function brechoRow(b, { index } = {}) {
    const cover = b.foto_capa || b.logo_url;
    const cats = Array.isArray(b.categorias) ? b.categorias.slice(0, 3) : [];
    const counts = [
      b.total_publicacoes ? R.fmt.count(b.total_publicacoes, "peça", "peças") : "",
      b.bairro || ""
    ].filter(Boolean).join(" · ");
    return `
      <article class="shop-row" data-brecho="${R.esc(b.id)}">
        <a class="shop-row-media" href="${brechoHref(b)}" tabindex="-1" aria-hidden="true">${R.img(cover, "")}</a>
        <div class="shop-row-body">
          ${index !== undefined ? `<span class="shop-row-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>` : ""}
          <h3 class="shop-row-name"><a href="${brechoHref(b)}">${R.esc(b.nome)}</a></h3>
          <p class="shop-row-place">${R.esc(R.fmt.place(b.bairro, b.cidade) || "São Paulo")}</p>
          ${b.descricao ? `<p class="shop-row-desc">${R.esc(b.descricao)}</p>` : ""}
          <div class="shop-row-foot">
            ${cats.map(c => `<a class="tag" href="${u(`busca.html?tipo_busca=brechos&cat=${encodeURIComponent(c)}`)}">${R.esc(c)}</a>`).join("")}
            ${counts ? `<span class="small muted">${R.esc(counts)}</span>` : ""}
          </div>
        </div>
        <div class="shop-row-actions">${R.actionButtons("b", b.id, { title: b.nome })}</div>
      </article>`;
  }

  function articleCard(a, { large = false } = {}) {
    return `
      <article class="story${large ? " story-lead" : ""}">
        <a class="story-media" href="${artigoHref(a)}" tabindex="-1" aria-hidden="true">${R.img(a.capa_url, "")}</a>
        <div class="story-body">
          <a class="eyebrow" href="${u(`editorial.html?categoria=${encodeURIComponent(a.categoria)}`)}">${R.esc(R.label("editorial", a.categoria))}</a>
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
    return Array.from({ length: n }, () => '<div class="tile"><div class="tile-media skeleton"></div><div class="tile-caption"><span class="skeleton sk-line"></span></div></div>').join("");
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

  R.render = { tile, brechoRow, articleCard, state, skeletonTiles, articleHtml };
})();
