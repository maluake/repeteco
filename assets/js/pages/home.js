/* REPETECO — página inicial (layout original) com dados reais */
(function () {
  const R = window.R;

  // Setas dos carrosséis rolam a lista indicada em aria-controls.
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-scroll]");
    if (!b) return;
    const list = document.getElementById(b.getAttribute("aria-controls"));
    list?.scrollBy({ left: Number(b.dataset.scroll) * list.clientWidth * 0.8, behavior: "smooth" });
  });

  function renderDestaques(shops) {
    const el = R.$("#destaques");
    if (!shops.length) {
      R.$("#destaqueSection").hidden = true;
      return;
    }
    el.innerHTML = shops.slice(0, 8).map((b, i) => `
      <a class="carousel-card" href="${R.links.brecho(b)}">
        ${R.img(b.foto_capa || b.logo_url, "", { eager: i === 0 })}
        <span class="card-label">${R.esc(b.nome)}<span>${R.esc(R.fmt.place(b.bairro, b.cidade))}</span></span>
      </a>`).join("");
  }

  function renderHoods(shops) {
    const counts = {};
    shops.forEach(b => { const h = b.bairro?.trim(); if (h) counts[h] = (counts[h] || 0) + 1; });
    const hoods = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
    R.$("#homeHoods").innerHTML = hoods.length
      ? hoods.map(([nome, n]) => `<a class="hood-card" href="${R.url(`brechos.html?bairro=${encodeURIComponent(nome)}`)}"><strong>${R.esc(nome)}</strong><span>${R.fmt.count(n, "brechó", "brechós")}</span></a>`).join("")
      : `<a class="hood-card" href="${R.url("brechos.html")}"><strong>Mapa</strong><span>ver todos os brechós</span></a>`;
  }

  function renderLatest(res) {
    const el = R.$("#homeLatest");
    el.setAttribute("aria-busy", "false");
    if (res.error) {
      el.innerHTML = `<div style="grid-column:1/-1">${R.render.state("error", "Não conseguimos carregar as peças.", R.errorMessage(res.error))}</div>`;
      return;
    }
    if (!res.data.length) {
      el.innerHTML = `<div style="grid-column:1/-1">${R.render.state("empty", "As primeiras peças estão a caminho.", "Assim que os brechós aprovados publicarem, elas aparecem aqui.")}</div>`;
      return;
    }
    el.innerHTML = res.data.map(p => `
      <a class="news-card" href="${R.links.peca(p.id)}">
        ${R.img(p.imagem_url, p.alt_text || `${p.titulo}, ${p.brecho_nome}`)}
        <span>${R.esc(p.titulo)}</span>
      </a>`).join("");
  }

  function renderCtaVisual(shops) {
    const pics = shops.map(b => b.foto_capa).filter(R.safeUrl).slice(0, 3);
    if (pics.length === 3) R.$("#ctaVisual").innerHTML = pics.map(src => `<div>${R.img(src, "")}</div>`).join("");
  }

  async function run() {
    if (!R.sb) { R.$("#homeLatest").innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
    R.$("#homeLatest").innerHTML = '<div class="news-card skeleton"></div>'.repeat(3);
    const [feed, shops, stories] = await Promise.all([
      R.sb.from("feed_publicacoes").select("*").order("created_at", { ascending: false }).limit(3),
      R.sb.from("brechos_publicos").select("id, slug, nome, bairro, cidade, foto_capa, logo_url, total_publicacoes, created_at").order("created_at", { ascending: false }).limit(500),
      R.sb.from("artigos").select("slug, titulo, subtitulo, capa_url, categoria, autor_nome, publicado_em").eq("status", "publicado").order("publicado_em", { ascending: false }).limit(3)
    ]);
    renderLatest(feed);
    const list = shops.error ? [] : shops.data;
    renderDestaques(list);
    renderHoods(list);
    renderCtaVisual(list);
    if (!stories.error && stories.data.length) {
      R.$("#homeStories").innerHTML = stories.data.map(a => R.render.articleCard(a)).join("");
      R.$("#storiesSection").hidden = false;
    }
  }
  run();
})();
