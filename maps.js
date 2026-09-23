/* REPETECO — Google Maps Platform */
let repetecoGoogleMap = null;
let repetecoGoogleMarkers = [];
let repetecoMapsReady = null;

function googleMapsKey() {
  return window.REPETECO_CONFIG?.googleMapsApiKey || "";
}

async function carregarGoogleMaps() {
  if (repetecoMapsReady) return repetecoMapsReady;
  repetecoMapsReady = new Promise((resolve, reject) => {
    const key = googleMapsKey();
    if (!key) return reject(new Error("Chave do Google Maps não configurada."));
    if (window.google?.maps) return resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Não foi possível carregar o Google Maps."));
    document.head.appendChild(script);
  });
  return repetecoMapsReady;
}

async function iniciarMapaGoogle(brechos = []) {
  const container = document.getElementById("googleMap");
  const fallback = document.getElementById("mapFallback");
  if (!container) return false;
  try {
    const maps = await carregarGoogleMaps();
    const { Map } = await maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await maps.importLibrary("marker");
    repetecoGoogleMap = new Map(container, {
      center: { lat: -23.55052, lng: -46.63331 },
      zoom: 11,
      mapId: window.REPETECO_CONFIG?.googleMapsMapId || "DEMO_MAP_ID",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: "greedy"
    });
    repetecoGoogleMarkers.forEach(m => m.map = null);
    repetecoGoogleMarkers = [];
    const validos = brechos.filter(b => Number.isFinite(Number(b.latitude)) && Number.isFinite(Number(b.longitude)));
    validos.forEach(b => {
      const marker = new AdvancedMarkerElement({
        map: repetecoGoogleMap,
        position: { lat: Number(b.latitude), lng: Number(b.longitude) },
        title: b.nome || "Brechó"
      });
      marker.addListener?.("click", () => window.openModal?.(b.id));
      repetecoGoogleMarkers.push(marker);
    });
    if (validos.length === 1) repetecoGoogleMap.setCenter({ lat: Number(validos[0].latitude), lng: Number(validos[0].longitude) });
    if (validos.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      validos.forEach(b => bounds.extend({ lat: Number(b.latitude), lng: Number(b.longitude) }));
      repetecoGoogleMap.fitBounds(bounds, 50);
    }
    if (fallback) fallback.style.display = "none";
    container.classList.add("ready");
    document.querySelector(".map-svg")?.classList.add("legacy-map-hidden");
    return true;
  } catch (e) {
    console.info("[Repeteco] Google Maps em modo fallback:", e.message);
    container.classList.remove("ready");
    document.querySelector(".map-svg")?.classList.remove("legacy-map-hidden");
    if (fallback) {
      fallback.style.display = "flex";
      fallback.querySelector("strong")?.replaceChildren(document.createTextNode("Mapa interativo"));
      fallback.querySelector("span")?.replaceChildren(document.createTextNode("Configure sua chave do Google Maps para ativar o mapa real."));
    }
    return false;
  }
}

async function localizarEnderecoGoogle(endereco) {
  if (!endereco) throw new Error("Informe um endereço antes de localizar.");
  const maps = await carregarGoogleMaps();
  const geocoder = new maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: `${endereco}, São Paulo, SP, Brasil` }, (results, status) => {
      if (status !== "OK" || !results?.[0]) return reject(new Error("Não encontramos esse endereço no Google Maps."));
      const result = results[0];
      resolve({
        latitude: result.geometry.location.lat(),
        longitude: result.geometry.location.lng(),
        google_place_id: result.place_id || null,
        endereco_formatado: result.formatted_address || endereco
      });
    });
  });
}

window.iniciarMapaGoogle = iniciarMapaGoogle;
window.localizarEnderecoGoogle = localizarEnderecoGoogle;
