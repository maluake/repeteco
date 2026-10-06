/* REPETECO — feed em mosaico (dados de feed_publicacoes)
   Filtros: todos · salvos · curtidos (da conta) · tipo de peça. */
(function () {
  const R = window.R;
  const PAGE = 24;
  const grid = R.$("#feedGrid");
  const tabs = R.$("#feedTabs");
  const more = R.$("#feedMore");
  const moreBtn = R.$("#feedMoreBtn");
  const status = R.$("#feedStatus");
  const params = R.params();
  let tipo = params.get("tipo") || "";
  let lista = ["salvos", "curtidos"].includes(params.get("lista")) ? params.get("lista") : "";
  let offset = 0;

  async function loadTabs() {
    const { data, error } = await R.sb.from("feed_publicacoes").select("tipo").not("tipo", "is", null).limit(2000);
    const tipos = error ? [] : [...new Set(data.map(d => d.tipo))].sort((a, b) => R.label("tipos", a).localeCompare(R.label("tipos", b), "pt-BR"));
    if (tipo && !tipos.includes(tipo)) tipos.unshift(tipo);
    const li = (attrs, label, on) => `<li><button type="button" class="filter-tab" ${attrs} aria-pressed="${on}">${R.esc(label)}</button></li>`;
    tabs.innerHTML =
      li('data-lista=""', "todos", !lista && !tipo) +
      li('data-lista="salvos"', "salvos", lista === "salvos") +
      li('data-lista="curtidos"', "curtidos", lista === "curtidos") +
      tipos.map(t => li(`data-tipo="${R.esc(t)}"`, R.label("tipos", t).toLowerCase(), t === tipo)).join("");
  }

  // Salvos/curtidos vêm da conta (tabelas salvos/curtidas) e filtram a consulta.
  async function idsDaLista() {
    await R.ready;
    if (!R.auth.user) return null;
    const table = lista === "salvos" ? "salvos" : "curtidas";
    const { data, error } = await R.sb.from(table).select("publicacao_id").eq("user_id", R.auth.user.id).not("publicacao_id", "is", null);
    if (error) throw error;
    return data.map(r => r.publicacao_id);
  }

  async function load(reset) {
    if (reset) {
      offset = 0;
      grid.innerHTML = R.render.skeletonMosaic(10);
      grid.setAttribute("aria-busy", "true");
      more.hidden = true;
    } else {
      moreBtn.disabled = true;
      moreBtn.textContent = "carregando…";
    }
    let res;
    try {
      let q = R.sb.from("feed_publicacoes").select("*").order("created_at", { ascending: false }).range(offset, offset + PAGE - 1);
      if (tipo) q = q.eq("tipo", tipo);
      if (lista) {
        const ids = await idsDaLista();
        if (ids === null) {
          grid.setAttribute("aria-busy", "false");
          const next = encodeURIComponent(`feed.html?lista=${lista}`);
          grid.innerHTML = `<div style="grid-column:1/-1">${R.render.state("empty", `Entre para ver seus ${lista}.`, "Suas peças salvas e curtidas ficam guardadas na sua conta.", `<a class="btn" href="${R.url(`entrar.html?next=${next}`)}">entrar</a>`)}</div>`;
          return;
        }
        q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      }
      res = await q;
    } catch (e) { res = { error: e }; }
    grid.setAttribute("aria-busy", "false");
    moreBtn.disabled = false;
    moreBtn.textContent = "carregar mais";

    if (res.error) {
      console.error("[Repeteco] feed:", res.error);
      grid.innerHTML = `<div style="grid-column:1/-1">${R.render.state("error", "Não conseguimos carregar o feed.", R.errorMessage(res.error), '<button class="btn" type="button" data-retry>tentar de novo</button>')}</div>`;
      return;
    }
    const data = res.data;
    if (reset && !data.length) {
      const msg = lista === "salvos" ? ["Você ainda não salvou nenhuma peça.", "Use o marcador nas fotos para guardar as peças que gostar."]
        : lista === "curtidos" ? ["Você ainda não curtiu nenhuma peça.", "Toque no coração das fotos para curtir."]
        : [tipo ? `Ainda não há ${R.label("tipos", tipo).toLowerCase()} publicados.` : "Nenhuma peça publicada ainda.", "Os brechós aprovados publicam peças pelo painel. Enquanto isso, conheça os brechós no mapa."];
      grid.innerHTML = `<div style="grid-column:1/-1">${R.render.state("empty", msg[0], msg[1], `<a class="btn" href="${R.url(lista ? "feed.html" : "brechos.html")}">${lista ? "ver o feed" : "ver o mapa"}</a>`)}</div>`;
      status.textContent = msg[0];
      return;
    }
    const html = data.map((p, i) => R.render.mosaic(p, offset + i, { eager: reset && i < 4 })).join("");
    if (reset) grid.innerHTML = html; else grid.insertAdjacentHTML("beforeend", html);
    R.interactions.sync(grid);
    offset += data.length;
    more.hidden = data.length < PAGE;
    status.textContent = reset ? `${R.fmt.count(data.length, "peça carregada", "peças carregadas")}.` : `Mais ${data.length} peças carregadas.`;
  }

  function syncUrl() {
    const url = new URL(location.href);
    tipo ? url.searchParams.set("tipo", tipo) : url.searchParams.delete("tipo");
    lista ? url.searchParams.set("lista", lista) : url.searchParams.delete("lista");
    history.replaceState(null, "", url);
    R.seo({ title: lista ? `Meus ${lista}` : tipo ? `${R.label("tipos", tipo)} no feed` : "Feed de peças dos brechós de SP" });
  }

  tabs.addEventListener("click", e => {
    const b = e.target.closest("[data-lista], [data-tipo]");
    if (!b) return;
    if (b.hasAttribute("data-lista")) { lista = b.dataset.lista; tipo = ""; }
    else { tipo = b.dataset.tipo; lista = ""; }
    R.$$(".filter-tab", tabs).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    syncUrl();
    load(true);
  });
  grid.addEventListener("click", e => { if (e.target.closest("[data-retry]")) load(true); });
  moreBtn.addEventListener("click", () => load(false));
  // Ao remover dos salvos/curtidos, a lista filtrada é atualizada.
  document.addEventListener("repeteco:toggled", e => {
    const { act, on } = e.detail;
    if (!on && ((lista === "salvos" && act === "save") || (lista === "curtidos" && act === "like"))) setTimeout(() => load(true), 300);
  });

  if (!R.sb) { grid.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  if (tipo || lista) syncUrl();
  loadTabs();
  load(true);
})();
