/* REPETECO — feed editorial de peças (dados de feed_publicacoes) */
(function () {
  const R = window.R;
  const PAGE = 24;
  const grid = R.$("#feedGrid");
  const tabs = R.$("#feedTabs");
  const more = R.$("#feedMore");
  const moreBtn = R.$("#feedMoreBtn");
  const status = R.$("#feedStatus");
  let tipo = R.params().get("tipo") || "";
  let offset = 0;

  async function loadTabs() {
    const { data, error } = await R.sb.from("feed_publicacoes").select("tipo").not("tipo", "is", null).limit(2000);
    const tipos = error ? [] : [...new Set(data.map(d => d.tipo))].sort((a, b) => R.label("tipos", a).localeCompare(R.label("tipos", b)));
    if (tipo && !tipos.includes(tipo)) tipos.unshift(tipo);
    const item = (value, label) => `<li><button type="button" class="filter-tab" data-tipo="${R.esc(value)}" aria-pressed="${value === tipo}">${R.esc(label)}</button></li>`;
    tabs.innerHTML = item("", "Tudo") + tipos.map(t => item(t, R.label("tipos", t))).join("");
  }

  async function load(reset) {
    if (reset) {
      offset = 0;
      grid.innerHTML = R.render.skeletonTiles(8);
      grid.setAttribute("aria-busy", "true");
      more.hidden = true;
    } else {
      moreBtn.disabled = true;
      moreBtn.textContent = "Carregando…";
    }
    let q = R.sb.from("feed_publicacoes").select("*").order("created_at", { ascending: false }).range(offset, offset + PAGE - 1);
    if (tipo) q = q.eq("tipo", tipo);
    const { data, error } = await q;
    grid.setAttribute("aria-busy", "false");
    moreBtn.disabled = false;
    moreBtn.textContent = "Carregar mais peças";

    if (error) {
      console.error("[Repeteco] feed:", error);
      grid.outerHTML = `<div id="feedGrid">${R.render.state("error", "Não conseguimos carregar o feed.", R.errorMessage(error), '<button class="btn" type="button" id="feedRetry">Tentar de novo</button>')}</div>`;
      R.$("#feedRetry")?.addEventListener("click", () => location.reload());
      return;
    }
    if (reset && !data.length) {
      grid.innerHTML = `<div style="grid-column:1/-1">${R.render.state("empty",
        tipo ? `Ainda não há ${R.label("tipos", tipo).toLowerCase()} publicados.` : "Nenhuma peça publicada ainda.",
        "Os brechós aprovados publicam peças pelo painel. Enquanto isso, conheça os brechós no mapa.",
        `<a class="btn" href="${R.url("brechos.html")}">Ver brechós</a>`)}</div>`;
      status.textContent = "Nenhuma peça encontrada.";
      return;
    }
    const html = data.map((p, i) => R.render.tile(p, { eager: reset && i < 4 })).join("");
    if (reset) grid.innerHTML = html; else grid.insertAdjacentHTML("beforeend", html);
    R.interactions.sync(grid);
    offset += data.length;
    more.hidden = data.length < PAGE;
    status.textContent = reset ? `${R.fmt.count(data.length, "peça carregada", "peças carregadas")}.` : `Mais ${data.length} peças carregadas.`;
  }

  tabs.addEventListener("click", e => {
    const b = e.target.closest("[data-tipo]");
    if (!b) return;
    tipo = b.dataset.tipo;
    R.$$("[data-tipo]", tabs).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    const url = new URL(location.href);
    tipo ? url.searchParams.set("tipo", tipo) : url.searchParams.delete("tipo");
    history.replaceState(null, "", url);
    R.seo({ title: tipo ? `${R.label("tipos", tipo)} — Achados` : "Achados — feed de peças dos brechós de SP" });
    load(true);
  });
  moreBtn.addEventListener("click", () => load(false));

  if (!R.sb) { grid.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  if (tipo) R.seo({ title: `${R.label("tipos", tipo)} — Achados` });
  loadTabs();
  load(true);
})();
