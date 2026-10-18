/* =====================================================
   REPETECO — mapa com OpenStreetMap + Leaflet
   Leaflet é servido localmente (assets/vendor/leaflet).
   Geocodificação via Nominatim (OSM), 1 requisição por ação.
   ===================================================== */
(function () {
  const R = window.R;
  const cfg = window.REPETECO_CONFIG || {};

  const hasCoords = b => b && Number.isFinite(Number(b.latitude)) && Number.isFinite(Number(b.longitude))
    && Math.abs(Number(b.latitude)) <= 90 && Math.abs(Number(b.longitude)) <= 180
    && !(Number(b.latitude) === 0 && Number(b.longitude) === 0);

  function pinIcon(active) {
    return window.L.divIcon({
      className: "map-pin" + (active ? " is-active" : ""),
      html: '<span aria-hidden="true"></span>',
      iconSize: [28, 36],
      iconAnchor: [14, 34],
      popupAnchor: [0, -30]
    });
  }

  function showError(el, msg) {
    el.innerHTML = `<div class="map-error" role="status"><strong>Mapa indisponível</strong><span>${R.esc(msg)}</span></div>`;
  }

  // Cria um mapa. Retorna null (e mostra aviso) se o Leaflet não carregou.
  function create(el, { center, zoom, scrollWheelZoom = false } = {}) {
    if (!el) return null;
    if (!window.L) {
      showError(el, "Não foi possível carregar a biblioteca do mapa. A lista de brechós continua disponível.");
      return null;
    }
    const map = window.L.map(el, {
      center: center || cfg.mapCenter || [-23.55052, -46.63331],
      zoom: zoom || cfg.mapZoom || 12,
      scrollWheelZoom
    });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    let tileErrors = 0;
    const tiles = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>'
    }).addTo(map);
    tiles.on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors === 6) R.toast("O mapa está com dificuldade para carregar. Verifique sua conexão.", "error");
    });
    // Corrige tamanho quando o contêiner aparece depois (abas/mobile).
    if ("ResizeObserver" in window) new ResizeObserver(() => map.invalidateSize()).observe(el);
    el.querySelector(".leaflet-container")?.setAttribute("aria-label", "Mapa");
    return map;
  }

  // Adiciona marcadores de brechós. Retorna { markers: Map(id → marker), bounds }.
  function plotBrechos(map, brechos, { onSelect } = {}) {
    const markers = new Map();
    if (!map) return { markers, plotted: 0 };
    const layer = window.L.layerGroup().addTo(map);
    const pts = [];
    brechos.filter(hasCoords).forEach(b => {
      const pos = [Number(b.latitude), Number(b.longitude)];
      const m = window.L.marker(pos, { icon: pinIcon(false), title: b.nome, alt: b.nome, keyboard: true }).addTo(layer);
      const href = R.url(`brecho.html?b=${encodeURIComponent(b.slug || b.id)}`);
      m.bindPopup(`<div class="map-popup"><strong>${R.esc(b.nome)}</strong><span>${R.esc(R.fmt.place(b.bairro, b.cidade))}</span><a href="${href}">Ver brechó</a></div>`);
      m.on("click", () => onSelect?.(b));
      markers.set(String(b.id), m);
      pts.push(pos);
    });
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    return { markers, layer, plotted: pts.length };
  }

  // Marcador arrastável para o dono ajustar a posição exata.
  function editablePin(map, lat, lng, onMove) {
    if (!map) return null;
    const m = window.L.marker([lat, lng], { draggable: true, icon: pinIcon(true), title: "Arraste para ajustar a posição", keyboard: true }).addTo(map);
    m.on("dragend", () => { const p = m.getLatLng(); onMove?.(p.lat, p.lng); });
    map.on("click", e => { m.setLatLng(e.latlng); onMove?.(e.latlng.lat, e.latlng.lng); });
    map.setView([lat, lng], 16);
    return m;
  }

  // Endereço → coordenadas usando o Nominatim (OpenStreetMap).
  async function geocode(q) {
    const query = String(q || "").trim();
    if (query.length < 5) throw new Error("Informe rua, número, bairro e cidade para localizar.");
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(query)}`;
    let res;
    try { res = await fetch(url, { headers: { Accept: "application/json" } }); }
    catch { throw new Error("Não foi possível consultar o serviço de endereços agora."); }
    if (!res.ok) throw new Error("O serviço de endereços está indisponível. Tente em alguns minutos ou marque a posição no mapa.");
    const data = await res.json();
    if (!data?.length) throw new Error("Endereço não encontrado. Confira os dados ou clique no mapa para marcar a posição.");
    return { latitude: Number(data[0].lat), longitude: Number(data[0].lon), endereco_formatado: data[0].display_name };
  }

  R.map = { create, plotBrechos, editablePin, geocode, hasCoords, pinIcon };
})();
