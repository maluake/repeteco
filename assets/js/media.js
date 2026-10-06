/* =====================================================
   REPETECO — imagens: validação, compressão e Storage
   Caminho no bucket: <auth.uid()>/<timestamp>-<aleatório>.<ext>
   (exigido pelas policies de storage da migration v5)
   ===================================================== */
(function () {
  const R = window.R;
  const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
  const MAX_INPUT = 15 * 1024 * 1024;

  function validate(file) {
    if (!file) throw new Error("Escolha uma imagem.");
    if (!ACCEPT.includes(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
    if (file.size > MAX_INPUT) throw new Error("A imagem passa de 15 MB. Escolha um arquivo menor.");
  }

  async function decode(file) {
    if ("createImageBitmap" in window) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* tenta via <img> */ }
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível ler esta imagem."));
      img.src = URL.createObjectURL(file);
    });
  }

  function toBlob(canvas, type, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  // Redimensiona para no máximo `max` px no maior lado e recomprime.
  async function compress(file, { max = 1600, quality = 0.82 } = {}) {
    validate(file);
    const src = await decode(file);
    const w = src.width, h = src.height;
    const scale = Math.min(1, max / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    src.close?.();
    let blob = await toBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob) throw new Error("Não foi possível processar a imagem.");
    if (scale === 1 && blob.size >= file.size) return file;
    return blob;
  }

  async function upload(bucket, file, opts = {}) {
    await R.ready;
    if (!R.auth.user) throw new Error("Entre na sua conta para enviar imagens.");
    const blob = await compress(file, opts);
    const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }[blob.type] || "jpg";
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${R.auth.user.id}/${Date.now()}-${rand}.${ext}`;
    const { error } = await R.sb.storage.from(bucket).upload(path, blob, {
      contentType: blob.type, cacheControl: "31536000", upsert: false
    });
    if (error) {
      if (/bucket not found/i.test(error.message)) throw new Error("O armazenamento de imagens ainda não foi configurado (rode a migration v5).");
      throw new Error(R.errorMessage(error, "Não foi possível enviar a imagem."));
    }
    const { data } = R.sb.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  // Extrai o caminho interno a partir de uma URL pública do bucket.
  function pathFromUrl(bucket, url) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = String(url || "").indexOf(marker);
    return i === -1 ? null : decodeURIComponent(String(url).slice(i + marker.length).split("?")[0]);
  }

  async function remove(bucket, pathOrUrl) {
    const path = pathFromUrl(bucket, pathOrUrl) || (pathOrUrl && !/^https?:/i.test(pathOrUrl) ? pathOrUrl : null);
    if (!path) return;
    const { error } = await R.sb.storage.from(bucket).remove([path]);
    if (error) console.info("[Repeteco] arquivo antigo não removido:", error.message);
  }

  // Liga um <input type=file> a uma área de prévia. Retorna () => File|null.
  function picker(input, preview, { onError } = {}) {
    let current = null;
    let objectUrl = null;
    input.setAttribute("accept", ACCEPT.join(","));
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        validate(file);
        current = file;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        if (preview) preview.innerHTML = `<img src="${objectUrl}" alt="Prévia da imagem escolhida">`;
        onError?.("");
      } catch (e) {
        input.value = "";
        current = null;
        onError?.(e.message);
      }
    });
    return {
      get: () => current,
      reset: () => { current = null; input.value = ""; }
    };
  }

  R.media = { compress, upload, remove, picker, pathFromUrl, validate, ACCEPT };
})();
