/* REPETECO — mapa de brechós (Leaflet/OSM) + cartões + novidades do feed */
(function () {
  const R = window.R;
  const listEl = R.$("#shopList");
  const tabs = R.$("#hoodTabs");
  const status = R.$("#shopStatus");
  const qInput = R.$("#shopQ");
  const params = R.params();
  let bairro = params.get("bairro") || "";
  let termo = params.get("q") || "";
  let map = null;
  let plotted = { markers: new Map(), layer: null };

  async function loadTabs() {
    const { data } = await R.sb.from("brechos_publicos").select("bairro").limit(2000);
    const hoods = [...new Set((data || []).map(b => b.bairro?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (bairro && !hoods.includes(bairro)) hoods.unshift(bairro);
    const li = (v, label) => `<li><button type="button" class="filter-tab" data-bairro="${R.esc(v)}" aria-pressed="${v === bairro}">${R.esc(label)}</button></li>`;
    tabs.innerHTML = li("", "todos os bairros") + hoods.map(h => li(h, h)).join("");
  }

  function syncUrl() {
    const url = new URL(location.href);
    bairro ? url.searchParams.set("bairro", bairro) : url.searchParams.delete("bairro");
    termo ? url.searchParams.set("q", termo) : url.searchParams.delete("q");
    history.replaceState(null, "", url);
    R.seo({ title: bairro ? `Brechós em ${bairro}` : "Mapa de brechós" });
  }

  async function load() {
    listEl.setAttribute("aria-busy", "true");
    listEl.innerHTML = `<div class="shop-list">${R.render.skeletonTiles(4)}</div>`;
    let q = R.sb.from("brechos_publicos").select("*").order("nome", { ascending: true }).limit(1000);
    if (bairro) q = q.eq("bairro", bairro);
    const t = termo.replace(/[,()*%:"\\]/g, " ").trim();
    if (t) q = q.or(`nome.ilike.*${t}*,bairro.ilike.*${t}*,descricao.ilike.*${t}*`);
    const { data, error } = await q;
    listEl.setAttribute("aria-busy", "false");
    if (error) {
      listEl.innerHTML = R.render.state("error", "Não conseguimos carregar os brechós.", R.errorMessage(error), '<button class="btn" type="button" data-retry>tentar de novo</button>');
      return;
    }
    if (!data.length) {
      listEl.innerHTML = R.render.state("empty", t ? `Nenhum brechó encontrado para “${t}”.` : bairro ? `Nenhum brechó em ${bairro} ainda.` : "Nenhum brechó aprovado ainda.",
        "Conhece um brechó que deveria estar aqui? Indique para o dono se cadastrar.", `<a class="btn btn-outline" href="${R.url("cadastro.html")}">cadastrar um brechó</a>`);
    } else {
      listEl.innerHTML = `<div class="shop-list">${data.map(b => R.render.brechoRow(b)).join("")}</div>`;
      R.$$(".shop-card", listEl).forEach(card => {
        const b = data.find(x => String(x.id) === card.dataset.brecho);
        const foot = card.querySelector(".shop-card-foot span");
        foot.innerHTML = R.map.hasCoords(b)
          ? `<button type="button" class="btn btn-ghost btn-sm" data-locate="${R.esc(b.id)}">${R.icon("pin")} ver no mapa</button>`
          : '<span class="small muted">sem posição no mapa</span>';
      });
      R.interactions.sync(listEl);
    }
    const withCoords = data.filter(R.map.hasCoords).length;
    status.textContent = `${R.fmt.count(data.length, "brechó", "brechós")}${bairro ? ` em ${bairro}` : ""}. ${withCoords} no mapa.`;
    const missing = data.length - withCoords;
    R.$("#mapNote").textContent = data.length && missing
      ? `${missing} ${missing === 1 ? "brechó ainda não informou o endereço exato e aparece" : "brechós ainda não informaram o endereço exato e aparecem"} só na lista abaixo.`
      : "";

    if (map) {
      plotted.layer?.remove();
      plotted = R.map.plotBrechos(map, data, {
        onSelect: b => {
          R.track(b.id, "map_click");
          R.$$(".shop-card.is-highlight").forEach(x => x.classList.remove("is-highlight"));
          R.$(`.shop-card[data-brecho="${CSS.escape(String(b.id))}"]`)?.classList.add("is-highlight");
        }
      });
      if (!plotted.plotted) map.setView(window.REPETECO_CONFIG.mapCenter, window.REPETECO_CONFIG.mapZoom);
    }
  }

  async function loadRecent() {
    const { data, error } = await R.sb.from("feed_publicacoes").select("*").order("created_at", { ascending: false }).limit(4);
    if (error || !data.length) return;
    R.$("#recentPieces").innerHTML = data.map(p => R.render.tile(p)).join("");
    R.$("#recentSection").hidden = false;
    R.interactions.sync(R.$("#recentPieces"));
  }

  tabs.addEventListener("click", e => {
    const b = e.target.closest("[data-bairro]");
    if (!b) return;
    bairro = b.dataset.bairro;
    R.$$("[data-bairro]", tabs).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    syncUrl();
    load();
  });
  R.$("#shopSearch").addEventListener("submit", e => {
    e.preventDefault();
    termo = qInput.value.trim();
    syncUrl();
    load();
  });
  listEl.addEventListener("click", e => {
    if (e.target.closest("[data-retry]")) return load();
    const btn = e.target.closest("[data-locate]");
    if (!btn) return;
    const marker = plotted.markers.get(btn.dataset.locate);
    if (!marker) return;
    R.$(".map-frame").scrollIntoView({ behavior: "smooth", block: "center" });
    map.setView(marker.getLatLng(), 16);
    marker.openPopup();
    R.track(btn.dataset.locate, "map_click");
  });

  if (!R.sb) { listEl.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  qInput.value = termo;
  if (bairro || termo) syncUrl();
  map = R.map.create(R.$("#mapCanvas"));
  loadTabs();
  load();
  loadRecent();
})();
