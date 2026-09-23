/* REPETECO — acessibilidade e preferências visuais */
(function () {
  const KEY = "repeteco-a11y";
  const defaults = { size: 0, contrast: false, grayscale: false, color: "none", motion: false, underline: false };
  const state = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || "{}"));

  function apply() {
    const b = document.body;
    b.classList.toggle("a11y-contrast", !!state.contrast);
    b.classList.toggle("a11y-grayscale", !!state.grayscale);
    b.classList.toggle("a11y-no-motion", !!state.motion);
    b.classList.toggle("a11y-underline", !!state.underline);
    b.classList.remove("a11y-protanopia", "a11y-deuteranopia", "a11y-tritanopia");
    if (state.color !== "none") b.classList.add(`a11y-${state.color}`);
    document.documentElement.style.setProperty("--a11y-scale", String(1 + Number(state.size) * 0.08));
    localStorage.setItem(KEY, JSON.stringify(state));
    const status = document.getElementById("a11yStatus");
    if (status) status.textContent = "preferências de acessibilidade atualizadas";
  }

  window.toggleAccessibility = function () {
    document.getElementById("accessibilityPanel")?.classList.toggle("open");
  };
  window.a11yFont = function (delta) { state.size = Math.max(-1, Math.min(3, Number(state.size) + delta)); apply(); };
  window.a11yContrast = function () { state.contrast = !state.contrast; apply(); };
  window.a11yGrayscale = function () { state.grayscale = !state.grayscale; apply(); };
  window.a11yMotion = function () { state.motion = !state.motion; apply(); };
  window.a11yUnderline = function () { state.underline = !state.underline; apply(); };
  window.a11yColor = function (mode) { state.color = state.color === mode ? "none" : mode; apply(); };
  window.a11yReset = function () { Object.assign(state, defaults); apply(); };

  document.addEventListener("DOMContentLoaded", function () {
    apply();
    const panel = document.getElementById("accessibilityPanel");
    if (!panel) return;
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") panel.classList.remove("open");
    });
  });
})();
