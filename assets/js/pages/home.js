/* REPETECO — página inicial com dados reais */
(function () {
  const R = window.R;
  const latest = R.$("#homeLatest");

  async function run() {
    if (!R.sb) { latest.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
    latest.innerHTML = R.render.skeletonTiles(4);

    const [feed, shops, stories] = await Promise.all([
      R.sb.from("feed_publicacoes").select("*").order("created_at", { ascending: false }).limit(8),
      R.sb.from("brechos_publicos").select("id, slug, nome, descricao, bairro, cidade, categorias, foto_capa, logo_url, total_publicacoes, created_at").order("created_at", { ascending: false }).limit(500),
      R.sb.from("artigos").select("slug, titulo, subtitulo, capa_url, categoria, autor_nome, publicado_em").eq("status", "publicado").order("publicado_em", { ascending: false }).limit(3)
    ]);

    latest.setAttribute("aria-busy", "false");
    if (feed.error) {
      latest.innerHTML = `<div style="grid-column:1/-1">${R.render.state("error", "Não conseguimos carregar as peças.", R.errorMessage(feed.error))}</div>`;
    } else if (!feed.data.length) {
      latest.innerHTML = `<div style="grid-column:1/-1">${R.render.state("empty", "As primeiras peças estão a caminho.", "Assim que os brechós aprovados publicarem, elas aparecem aqui.", `<a class="btn btn-outline" href="${R.url("brechos.html")}">Conhecer os brechós</a>`)}</div>`;
    } else {
      latest.innerHTML = feed.data.map(p => R.render.tile(p)).join("");
      R.interactions.sync(latest);
      const withImg = feed.data.filter(p => R.safeUrl(p.imagem_url)).slice(0, 3);
      if (withImg.length === 3) {
        R.$("#heroVisual").innerHTML = `<div class="hero-mosaic">${withImg.map((p, i) =>
          `<a href="${R.links.peca(p.id)}">${R.img(p.imagem_url, p.alt_text || `${p.titulo}, ${p.brecho_nome}`, { eager: i === 0 })}</a>`).join("")}</div>`;
      }
    }

    if (!shops.error && shops.data.length) {
      const counts = {};
      shops.data.forEach(b => { if (b.bairro) counts[b.bairro.trim()] = (counts[b.bairro.trim()] || 0) + 1; });
      const hoods = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
      if (hoods.length) {
        R.$("#homeHoods").innerHTML = hoods.map(([nome, n]) =>
          `<li><a href="${R.url(`brechos.html?bairro=${encodeURIComponent(nome)}`)}">${R.esc(nome)} <small>${R.fmt.count(n, "brechó", "brechós")}</small></a></li>`).join("");
        R.$("#hoodsSection").hidden = false;
      }
      R.$("#homeShops").innerHTML = shops.data.slice(0, 4).map(b => R.render.brechoRow(b)).join("");
      R.$("#shopsSection").hidden = false;
      R.interactions.sync(R.$("#homeShops"));
    }

    if (!stories.error && stories.data.length) {
      R.$("#homeStories").innerHTML = stories.data.map(a => R.render.articleCard(a)).join("");
      R.$("#storiesSection").hidden = false;
    }
  }
  run();
})();
