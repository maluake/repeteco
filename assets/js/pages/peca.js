/* REPETECO — página de uma peça (?id=uuid) */
(function () {
  const R = window.R;
  const root = R.$("#pieceRoot");
  const id = R.params().get("id") || "";

  function notFound() {
    R.seo({ title: "Peça não encontrada" });
    root.innerHTML = `<div class="wrap">${R.render.state("empty", "Esta peça não está mais disponível.", "Ela pode ter sido removida pelo brechó.", `<a class="btn" href="${R.url("feed.html")}">Voltar aos achados</a>`)}</div>`;
  }

  async function run() {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
    const { data: p, error } = await R.sb.from("feed_publicacoes").select("*").eq("id", id).maybeSingle();
    if (error) {
      root.innerHTML = `<div class="wrap">${R.render.state("error", "Não conseguimos abrir esta peça.", R.errorMessage(error), '<button class="btn" type="button" onclick="location.reload()">Tentar de novo</button>')}</div>`;
      return;
    }
    if (!p) return notFound();

    const alt = p.alt_text || `${p.titulo}, peça do ${p.brecho_nome}`;
    R.seo({ title: `${p.titulo} — ${p.brecho_nome}`, description: p.descricao || `${p.titulo} no ${p.brecho_nome}, ${R.fmt.place(p.bairro, p.cidade)}.`, image: p.imagem_url, type: "product" });
    const facts = [
      ["Tipo", R.label("tipos", p.tipo)], ["Tamanho", p.tamanho], ["Condição", R.label("condicoes", p.condicao)],
      ["Estilo", R.label("estilos", p.estilo)], ["Gênero", R.label("generos", p.genero)],
      ["Disponibilidade", p.disponivel === false ? "Vendida" : "Disponível no brechó"]
    ].filter(f => f[1]);
    const wa = R.whatsappUrl(p.brecho_whatsapp);
    const waText = wa ? `${wa}?text=${encodeURIComponent(`Olá! Vi no Repeteco a peça "${p.titulo}". Ela ainda está disponível?`)}` : "";

    root.innerHTML = `
      <nav class="wrap breadcrumb" aria-label="Você está em">
        <ol><li><a href="${R.url("feed.html")}">Achados</a></li>${p.tipo ? `<li><a href="${R.url(`feed.html?tipo=${encodeURIComponent(p.tipo)}`)}">${R.esc(R.label("tipos", p.tipo))}</a></li>` : ""}<li aria-current="page">${R.esc(p.titulo)}</li></ol>
      </nav>
      <article class="wrap piece">
        <figure class="piece-media">${R.img(p.imagem_url, alt, { eager: true })}</figure>
        <div class="piece-info card card-pad">
          <a class="eyebrow" href="${R.links.brecho(p)}">${R.esc(p.brecho_nome)}</a>
          <h1>${R.esc(p.titulo)}</h1>
          ${p.preco !== null && p.preco !== undefined ? `<p class="piece-price">${R.fmt.price(p.preco)}</p>` : ""}
          <div class="piece-actions">
            ${R.actionButtons("p", p.id, { title: p.titulo, count: p.total_curtidas })}
            ${waText && p.disponivel !== false ? `<a class="btn" href="${waText}" target="_blank" rel="noopener" data-contact>Perguntar ao brechó<span class="visually-hidden"> pelo WhatsApp (nova aba)</span></a>` : ""}
          </div>
          ${p.descricao ? `<p class="piece-desc">${R.esc(p.descricao)}</p>` : ""}
          <dl class="facts" style="margin-top:1.75rem">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${R.esc(v)}</dd></div>`).join("")}</dl>
          <div class="piece-shop">
            <div class="shop-logo">${R.img(p.brecho_logo, "")}</div>
            <div>
              <a class="piece-shop-name" href="${R.links.brecho(p)}">${R.esc(p.brecho_nome)}</a>
              <p class="small muted">${R.esc(R.fmt.place(p.bairro, p.cidade))} · <a class="link" href="${R.links.brecho(p)}">endereço e contato</a></p>
            </div>
          </div>
          <p class="small muted" style="margin-top:1.25rem">Publicada em ${R.fmt.date(p.created_at)}. A venda e a reserva são combinadas diretamente com o brechó.</p>
        </div>
      </article>
      <section class="section" aria-labelledby="moreTitle" style="padding-top:0" id="moreSection" hidden>
        <div class="wrap section-head"><h2 id="moreTitle">Mais do ${R.esc(p.brecho_nome)}</h2><a class="link-arrow" href="${R.links.brecho(p)}">Ver o brechó <span aria-hidden="true">→</span></a></div>
        <div class="wrap"><div class="tile-grid contained" id="morePieces"></div></div>
      </section>`;
    R.interactions.sync(root);
    root.addEventListener("click", e => { if (e.target.closest("[data-contact]")) R.track(p.brecho_id, "contact_click"); });

    const more = await R.sb.from("feed_publicacoes").select("*").eq("brecho_id", p.brecho_id).neq("id", p.id).order("created_at", { ascending: false }).limit(4);
    if (!more.error && more.data.length) {
      R.$("#morePieces").innerHTML = more.data.map(x => R.render.tile(x)).join("");
      R.$("#moreSection").hidden = false;
      R.interactions.sync(R.$("#morePieces"));
    }
  }

  if (!R.sb) { root.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  run();
})();
