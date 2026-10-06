/* REPETECO — salvos e curtidos da pessoa logada (página privada) */
(function () {
  const R = window.R;
  const panel = R.$("#savedPanel");
  const TABS = {
    pecas: { title: "Peças salvas", table: "salvos", kind: "p" },
    brechos: { title: "Brechós salvos", table: "salvos", kind: "b" },
    curtidas: { title: "Peças curtidas", table: "curtidas", kind: "p" }
  };
  let current = R.params().get("aba") in TABS ? R.params().get("aba") : "pecas";

  async function load() {
    const tab = TABS[current];
    R.$$("[role=tab]").forEach(t => {
      const on = t.dataset.tab === current;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", `tab-${current}`);
    panel.setAttribute("aria-busy", "true");
    panel.innerHTML = '<p class="muted">Carregando…</p>';

    const col = tab.kind === "p" ? "publicacao_id" : "brecho_id";
    const refs = await R.sb.from(tab.table).select(`${col}, created_at`).eq("user_id", R.auth.user.id).not(col, "is", null).order("created_at", { ascending: false });
    if (refs.error) {
      panel.innerHTML = R.render.state("error", "Não conseguimos carregar sua lista.", R.errorMessage(refs.error));
      return;
    }
    const ids = refs.data.map(r => r[col]);
    let items = [];
    if (ids.length) {
      const res = tab.kind === "p"
        ? await R.sb.from("feed_publicacoes").select("*").in("id", ids)
        : await R.sb.from("brechos_publicos").select("*").in("id", ids);
      if (res.error) { panel.innerHTML = R.render.state("error", "Não conseguimos carregar sua lista.", R.errorMessage(res.error)); return; }
      const byId = new Map(res.data.map(x => [String(x.id), x]));
      items = ids.map(i => byId.get(String(i))).filter(Boolean); // mantém a ordem em que foram salvos
    }
    panel.setAttribute("aria-busy", "false");
    const hidden = ids.length - items.length;
    if (!items.length) {
      const msg = current === "brechos" ? ["Nenhum brechó salvo.", "Use o marcador ao lado de um brechó para guardá-lo aqui.", "brechos.html", "Explorar brechós"]
        : current === "curtidas" ? ["Você ainda não curtiu nenhuma peça.", "Curta peças no feed para lembrar do que chamou sua atenção.", "feed.html", "Ir aos achados"]
        : ["Nenhuma peça salva.", "Salve peças no feed para encontrá-las depois.", "feed.html", "Ir aos achados"];
      panel.innerHTML = R.render.state("empty", msg[0], msg[1], `<a class="btn" href="${R.url(msg[2])}">${msg[3]}</a>`);
      return;
    }
    panel.innerHTML = (tab.kind === "p"
      ? `<div class="tile-grid contained">${items.map(p => R.render.tile(p)).join("")}</div>`
      : `<div class="shop-list">${items.map(b => R.render.brechoRow(b)).join("")}</div>`)
      + (hidden > 0 ? `<p class="small muted" style="margin-top:1.5rem">${R.fmt.count(hidden, "item salvo não está mais disponível", "itens salvos não estão mais disponíveis")}.</p>` : "");
    R.interactions.sync(panel);
  }

  function select(tab, focus) {
    current = tab;
    const url = new URL(location.href);
    url.searchParams.set("aba", tab);
    history.replaceState(null, "", url);
    load();
    if (focus) R.$(`#tab-${tab}`).focus();
  }

  const tablist = R.$("[role=tablist]");
  tablist.addEventListener("click", e => { const t = e.target.closest("[role=tab]"); if (t) select(t.dataset.tab); });
  tablist.addEventListener("keydown", e => {
    const keys = Object.keys(TABS);
    const i = keys.indexOf(current);
    if (e.key === "ArrowRight") select(keys[(i + 1) % keys.length], true);
    if (e.key === "ArrowLeft") select(keys[(i - 1 + keys.length) % keys.length], true);
  });
  // Remover um item da lista atual reflete imediatamente.
  document.addEventListener("repeteco:toggled", e => {
    const { act, on } = e.detail;
    const relevant = (current === "curtidas" && act === "like") || (current !== "curtidas" && act === "save");
    if (relevant && !on) setTimeout(load, 300);
  });

  R.requireAuth().then(load);
})();
