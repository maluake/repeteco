/* REPETECO — listagem do editorial, com filtro por categoria (?categoria=) */
(function () {
  const R = window.R;
  const grid = R.$("#stories");
  const tabs = R.$("#catTabs");
  const status = R.$("#storiesStatus");
  const PAGE = 13;
  let categoria = R.params().get("categoria") || "";
  if (categoria && !R.vocab.editorial[categoria]) categoria = "";
  let offset = 0;

  function renderTabs() {
    const li = (v, l) => `<li><a class="filter-tab" href="${R.url(v ? `editorial.html?categoria=${v}` : "editorial.html")}" data-cat="${v}"${v === categoria ? ' aria-current="page"' : ""}>${l}</a></li>`;
    tabs.innerHTML = li("", "Tudo") + Object.entries(R.vocab.editorial).map(([v, l]) => li(v, l)).join("");
  }

  function updateHead() {
    const label = categoria ? R.label("editorial", categoria) : "";
    R.$("#edTitle").textContent = categoria ? label : "Editorial";
    R.seo({ title: categoria ? `${label} — Editorial` : "Editorial", description: categoria ? `Matérias de ${label.toLowerCase()} no editorial do Repeteco.` : undefined });
  }

  async function load(reset) {
    if (reset) { offset = 0; grid.innerHTML = '<p class="muted">Carregando matérias…</p>'; }
    let q = R.sb.from("artigos").select("slug, titulo, subtitulo, capa_url, capa_alt, categoria, autor_nome, publicado_em", { count: "exact" })
      .eq("status", "publicado").order("publicado_em", { ascending: false }).range(offset, offset + PAGE - 1);
    if (categoria) q = q.eq("categoria", categoria);
    const { data, error, count } = await q;
    if (error) { grid.innerHTML = R.render.state("error", "Não conseguimos carregar o editorial.", R.errorMessage(error)); return; }
    if (reset && !data.length) {
      grid.innerHTML = R.render.state("empty", categoria ? "Ainda não há matérias nesta categoria." : "As primeiras matérias estão sendo escritas.", "Volte em breve.",
        categoria ? `<a class="btn btn-outline" href="${R.url("editorial.html")}">Ver todas as categorias</a>` : "");
      status.textContent = "Nenhuma matéria.";
      R.$("#storiesMore").hidden = true;
      return;
    }
    const html = data.map((a, i) => R.render.articleCard(a, { large: reset && i === 0 })).join("");
    if (reset) grid.innerHTML = `<div class="story-grid with-lead" id="storyList">${html}</div>`;
    else R.$("#storyList").insertAdjacentHTML("beforeend", html);
    offset += data.length;
    R.$("#storiesMore").hidden = offset >= (count ?? 0);
    status.textContent = `${R.fmt.count(count ?? data.length, "matéria", "matérias")}.`;
  }

  tabs.addEventListener("click", e => {
    const a = e.target.closest("[data-cat]");
    if (!a) return;
    e.preventDefault();
    categoria = a.dataset.cat;
    history.pushState(null, "", a.href);
    R.$$("[data-cat]", tabs).forEach(x => x.removeAttribute("aria-current"));
    a.setAttribute("aria-current", "page");
    updateHead();
    load(true);
  });
  window.addEventListener("popstate", () => { categoria = R.params().get("categoria") || ""; renderTabs(); updateHead(); load(true); });
  R.$("#storiesMoreBtn").addEventListener("click", () => load(false));

  if (!R.sb) { grid.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  renderTabs();
  updateHead();
  load(true);
})();
