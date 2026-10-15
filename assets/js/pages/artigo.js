/* REPETECO — matéria do editorial (?slug=) */
(function () {
  const R = window.R;
  const root = R.$("#articleRoot");
  const slug = R.params().get("slug") || "";

  function notFound() {
    R.seo({ title: "Matéria não encontrada" });
    root.innerHTML = `<div class="wrap">${R.render.state("empty", "Matéria não encontrada.", "Ela pode ter sido despublicada ou o endereço mudou.", `<a class="btn" href="${R.url("editorial.html")}">Ir para o editorial</a>`)}</div>`;
  }

  async function run() {
    if (!slug) return notFound();
    // Admin também lê rascunhos (RLS) — útil para pré-visualizar antes de publicar.
    const { data: a, error } = await R.sb.from("artigos").select("*").eq("slug", slug).maybeSingle();
    if (error) { root.innerHTML = `<div class="wrap">${R.render.state("error", "Não conseguimos abrir a matéria.", R.errorMessage(error))}</div>`; return; }
    if (!a) return notFound();

    const cat = R.label("editorial", a.categoria);
    R.seo({ title: a.titulo, description: a.subtitulo || String(a.conteudo || "").slice(0, 160), image: a.capa_url, type: "article" });
    root.innerHTML = `
      ${a.status !== "publicado" ? '<p class="form-status wrap-narrow" role="status" style="margin-top:1rem">Pré-visualização: esta matéria é um rascunho e não está visível ao público.</p>' : ""}
      <article>
        <header class="wrap-narrow article-head">
          <a class="eyebrow" href="${R.url(`editorial.html?categoria=${encodeURIComponent(a.categoria)}`)}">${R.esc(cat)}</a>
          <h1>${R.esc(a.titulo)}</h1>
          ${a.subtitulo ? `<p class="lede">${R.esc(a.subtitulo)}</p>` : ""}
          <p class="article-meta">${R.esc([a.autor_nome ? `Por ${a.autor_nome}` : "", a.publicado_em ? R.fmt.date(a.publicado_em) : ""].filter(Boolean).join(" · "))}</p>
        </header>
        ${a.capa_url ? `<figure class="article-cover">${R.img(a.capa_url, a.capa_alt || "", { eager: true })}${a.capa_alt ? `<figcaption>${R.esc(a.capa_alt)}</figcaption>` : ""}</figure>` : ""}
        <div class="wrap-narrow article-body">${R.render.articleHtml(a.conteudo)}</div>
      </article>
      <section class="section" aria-labelledby="relTitle" id="related" hidden style="padding-top:0">
        <div class="wrap"><div class="section-head"><h2 id="relTitle">Continue lendo</h2><a class="link-arrow" href="${R.url("editorial.html")}">Editorial <span aria-hidden="true">→</span></a></div>
        <div class="story-grid" id="relatedList"></div></div>
      </section>`;

    const rel = await R.sb.from("artigos").select("slug, titulo, subtitulo, capa_url, categoria, autor_nome, publicado_em")
      .eq("status", "publicado").neq("slug", a.slug).order("publicado_em", { ascending: false }).limit(3);
    if (!rel.error && rel.data.length) {
      R.$("#relatedList").innerHTML = rel.data.map(x => R.render.articleCard(x)).join("");
      R.$("#related").hidden = false;
    }
  }

  if (!R.sb) { root.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  run();
})();
