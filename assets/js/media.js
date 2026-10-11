/* =====================================================
   REPETECO — imagens: validação, compressão, miniatura e Storage
   Caminho no bucket: <auth.uid()>/<timestamp>-<aleatório>[-t].<ext>
   (exigido pelas policies de storage)

   Para economizar espaço, cada foto é reduzida no navegador:
   - principal: até 1440 px no maior lado, ~200 KB no máximo;
   - miniatura (opcional): 480 px, ~35 KB, usada nas grades.
   ===================================================== */
(function () {
  const R = window.R;
  const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
  const MAX_INPUT = 20 * 1024 * 1024;
  const MAIN = { max: 1440, maxBytes: 200 * 1024 };
  const THUMB = { max: 480, maxBytes: 35 * 1024 };

  function validate(file) {
    if (!file) throw new Error("Escolha uma imagem.");
    if (!ACCEPT.includes(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
    if (file.size > MAX_INPUT) throw new Error("A imagem passa de 20 MB. Escolha um arquivo menor.");
  }

  // Carrega File, Blob ou URL como imagem desenhável.
  async function decode(src) {
    if (src instanceof Blob && "createImageBitmap" in window) {
      try { return await createImageBitmap(src, { imageOrientation: "from-image" }); } catch { /* tenta via <img> */ }
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível ler esta imagem."));
      img.src = src instanceof Blob ? URL.createObjectURL(src) : src;
    });
  }

  // Redimensiona qualquer fonte (imagem ou canvas) para caber em max px.
  function resize(source, max) {
    const w = source.width, h = source.height;
    const scale = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, c.width, c.height);
    return c;
  }

  const toBlob = (canvas, type, q) => new Promise(res => canvas.toBlob(res, type, q));

  // Reduz a qualidade em passos até ficar abaixo de maxBytes (WebP; JPEG se o navegador não gerar WebP).
  async function encode(canvas, maxBytes) {
    let type = "image/webp";
    let blob = await toBlob(canvas, type, 0.82);
    if (!blob || blob.type !== "image/webp") { type = "image/jpeg"; blob = await toBlob(canvas, type, 0.82); }
    for (const q of [0.74, 0.66, 0.58, 0.5]) {
      if (!blob || blob.size <= maxBytes) break;
      blob = await toBlob(canvas, type, q);
    }
    if (!blob) throw new Error("Não foi possível processar a imagem.");
    return blob;
  }

  // Aceita File/Blob (sem recorte) ou HTMLCanvasElement (já recortado).
  async function prepare(source, { thumb = false, max = MAIN.max, maxBytes = MAIN.maxBytes } = {}) {
    let drawable = source;
    if (!(source instanceof HTMLCanvasElement)) {
      validate(source);
      drawable = await decode(source);
    }
    const main = await encode(resize(drawable, max), maxBytes);
    const small = thumb ? await encode(resize(drawable, THUMB.max), THUMB.maxBytes) : null;
    drawable.close?.();
    return { main, thumb: small };
  }

  const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

  async function put(bucket, blob, suffix = "") {
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${R.auth.user.id}/${Date.now()}-${rand}${suffix}.${EXT[blob.type] || "jpg"}`;
    const { error } = await R.sb.storage.from(bucket).upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
    if (error) {
      if (/bucket not found/i.test(error.message)) throw new Error("O armazenamento de imagens ainda não foi configurado (rode a migration v5).");
      throw new Error(R.errorMessage(error, "Não foi possível enviar a imagem."));
    }
    return { url: R.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl, path };
  }

  // Envia a imagem (e a miniatura, se pedida). Retorna url/path e thumb_url/thumb_path.
  async function upload(bucket, source, opts = {}) {
    await R.ready;
    if (!R.auth.user) throw new Error("Entre na sua conta para enviar imagens.");
    const { main, thumb } = await prepare(source, opts);
    const a = await put(bucket, main);
    if (!thumb) return a;
    try {
      const b = await put(bucket, thumb, "-t");
      return { ...a, thumb_url: b.url, thumb_path: b.path };
    } catch (e) {
      await remove(bucket, a.path);
      throw e;
    }
  }

  function pathFromUrl(bucket, url) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = String(url || "").indexOf(marker);
    return i === -1 ? null : decodeURIComponent(String(url).slice(i + marker.length).split("?")[0]);
  }

  async function remove(bucket, ...pathsOrUrls) {
    const paths = pathsOrUrls.flat().map(p => pathFromUrl(bucket, p) || (p && !/^https?:/i.test(p) ? p : null)).filter(Boolean);
    if (!paths.length) return;
    const { error } = await R.sb.storage.from(bucket).remove(paths);
    if (error) console.info("[Repeteco] arquivo antigo não removido:", error.message);
  }

  // Liga um <input type=file> a uma prévia. Com { aspect }, abre o recorte.
  // Retorna { get(): File|Canvas|null, reset() }.
  function picker(input, preview, { onError, aspect = null } = {}) {
    let current = null;
    input.setAttribute("accept", ACCEPT.join(","));
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        validate(file);
        let result = file;
        if (aspect && R.crop) {
          const canvas = await R.crop(file, { aspect });
          if (!canvas) { input.value = ""; return; }
          result = canvas;
        }
        current = result;
        const src = result instanceof HTMLCanvasElement ? result.toDataURL("image/jpeg", 0.8) : URL.createObjectURL(result);
        if (preview) preview.innerHTML = `<img src="${src}" alt="Prévia da imagem escolhida">`;
        onError?.("");
      } catch (e) {
        input.value = "";
        current = null;
        onError?.(e.message);
      }
    });
    return { get: () => current, reset: () => { current = null; input.value = ""; } };
  }

  R.media = { prepare, upload, remove, picker, pathFromUrl, validate, decode, ACCEPT };
})();
