/* =====================================================
   REPETECO — recorte de imagem no próprio site
   R.crop(fileOuUrl, { aspect: 3/4 }) → Promise<HTMLCanvasElement|null>
   Arrastar (mouse/toque) move a foto, o controle deslizante
   aproxima, "girar" roda 90°. Teclado: setas movem, + e − aproximam.
   O resultado é um canvas de até 1440 px no maior lado.
   ===================================================== */
(function () {
  const R = window.R;
  const OUT_MAX = 1440;
  const ASPECTS = [
    { label: "3:4", value: 3 / 4 },
    { label: "4:5", value: 4 / 5 },
    { label: "1:1", value: 1 },
    { label: "16:9", value: 16 / 9 },
    { label: "original", value: 0 }
  ];

  R.crop = async function crop(source, { aspect = 3 / 4, title = "Ajustar foto" } = {}) {
    const img = await R.media.decode(source);
    return new Promise(resolve => {
      const st = { aspect, zoom: 1, rot: 0, x: 0, y: 0 };
      const d = document.createElement("dialog");
      d.className = "sheet wide cropper";
      d.setAttribute("aria-labelledby", "cropTitle");
      d.innerHTML = `
        <div class="sheet-head"><h2 id="cropTitle">${R.esc(title)}</h2>
          <button class="icon-btn" type="button" data-cancel aria-label="Cancelar">${R.icon("close")}</button></div>
        <div class="sheet-body">
          <div class="crop-stage" tabindex="0" role="application" aria-label="Área de recorte. Arraste ou use as setas para enquadrar; + e − para aproximar.">
            <canvas></canvas>
          </div>
          <div class="crop-controls">
            <div class="pill-tabs" role="group" aria-label="Proporção">
              ${ASPECTS.map(a => `<button type="button" class="pill-tab" data-aspect="${a.value}" aria-pressed="${Math.abs(a.value - aspect) < 0.01}">${a.label}</button>`).join("")}
            </div>
            <label class="crop-zoom">Zoom <input type="range" min="1" max="4" step="0.01" value="1" data-zoom></label>
            <button class="btn btn-outline btn-sm" type="button" data-rotate>girar 90°</button>
          </div>
        </div>
        <div class="editor-foot"><span class="small muted">A parte fora do quadro é descartada.</span>
          <div class="group"><button class="btn btn-ghost" type="button" data-cancel>cancelar</button><button class="btn" type="button" data-ok>usar esta foto</button></div></div>`;
      document.body.appendChild(d);
      const stage = d.querySelector(".crop-stage");
      const canvas = d.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const opener = document.activeElement;

      const rotated = () => (st.rot % 180 === 0 ? { w: img.width, h: img.height } : { w: img.height, h: img.width });
      const ratio = () => st.aspect || rotated().w / rotated().h;

      // Quadro de recorte centralizado dentro do palco.
      function frame(W, H) {
        const pad = 16;
        let fw = W - pad * 2, fh = fw / ratio();
        if (fh > H - pad * 2) { fh = H - pad * 2; fw = fh * ratio(); }
        return { x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh };
      }
      // Escala que faz a foto cobrir o quadro (zoom 1).
      const coverScale = f => Math.max(f.w / rotated().w, f.h / rotated().h);
      function clamp(f) {
        const s = coverScale(f) * st.zoom;
        const maxX = Math.max(0, (rotated().w * s - f.w) / 2 / f.w);
        const maxY = Math.max(0, (rotated().h * s - f.h) / 2 / f.h);
        st.x = Math.min(maxX, Math.max(-maxX, st.x));
        st.y = Math.min(maxY, Math.max(-maxY, st.y));
      }
      // Desenha a foto com o quadro f mapeado para (ox, oy) e fator k.
      function paint(c, f, k, ox, oy) {
        const s = coverScale(f) * st.zoom * k;
        c.save();
        c.translate(ox + (f.w / 2 + st.x * f.w) * k, oy + (f.h / 2 + st.y * f.h) * k);
        c.rotate(st.rot * Math.PI / 180);
        c.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
        c.restore();
      }
      function draw() {
        const W = stage.clientWidth, H = stage.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const f = frame(W, H);
        clamp(f);
        ctx.fillStyle = "#1c0820";
        ctx.fillRect(0, 0, W, H);
        paint(ctx, f, 1, f.x, f.y);
        // escurece o que fica fora do quadro
        ctx.fillStyle = "rgba(28, 8, 32, .62)";
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.rect(f.x, f.y, f.w, f.h);
        ctx.fill("evenodd");
        ctx.strokeStyle = "#FFFFDF";
        ctx.lineWidth = 2;
        ctx.strokeRect(f.x, f.y, f.w, f.h);
      }

      function output() {
        const r = ratio();
        const outW = r >= 1 ? OUT_MAX : Math.round(OUT_MAX * r);
        const outH = Math.round(outW / r);
        const W = stage.clientWidth, H = stage.clientHeight;
        const f = frame(W, H);
        // Não amplia além da resolução real da foto.
        const native = coverScale(f) * st.zoom;
        const k = Math.min(outW / f.w, 1 / native);
        const c = document.createElement("canvas");
        c.width = Math.round(f.w * k); c.height = Math.round(f.h * k);
        const cx = c.getContext("2d");
        cx.fillStyle = "#ffffff";
        cx.fillRect(0, 0, c.width, c.height);
        cx.imageSmoothingQuality = "high";
        paint(cx, f, k, 0, 0);
        return c;
      }

      // arrastar
      let drag = null;
      stage.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y }; stage.setPointerCapture(e.pointerId); });
      stage.addEventListener("pointermove", e => {
        if (!drag) return;
        const f = frame(stage.clientWidth, stage.clientHeight);
        st.x = drag.sx + (e.clientX - drag.x) / f.w;
        st.y = drag.sy + (e.clientY - drag.y) / f.h;
        draw();
      });
      stage.addEventListener("pointerup", () => { drag = null; });
      stage.addEventListener("wheel", e => { e.preventDefault(); setZoom(st.zoom - e.deltaY * 0.002); }, { passive: false });
      stage.addEventListener("keydown", e => {
        const step = 0.03;
        const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (moves[e.key]) { e.preventDefault(); st.x += moves[e.key][0]; st.y += moves[e.key][1]; draw(); }
        if (e.key === "+" || e.key === "=") setZoom(st.zoom + 0.1);
        if (e.key === "-") setZoom(st.zoom - 0.1);
      });
      const zoomInput = d.querySelector("[data-zoom]");
      function setZoom(z) { st.zoom = Math.min(4, Math.max(1, z)); zoomInput.value = String(st.zoom); draw(); }
      zoomInput.addEventListener("input", () => setZoom(Number(zoomInput.value)));

      const finish = result => { d.close(); d.remove(); img.close?.(); opener?.focus?.(); resolve(result); };
      d.addEventListener("click", e => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-cancel")) finish(null);
        if (b.hasAttribute("data-ok")) finish(output());
        if (b.hasAttribute("data-rotate")) { st.rot = (st.rot + 90) % 360; st.x = st.y = 0; draw(); }
        if (b.dataset.aspect !== undefined) {
          st.aspect = Number(b.dataset.aspect);
          st.x = st.y = 0;
          d.querySelectorAll("[data-aspect]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
          draw();
        }
      });
      d.addEventListener("cancel", e => { e.preventDefault(); finish(null); });
      d.showModal();
      requestAnimationFrame(draw);
      stage.focus();
    });
  };
})();
