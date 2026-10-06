/* =====================================================
   REPETECO — preferências de acessibilidade
   Carregado no <head> para aplicar as classes antes da
   primeira pintura. Cada opção altera CSS de verdade.
   ===================================================== */
(function () {
  const KEY = "repeteco-a11y";
  const SCALES = [0.9, 1, 1.12, 1.25, 1.4, 1.6];
  const DEFAULTS = { size: 1, contrast: false, safeColors: false, links: false, spacing: false, grayscale: false, motion: false, libras: true };
  const TOGGLES = [
    ["contrast", "a11y-contrast", "Alto contraste", "Preto e branco com bordas fortes e links sublinhados."],
    ["safeColors", "a11y-safe-colors", "Cores seguras para daltonismo", "Troca pares verde/vermelho por azul/laranja e reforça estados com sublinhado."],
    ["links", "a11y-links", "Destacar links", "Todos os links sublinhados e realçados ao passar o cursor ou focar."],
    ["spacing", "a11y-spacing", "Espaçamento de texto", "Mais espaço entre linhas, letras e parágrafos para facilitar a leitura."],
    ["grayscale", "a11y-grayscale", "Tons de cinza", "Remove as cores do conteúdo."],
    ["motion", "a11y-no-motion", "Reduzir movimento", "Desliga animações e rolagem suave."],
    ["libras", null, "Tradução em Libras (VLibras)", "Mostra o widget oficial do Governo Federal para traduzir textos para Libras."]
  ];

  let state = Object.assign({}, DEFAULTS);
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* armazenamento indisponível */ }
  state.size = Math.min(SCALES.length - 1, Math.max(0, Number(state.size) || 1));

  const root = document.documentElement;
  function apply() {
    root.style.setProperty("--a11y-scale", String(SCALES[state.size]));
    TOGGLES.forEach(([key, cls]) => cls && root.classList.toggle(cls, !!state[key]));
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignora */ }
  }
  apply();

  /* ---------- VLibras ---------- */
  let vlibrasLoaded = false;
  function syncLibras() {
    const box = document.getElementById("vlibras-box");
    if (!state.libras) { if (box) box.hidden = true; return; }
    if (box) { box.hidden = false; return; }
    if (vlibrasLoaded) return;
    vlibrasLoaded = true;
    const wrap = document.createElement("div");
    wrap.id = "vlibras-box";
    wrap.innerHTML = '<div vw class="enabled"><div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div></div>';
    document.body.appendChild(wrap);
    const s = document.createElement("script");
    s.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    s.async = true;
    s.onload = () => {
      try { new window.VLibras.Widget("https://vlibras.gov.br/app"); }
      catch (e) { console.info("[Repeteco] VLibras indisponível:", e.message); wrap.hidden = true; }
    };
    s.onerror = () => { wrap.hidden = true; console.info("[Repeteco] VLibras não pôde ser carregado."); };
    document.body.appendChild(s);
  }

  /* ---------- painel ---------- */
  let dialog, opener;
  function sizeLabel() { return `${Math.round(SCALES[state.size] * 100)}%`; }

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "sheet a11y-panel";
    dialog.setAttribute("aria-labelledby", "a11yTitle");
    dialog.innerHTML = `
      <div class="sheet-head">
        <h2 id="a11yTitle">Acessibilidade</h2>
        <button class="icon-btn" type="button" data-close aria-label="Fechar ajustes de acessibilidade">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>
        </button>
      </div>
      <div class="sheet-body">
        <p class="small muted">As preferências ficam salvas neste navegador e valem para todas as páginas do Repeteco.</p>
        <section class="a11y-group" aria-labelledby="a11ySizeTitle">
          <h3 id="a11ySizeTitle">Tamanho do texto</h3>
          <div class="a11y-size">
            <button class="btn btn-outline btn-sm" type="button" data-size="-1" aria-label="Diminuir texto">A−</button>
            <output id="a11ySizeValue" aria-live="polite">${sizeLabel()}</output>
            <button class="btn btn-outline btn-sm" type="button" data-size="1" aria-label="Aumentar texto">A+</button>
          </div>
        </section>
        <section class="a11y-group" aria-labelledby="a11yViewTitle">
          <h3 id="a11yViewTitle">Visualização e leitura</h3>
          <div class="a11y-toggles">
            ${TOGGLES.map(([key, , label, desc]) => `
              <button type="button" class="a11y-toggle" data-toggle="${key}" aria-pressed="${!!state[key]}">
                <strong>${label}</strong><span>${desc}</span><i class="switch" aria-hidden="true">${state[key] ? "ligado" : "desligado"}</i>
              </button>`).join("")}
          </div>
        </section>
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
          <a class="link small" href="${window.R?.url ? window.R.url("acessibilidade.html") : "acessibilidade.html"}">Declaração de acessibilidade</a>
          <button class="btn btn-ghost btn-sm" type="button" data-reset>Restaurar padrão</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);

    dialog.addEventListener("click", e => {
      if (e.target === dialog) return close();
      const t = e.target.closest("button");
      if (!t) return;
      if (t.hasAttribute("data-close")) return close();
      if (t.dataset.size) {
        state.size = Math.min(SCALES.length - 1, Math.max(0, state.size + Number(t.dataset.size)));
        dialog.querySelector("#a11ySizeValue").textContent = sizeLabel();
      }
      if (t.dataset.toggle) {
        const k = t.dataset.toggle;
        state[k] = !state[k];
        t.setAttribute("aria-pressed", String(state[k]));
        t.querySelector(".switch").textContent = state[k] ? "ligado" : "desligado";
        if (k === "libras") syncLibras();
      }
      if (t.hasAttribute("data-reset")) {
        state = Object.assign({}, DEFAULTS);
        dialog.querySelectorAll("[data-toggle]").forEach(b => {
          b.setAttribute("aria-pressed", String(!!state[b.dataset.toggle]));
          b.querySelector(".switch").textContent = state[b.dataset.toggle] ? "ligado" : "desligado";
        });
        dialog.querySelector("#a11ySizeValue").textContent = sizeLabel();
        syncLibras();
      }
      apply();
    });
    dialog.addEventListener("close", () => opener?.focus());
  }

  function open(trigger) {
    if (!dialog) build();
    opener = trigger || document.activeElement;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    dialog.querySelector("[data-close]").focus();
  }
  function close() { dialog?.close ? dialog.close() : dialog?.removeAttribute("open"); }

  window.openAccessibility = open;
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-open-a11y]");
    if (t) { e.preventDefault(); open(t); }
  });
  document.addEventListener("DOMContentLoaded", syncLibras);
})();
