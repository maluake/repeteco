/* REPETECO — página pública de um brechó (?b=slug ou id) */
(function () {
  const R = window.R;
  const root = R.$("#shopRoot");
  const key = R.params().get("b") || "";
  const isUuid = /^[0-9a-f-]{36}$/i.test(key);

  function notFound() {
    R.seo({ title: "Brechó não encontrado" });
    root.innerHTML = `<div class="wrap">${R.render.state("empty", "Brechó não encontrado.", "O endereço pode ter mudado ou o cadastro ainda está em análise.", `<a class="btn" href="${R.url("brechos.html")}">Ver todos os brechós</a>`)}</div>`;
  }

  async function run() {
    if (!key) return notFound();
    const { data: b, error } = await R.sb.from("brechos_publicos").select("*").eq(isUuid ? "id" : "slug", key).maybeSingle();
    if (error) {
      root.innerHTML = `<div class="wrap">${R.render.state("error", "Não conseguimos abrir este brechó.", R.errorMessage(error), '<button class="btn" type="button" data-reload>Tentar de novo</button>')}</div>`;
      return;
    }
    if (!b) return notFound();

    const place = R.fmt.place(b.bairro, b.cidade);
    R.seo({ title: `${b.nome}${b.modalidade === "online" ? " — brechó online" : b.bairro ? ` — brechó em ${b.bairro}` : ""}`, description: b.descricao || `${b.nome}, ${place}. Veja as peças publicadas e como chegar.`, image: b.foto_capa || b.logo_url, type: "profile" });
    R.track(b.id, "view");

    const wa = R.whatsappUrl(b.whatsapp);
    const ig = R.instagramUrl(b.instagram);
    const site = R.safeUrl(b.site);
    const address = b.endereco_formatado || b.endereco;
    const mapsLink = R.map.hasCoords(b)
      ? `https://www.openstreetmap.org/?mlat=${b.latitude}&mlon=${b.longitude}#map=17/${b.latitude}/${b.longitude}`
      : (address ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${address}, ${b.cidade || "São Paulo"}`)}` : "");
    const cats = Array.isArray(b.categorias) ? b.categorias : [];
    const online = b.modalidade === "online";
    const loja = R.safeUrl(b.loja_online_url);
    const modoTag = b.modalidade === "online" ? "só online" : b.modalidade === "ambos" ? "loja física e online" : "";

    root.innerHTML = `
      <div class="wrap shop-hero">
        <section class="shop-banner on-dark" aria-labelledby="shopName">
          ${b.foto_capa ? `<div class="shop-cover">${R.img(b.foto_capa, `Fachada ou ambiente do ${b.nome}`, { eager: true, sizes: "100vw" })}</div>` : ""}
          <div class="shop-head">
            <div class="shop-logo">${R.img(b.logo_url || b.foto_capa, `Logo do ${b.nome}`)}</div>
            <div>
              <h1 id="shopName">${R.esc(b.nome)}</h1>
              <p class="place">${online ? "Brechó online" : R.esc(place || "São Paulo")}${modoTag ? ` <span class="online-tag">${R.icon("globe")} ${modoTag}</span>` : ""}</p>
            </div>
            <div class="shop-head-actions" style="display:flex;gap:.5rem">${R.actionButtons("b", b.id, { title: b.nome, count: b.total_curtidas })}</div>
          </div>
        </section>
      </div>
      <nav class="wrap breadcrumb" aria-label="Você está em">
        <ol><li><a href="${R.url("brechos.html")}">Brechós</a></li>${b.bairro && !online ? `<li><a href="${R.url(`brechos.html?bairro=${encodeURIComponent(b.bairro)}`)}">${R.esc(b.bairro)}</a></li>` : ""}<li aria-current="page">${R.esc(b.nome)}</li></ol>
      </nav>
      ${b.origem === "curadoria" ? `<p class="wrap small muted" style="margin-bottom:1rem">Perfil montado pela curadoria do Repeteco com informações públicas do brechó. É responsável por este espaço? <a class="link" href="${R.url("contato.html?assunto=brecho")}">Fale com a gente</a> para assumir o perfil e publicar peças.</p>` : ""}
      ${b.origem === "demonstracao" ? '<p class="wrap small muted" style="margin-bottom:1rem">Acervo de demonstração do Repeteco: as peças mostram como o site funciona e não estão à venda.</p>' : ""}
      <div class="wrap shop-info">
        <section class="card card-pad about" aria-labelledby="aboutTitle">
          <h2 id="aboutTitle">Sobre o espaço</h2>
          <p>${R.esc(b.descricao || "Este brechó ainda não escreveu uma apresentação.")}</p>
          ${cats.length ? `<div class="tag-row">${cats.map(c => `<a class="tag" href="${R.url(`busca.html?tipo_busca=brechos&cat=${encodeURIComponent(c)}`)}">${R.esc(c)}</a>`).join("")}</div>` : ""}
        </section>
        <section class="card card-pad" aria-labelledby="visitTitle">
          <h2 id="visitTitle">${online ? "Como comprar" : "Como visitar"}</h2>
          <dl class="facts">
            ${online ? `<div><dt>Atendimento</dt><dd>Só online${b.cidade ? `, a partir de ${R.esc(b.cidade)}` : ""}</dd></div>` : `
            <div><dt>Endereço</dt><dd>${R.esc(address || "Não informado")}</dd></div>
            <div><dt>Bairro</dt><dd>${R.esc(b.bairro || "—")}</dd></div>`}
            ${b.horario ? `<div><dt>Horário</dt><dd>${R.esc(b.horario)}</dd></div>` : ""}
            ${b.instagram ? `<div><dt>Instagram</dt><dd>@${R.esc(String(b.instagram).replace(/^@/, ""))}</dd></div>` : ""}
          </dl>
          <div class="contact-actions">
            ${loja ? `<a class="btn" href="${R.esc(loja)}" target="_blank" rel="noopener" data-contact>${R.icon("globe")} loja online<span class="visually-hidden"> (abre em nova aba)</span></a>` : ""}
            ${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener" data-contact>WhatsApp<span class="visually-hidden"> (abre em nova aba)</span></a>` : ""}
            ${ig ? `<a class="btn btn-outline" href="${ig}" target="_blank" rel="noopener" data-contact>Instagram<span class="visually-hidden"> (abre em nova aba)</span></a>` : ""}
            ${site ? `<a class="btn btn-outline" href="${R.esc(site)}" target="_blank" rel="noopener" data-contact>Site<span class="visually-hidden"> (abre em nova aba)</span></a>` : ""}
            ${mapsLink && !online ? `<a class="btn btn-ghost" href="${mapsLink}" target="_blank" rel="noopener" data-map-link>${R.icon("pin")} como chegar<span class="visually-hidden"> no OpenStreetMap (nova aba)</span></a>` : ""}
          </div>
          ${R.map.hasCoords(b) && !online ? '<div class="shop-map map-canvas" id="shopMap"></div>' : ""}
        </section>
      </div>
      <section class="wrap" aria-labelledby="piecesTitle" style="padding-bottom:3.5rem">
        <h2 class="section-title-center" id="piecesTitle">peças do ${R.esc(b.nome)}</h2>
        <div class="tile-grid" id="shopPieces" aria-busy="true">${R.render.skeletonTiles(4)}</div>
      </section>`;

    R.interactions.sync(root);
    root.addEventListener("click", e => {
      if (e.target.closest("[data-contact]")) R.track(b.id, "contact_click");
      if (e.target.closest("[data-map-link]")) R.track(b.id, "map_click");
    });

    if (R.map.hasCoords(b) && !online) {
      const m = R.map.create(R.$("#shopMap"), { center: [b.latitude, b.longitude], zoom: 16 });
      R.map.plotBrechos(m, [b]);
    }

    const pieces = await R.sb.from("feed_publicacoes").select("*").eq("brecho_id", b.id).order("created_at", { ascending: false }).limit(48);
    const grid = R.$("#shopPieces");
    grid.setAttribute("aria-busy", "false");
    if (pieces.error) grid.innerHTML = `<div style="grid-column:1/-1">${R.render.state("error", "Não conseguimos carregar as peças.", R.errorMessage(pieces.error))}</div>`;
    else if (!pieces.data.length) grid.innerHTML = `<div style="grid-column:1/-1">${R.render.state("empty", "Nenhuma peça publicada ainda.", "Siga o brechó nas redes ou salve-o para voltar depois.")}</div>`;
    else { grid.innerHTML = pieces.data.map(p => R.render.tile(p)).join(""); R.interactions.sync(grid); }
  }

  if (!R.sb) { root.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  run();
})();
