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
    const list = shops.slice(0, 8);
    el.innerHTML = list.map((b, i) => `
      <a class="carousel-card" href="${R.links.brecho(b)}" data-index="${i}" aria-roledescription="slide">
        ${b.foto_capa || b.logo_url ? R.img(b.foto_capa || b.logo_url, "", { eager: i < 3 || i === list.length - 1 }) : R.render.shopPlaceholder(b)}
        <span class="card-label">${R.esc(b.nome)}<span>${R.esc(R.fmt.place(b.bairro, b.cidade))}</span></span>
      </a>`).join("");
    R.$("#destaquesDots").innerHTML = list.length > 1
      ? list.map((b, i) => `<button type="button" data-dot="${i}" aria-label="Ver ${R.esc(b.nome)}"></button>`).join("")
      : "";
    stack.init(el, list);
  }

  // Carrossel empilhado: o card ativo fica no centro e os vizinhos
  // aparecem atrás dele, menores, dos dois lados (circular).
  const stack = {
    el: null, list: [], active: 0,
    init(el, list) {
      this.el = el; this.list = list; this.active = 0;
      R.$("#destaqueSection").classList.toggle("single", list.length < 2);
      this.update(false);
    },
    go(i) {
      const n = this.list.length;
      if (n < 2) return;
      this.active = ((i % n) + n) % n;
      this.update(true);
    },
    update(announce) {
      const n = this.list.length;
      R.$$("#destaques .carousel-card[data-index]").forEach((card, i) => {
        let off = i - this.active;
        if (off > n / 2) off -= n;
        if (off < -n / 2) off += n;
        card.style.setProperty("--off", off);
        card.style.setProperty("--abs", Math.abs(off));
        card.classList.toggle("is-active", off === 0);
        card.classList.toggle("is-far", Math.abs(off) > 1);
        card.classList.toggle("is-hidden", Math.abs(off) > 3);
        card.tabIndex = off === 0 ? 0 : -1;
        if (off === 0) card.removeAttribute("aria-hidden"); else card.setAttribute("aria-hidden", "true");
      });
      R.$$("#destaquesDots [data-dot]").forEach((d, i) => {
        if (i === this.active) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
      });
      if (announce) R.$("#destaquesStatus").textContent = `${this.list[this.active].nome}, ${this.active + 1} de ${n}`;
    }
  };

  document.addEventListener("click", e => {
    const arrow = e.target.closest("[data-stack]");
    if (arrow) { stack.go(stack.active + Number(arrow.dataset.stack)); return; }
    const dot = e.target.closest("[data-dot]");
    if (dot) { stack.go(Number(dot.dataset.dot)); return; }
    // Clicar num card lateral traz ele para o centro em vez de abrir.
    const side = e.target.closest("#destaques .carousel-card[data-index]:not(.is-active)");
    if (side) { e.preventDefault(); stack.go(Number(side.dataset.index)); }
  });

  // Setas do teclado e deslize (dedo ou mouse) trocam o card ativo.
  (function () {
    const el = R.$("#destaques");
    el.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") { e.preventDefault(); stack.go(stack.active - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); stack.go(stack.active + 1); }
    });
    let x0 = null, y0 = 0, swiped = false;
    el.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; swiped = false; });
    el.addEventListener("pointerup", e => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; stack.go(stack.active + (dx < 0 ? 1 : -1)); }
    });
    el.addEventListener("pointercancel", () => { x0 = null; });
    // Um deslize não deve abrir o brechó.
    el.addEventListener("click", e => { if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; } }, true);
    el.addEventListener("dragstart", e => e.preventDefault());
  })();

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
    const [feed, shops, stories, events] = await Promise.all([
      R.sb.from("feed_publicacoes").select("*").order("created_at", { ascending: false }).limit(3),
      R.sb.from("brechos_publicos").select("id, slug, nome, bairro, cidade, foto_capa, logo_url, total_publicacoes, created_at").order("created_at", { ascending: false }).limit(500),
      R.sb.from("artigos").select("slug, titulo, subtitulo, capa_url, categoria, autor_nome, publicado_em").eq("status", "publicado").order("publicado_em", { ascending: false }).limit(3),
      R.sb.from("eventos").select("*").eq("status", "publicado").gte("data_inicio", new Date(Date.now() - 86400000).toISOString()).order("data_inicio", { ascending: true }).limit(2)
    ]);
    renderLatest(feed);
    const list = shops.error ? [] : shops.data;
    renderDestaques(list);
    renderHoods(list);
    renderCtaVisual(list);
    // Sem a tabela de eventos (v6 ainda não aplicada) a seção só fica oculta.
    if (!events.error && events.data.length) {
      R.$("#homeEvents").innerHTML = events.data.map(e => R.render.eventCard(e, { heading: "h3" })).join("");
      R.$("#eventsSection").hidden = false;
    }
    if (!stories.error && stories.data.length) {
      R.$("#homeStories").innerHTML = stories.data.map(a => R.render.articleCard(a)).join("");
      R.$("#storiesSection").hidden = false;
    }
  }
  run();
})();
