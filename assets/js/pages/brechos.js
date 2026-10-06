/* REPETECO — diretório de brechós com mapa (Leaflet/OSM) */
(function () {
  const R = window.R;
  const listEl = R.$("#shopList");
  const tabs = R.$("#hoodTabs");
  const directory = R.$("#directory");
  const status = R.$("#shopStatus");
  let bairro = R.params().get("bairro") || "";
  let map = null;
  let plotted = { markers: new Map(), layer: null };

  function setView(view) {
    directory.dataset.view = view;
    R.$$("[data-view-btn]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.viewBtn === view)));
    if (view === "mapa") setTimeout(() => map?.invalidateSize(), 0);
  }

  async function loadTabs() {
    const { data } = await R.sb.from("brechos_publicos").select("bairro").limit(2000);
    const hoods = [...new Set((data || []).map(b => b.bairro?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (bairro && !hoods.includes(bairro)) hoods.unshift(bairro);
    const li = (v, label) => `<li><button type="button" class="filter-tab" data-bairro="${R.esc(v)}" aria-pressed="${v === bairro}">${R.esc(label)}</button></li>`;
    tabs.innerHTML = li("", "Todos os bairros") + hoods.map(h => li(h, h)).join("");
  }

  async function load() {
    listEl.setAttribute("aria-busy", "true");
    listEl.innerHTML = '<p class="muted" style="padding-block:1.5rem">Carregando brechós…</p>';
    let q = R.sb.from("brechos_publicos").select("*").order("nome", { ascending: true }).limit(1000);
    if (bairro) q = q.eq("bairro", bairro);
    const { data, error } = await q;
    listEl.setAttribute("aria-busy", "false");
    if (error) {
      listEl.innerHTML = R.render.state("error", "Não conseguimos carregar os brechós.", R.errorMessage(error), '<button class="btn" type="button" onclick="location.reload()">Tentar de novo</button>');
      return;
    }
    if (!data.length) {
      listEl.innerHTML = R.render.state("empty", bairro ? `Nenhum brechó em ${bairro} ainda.` : "Nenhum brechó aprovado ainda.", "Conhece um brechó que deveria estar aqui? Indique para o dono se cadastrar.", `<a class="btn btn-outline" href="${R.url("cadastro.html")}">Cadastrar um brechó</a>`);
    } else {
      listEl.innerHTML = `<div class="shop-list">${data.map((b, i) => R.render.brechoRow(b, { index: i })).join("")}</div>`;
      // Ação "ver no mapa" em cada linha que tem coordenadas
      R.$$(".shop-row", listEl).forEach(row => {
        const b = data.find(x => String(x.id) === row.dataset.brecho);
        const foot = row.querySelector(".shop-row-foot");
        if (R.map.hasCoords(b)) {
          foot.insertAdjacentHTML("beforeend", `<button type="button" class="btn btn-ghost btn-sm" data-locate="${R.esc(b.id)}">${R.icon("pin")} Ver no mapa</button>`);
        } else {
          foot.insertAdjacentHTML("beforeend", '<span class="small muted">Localização ainda não informada</span>');
        }
      });
      R.interactions.sync(listEl);
    }
    const withCoords = data.filter(R.map.hasCoords).length;
    status.textContent = `${R.fmt.count(data.length, "brechó", "brechós")}${bairro ? ` em ${bairro}` : ""}. ${withCoords} no mapa.`;
    R.$("#mapNote").textContent = data.length && withCoords < data.length
      ? `${data.length - withCoords} ${data.length - withCoords === 1 ? "brechó ainda não informou" : "brechós ainda não informaram"} o endereço exato e ${data.length - withCoords === 1 ? "aparece" : "aparecem"} só na lista.`
      : "";

    if (map) {
      plotted.layer?.remove();
      plotted = R.map.plotBrechos(map, data, {
        onSelect: b => {
          R.track(b.id, "map_click");
          R.$$(".shop-row.is-highlight").forEach(x => x.classList.remove("is-highlight"));
          const row = R.$(`.shop-row[data-brecho="${CSS.escape(String(b.id))}"]`);
          row?.classList.add("is-highlight");
        }
      });
      if (!plotted.plotted) map.setView(window.REPETECO_CONFIG.mapCenter, window.REPETECO_CONFIG.mapZoom);
    }
  }

  tabs.addEventListener("click", e => {
    const b = e.target.closest("[data-bairro]");
    if (!b) return;
    bairro = b.dataset.bairro;
    R.$$("[data-bairro]", tabs).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    const url = new URL(location.href);
    bairro ? url.searchParams.set("bairro", bairro) : url.searchParams.delete("bairro");
    history.replaceState(null, "", url);
    R.seo({ title: bairro ? `Brechós em ${bairro}` : "Brechós e mapa" });
    load();
  });
  listEl.addEventListener("click", e => {
    const btn = e.target.closest("[data-locate]");
    if (!btn) return;
    const marker = plotted.markers.get(btn.dataset.locate);
    if (!marker) return;
    if (directory.dataset.view === "lista" && matchMedia("(max-width: 56rem)").matches) setView("mapa");
    map.setView(marker.getLatLng(), 16);
    marker.openPopup();
    R.track(btn.dataset.locate, "map_click");
    R.$("#mapCanvas").focus({ preventScroll: true });
  });
  R.$$("[data-view-btn]").forEach(b => b.addEventListener("click", () => setView(b.dataset.viewBtn)));

  if (!R.sb) { listEl.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  if (bairro) R.seo({ title: `Brechós em ${bairro}` });
  map = R.map.create(R.$("#mapCanvas"));
  setView("lista");
  loadTabs();
  load();
})();
