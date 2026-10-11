/* =====================================================
   REPETECO — editor de peça do dono (galeria com recorte)
   D.openPieceEditor(peca|null, brecho, aoSalvar)
   - até 8 fotos; cada uma pode ser recortada, reordenada,
     removida e ganhar descrição (texto alternativo);
   - tamanho muda com o tipo: roupa, calçado (numeração), único;
   - estilo é texto livre com sugestões;
   - promoção guarda o preço anterior (preco_original).
   ===================================================== */
(function () {
  const R = window.R;
  const D = window.D;
  const V = R.vocab;
  const MAX_FOTOS = 8;

  const options = (obj, current, empty = "Selecione") =>
    `<option value="">${empty}</option>` + Object.entries(obj).map(([v, l]) => `<option value="${v}"${current === v ? " selected" : ""}>${l}</option>`).join("");

  function sizeField(tipo, current) {
    const medida = R.medidaDoTipo(tipo);
    if (!tipo) return { label: "Tamanho", html: '<option value="">Escolha o tipo primeiro</option>', disabled: true };
    if (medida === "nenhuma") return { label: "Tamanho", html: '<option value="">Não se aplica</option>', disabled: true };
    const list = medida === "calcado" ? V.numeracoes : medida === "unico" ? ["Único", ...V.tamanhos.filter(t => t !== "Único")] : V.tamanhos;
    return {
      label: medida === "calcado" ? "Numeração" : "Tamanho",
      html: '<option value="">Selecione</option>' + list.map(t => `<option${t === current ? " selected" : ""}>${t}</option>`).join(""),
      disabled: false
    };
  }

  async function estilosSugeridos() {
    const base = Object.values(V.estilos).map(s => s.toLowerCase());
    const { data } = await R.sb.from("feed_publicacoes").select("estilo").not("estilo", "is", null).limit(1000);
    const usados = (data || []).map(r => R.labelEstilo(r.estilo).toLowerCase());
    return [...new Set([...base, ...usados])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  D.openPieceEditor = function (p, shop, onSaved) {
    const isNew = !p;
    p = p || { titulo: "", descricao: "", tipo: "", tamanho: "", preco: "", preco_original: null, condicao: "", estilo: "", genero: "", disponivel: true, status: "publicado", imagens: [] };
    // Fotos atuais (peças antigas têm só imagem_url).
    let fotos = (Array.isArray(p.imagens) && p.imagens.length ? p.imagens : (p.imagem_url ? [{ url: p.imagem_url, path: p.imagem_path, thumb_url: p.thumb_url, thumb_path: p.thumb_path, alt: p.alt_text }] : []))
      .map(f => ({ ...f, existing: true }));
    const removidas = [];
    const emPromo = p.preco_original !== null && p.preco_original !== undefined && p.preco_original !== "";
    const size = sizeField(p.tipo, p.tamanho);

    const d = document.createElement("dialog");
    d.className = "sheet wide";
    d.setAttribute("aria-labelledby", "pieceTitle");
    d.innerHTML = `
      <form id="pieceForm" novalidate>
        <div class="sheet-head"><h2 id="pieceTitle">${isNew ? "Publicar peça" : "Editar peça"}</h2><button class="icon-btn" type="button" data-cancel aria-label="Fechar">${R.icon("close")}</button></div>
        <div class="sheet-body" style="display:grid;gap:1.5rem">
          <section aria-labelledby="fotosTitle">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
              <h3 id="fotosTitle">Fotos <span class="muted small" id="fotosCount"></span></h3>
              <span class="btn btn-outline btn-sm file-btn">adicionar fotos<input type="file" id="pcFotos" multiple aria-label="Adicionar fotos da peça (até ${MAX_FOTOS})"></span>
            </div>
            <p class="hint">A primeira foto é a capa. Cada foto abre no recorte: enquadre a peça e escolha a proporção.</p>
            <ul class="photo-list" id="fotoList" aria-describedby="fotosTitle"></ul>
            <p class="field-error" id="pcFotos-erro"></p>
          </section>
          <div class="form-grid">
            <div class="field full"><label for="pcTitulo">Nome da peça</label><input class="input" id="pcTitulo" maxlength="90" value="${R.esc(p.titulo)}" placeholder="Ex.: Bota de couro anos 90"></div>
            <div class="field"><label for="pcTipo">Tipo</label><select class="select" id="pcTipo">${R.tipoOptions(p.tipo)}</select></div>
            <div class="field"><label for="pcTam" id="pcTamLabel">${size.label}</label><select class="select" id="pcTam"${size.disabled ? " disabled" : ""}>${size.html}</select></div>
            <div class="field"><label for="pcPreco">Preço (R$)</label><input class="input" id="pcPreco" type="number" min="0" step="0.01" inputmode="decimal" value="${p.preco ?? ""}"></div>
            <div class="field">
              <label class="check" style="min-height:auto;margin-top:1.6rem"><input type="checkbox" id="pcPromo"${emPromo ? " checked" : ""}> Em promoção</label>
            </div>
            <div class="field" id="pcOrigWrap"${emPromo ? "" : " hidden"}><label for="pcOrig">Preço antes da promoção (R$)</label><input class="input" id="pcOrig" type="number" min="0" step="0.01" inputmode="decimal" value="${emPromo ? p.preco_original : ""}"><p class="hint" id="pcOffHint"></p></div>
            <div class="field"><label for="pcCond">Condição</label><select class="select" id="pcCond">${options(V.condicoes, p.condicao)}</select></div>
            <div class="field"><label for="pcEstilo">Estilo</label><input class="input" id="pcEstilo" list="pcEstilos" maxlength="40" value="${R.esc(p.estilo ? R.labelEstilo(p.estilo).toLowerCase() : "")}" placeholder="ex.: anos 90, boho, minimalista" aria-describedby="pcEstilo-dica"><datalist id="pcEstilos"></datalist><p class="hint" id="pcEstilo-dica">Escolha uma sugestão ou escreva o seu.</p></div>
            <div class="field"><label for="pcGenero">Gênero</label><select class="select" id="pcGenero">${options(V.generos, p.genero)}</select></div>
            <div class="field full"><label for="pcDesc">Detalhes</label><textarea class="textarea" id="pcDesc" maxlength="1200" placeholder="Medidas, tecido, marca, detalhes de uso…">${R.esc(p.descricao || "")}</textarea></div>
            <label class="check full"><input type="checkbox" id="pcDisp"${p.disponivel ? " checked" : ""}> Disponível para venda</label>
          </div>
        </div>
        <p class="form-status" id="pcStatus" style="margin:0 1.25rem 1rem"></p>
        <div class="editor-foot">
          <div class="group">
            <button class="btn" type="submit" data-intent="publicado">${isNew ? "Publicar" : p.status === "publicado" ? "Salvar" : "Salvar e publicar"}</button>
            <button class="btn btn-outline" type="submit" data-intent="rascunho">${p.status === "publicado" && !isNew ? "Ocultar (rascunho)" : "Salvar rascunho"}</button>
          </div>
          ${isNew ? "" : '<button class="btn btn-danger" type="button" data-delete>Excluir peça</button>'}
        </div>
      </form>`;
    document.body.appendChild(d);
    const opener = document.activeElement;
    const $ = s => d.querySelector(s);

    estilosSugeridos().then(list => { $("#pcEstilos").innerHTML = list.map(s => `<option value="${R.esc(s)}">`).join(""); });

    /* ---------- fotos ---------- */
    function paintFotos() {
      $("#fotosCount").textContent = `(${fotos.length}/${MAX_FOTOS})`;
      $("#pcFotos").disabled = fotos.length >= MAX_FOTOS;
      $("#fotoList").innerHTML = fotos.length ? fotos.map((f, i) => `
        <li class="photo-item">
          <div class="photo-thumb">${f.preview ? `<img src="${f.preview}" alt="">` : R.img(f.thumb_url || f.url, "")}${i === 0 ? '<span class="photo-cover">capa</span>' : ""}</div>
          <label class="visually-hidden" for="alt-${i}">Descrição da foto ${i + 1}</label>
          <input class="input input-sm" id="alt-${i}" data-alt="${i}" maxlength="240" placeholder="descreva a foto ${i + 1}" value="${R.esc(f.alt || "")}">
          <div class="photo-actions">
            <button class="icon-btn" type="button" data-move="${i}" data-dir="-1" aria-label="Mover foto ${i + 1} para a esquerda"${i === 0 ? " disabled" : ""}>${R.icon("chevronLeft")}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-recrop="${i}">recortar<span class="visually-hidden"> foto ${i + 1}</span></button>
            <button class="btn btn-ghost btn-sm" type="button" data-remove="${i}">remover<span class="visually-hidden"> foto ${i + 1}</span></button>
            <button class="icon-btn" type="button" data-move="${i}" data-dir="1" aria-label="Mover foto ${i + 1} para a direita"${i === fotos.length - 1 ? " disabled" : ""}>${R.icon("chevronRight")}</button>
          </div>
        </li>`).join("") : '<li class="photo-empty">Nenhuma foto ainda. Fotos verticais, com luz natural, funcionam melhor no feed.</li>';
    }
    paintFotos();

    async function addCanvas(source, at = null) {
      const canvas = await R.crop(source, { aspect: 3 / 4, title: "Ajustar foto da peça" });
      if (!canvas) return false;
      const item = { canvas, preview: canvas.toDataURL("image/jpeg", 0.7), alt: "", existing: false };
      if (at === null) fotos.push(item); else fotos.splice(at, 1, item);
      return true;
    }

    $("#pcFotos").addEventListener("change", async e => {
      const files = [...e.target.files].slice(0, MAX_FOTOS - fotos.length);
      e.target.value = "";
      R.fieldError($("#pcFotos"), "");
      for (const file of files) {
        try { R.media.validate(file); await addCanvas(file); }
        catch (err) { R.fieldError($("#pcFotos"), `${file.name}: ${err.message}`); }
      }
      paintFotos();
    });
    $("#fotoList").addEventListener("input", e => {
      const i = e.target.dataset.alt;
      if (i !== undefined) fotos[i].alt = e.target.value;
    });
    $("#fotoList").addEventListener("click", async e => {
      const mv = e.target.closest("[data-move]");
      const rc = e.target.closest("[data-recrop]");
      const rm = e.target.closest("[data-remove]");
      if (mv) {
        const i = Number(mv.dataset.move), j = i + Number(mv.dataset.dir);
        [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
        paintFotos();
        $(`[data-move="${j}"][data-dir="${mv.dataset.dir}"]`)?.focus();
      }
      if (rc) {
        const i = Number(rc.dataset.recrop);
        const f = fotos[i];
        const alt = f.alt;
        try {
          const ok = await addCanvas(f.canvas || f.url, i);
          if (ok) { fotos[i].alt = alt; if (f.existing) removidas.push(f); }
        } catch (err) { R.toast(R.errorMessage(err, "Não foi possível abrir a foto para recorte."), "error"); }
        paintFotos();
      }
      if (rm) {
        const [f] = fotos.splice(Number(rm.dataset.remove), 1);
        if (f.existing) removidas.push(f);
        paintFotos();
      }
    });

    /* ---------- campos dependentes ---------- */
    $("#pcTipo").addEventListener("change", () => {
      const s = sizeField($("#pcTipo").value, $("#pcTam").value);
      $("#pcTamLabel").textContent = s.label;
      $("#pcTam").innerHTML = s.html;
      $("#pcTam").disabled = s.disabled;
    });
    const offHint = () => {
      const a = Number($("#pcOrig").value), b = Number($("#pcPreco").value);
      $("#pcOffHint").textContent = a > b && b > 0 ? `Desconto de ${Math.round((1 - b / a) * 100)}% aparece na peça.` : "";
    };
    $("#pcPromo").addEventListener("change", () => { $("#pcOrigWrap").hidden = !$("#pcPromo").checked; offHint(); });
    $("#pcOrig").addEventListener("input", offHint);
    $("#pcPreco").addEventListener("input", offHint);
    offHint();

    let intent = "publicado";
    d.querySelectorAll("[data-intent]").forEach(b => b.addEventListener("click", () => { intent = b.dataset.intent; }));
    const close = () => d.close();
    d.addEventListener("close", () => { d.remove(); opener?.focus?.(); if (location.hash.includes("/")) history.replaceState(null, "", "#pecas"); });
    $("[data-cancel]").addEventListener("click", close);

    /* ---------- salvar ---------- */
    $("#pieceForm").addEventListener("submit", async e => {
      e.preventDefault();
      const titulo = $("#pcTitulo").value.trim();
      const preco = $("#pcPreco").value === "" ? null : Number($("#pcPreco").value);
      const promo = $("#pcPromo").checked;
      const original = promo && $("#pcOrig").value !== "" ? Number($("#pcOrig").value) : null;
      if (!R.validate([
        [$("#pcFotos"), !fotos.length ? "Adicione pelo menos uma foto da peça." : null],
        [$("#pcTitulo"), titulo.length < 2 ? "Dê um nome à peça." : null],
        [$("#pcPreco"), preco !== null && (isNaN(preco) || preco < 0) ? "Informe um preço válido." : promo && preco === null ? "Informe o preço promocional." : null],
        [$("#pcOrig"), promo && !(original > preco) ? "O preço anterior precisa ser maior que o preço atual." : null]
      ])) return;

      const st = $("#pcStatus");
      const novos = [];
      d.querySelectorAll("button, input, select, textarea").forEach(x => { x.disabled = true; });
      try {
        // envia só as fotos novas (principal + miniatura)
        let n = 0;
        const total = fotos.filter(f => !f.existing).length;
        for (const f of fotos) {
          if (f.existing) continue;
          n += 1;
          R.formStatus(st, `Enviando foto ${n} de ${total}…`);
          const up = await R.media.upload("brechos", f.canvas, { thumb: true });
          Object.assign(f, up);
          novos.push(up.path, up.thumb_path);
        }
        const imagens = fotos.map(f => ({ url: f.url, path: f.path || null, thumb_url: f.thumb_url || null, thumb_path: f.thumb_path || null, alt: (f.alt || "").trim() || null }));
        const capa = imagens[0];
        const payload = {
          titulo, preco, preco_original: original,
          descricao: $("#pcDesc").value.trim() || null,
          tipo: $("#pcTipo").value || null,
          tamanho: $("#pcTam").disabled ? null : ($("#pcTam").value || null),
          condicao: $("#pcCond").value || null,
          estilo: R.normalizarEstilo($("#pcEstilo").value) || null,
          genero: $("#pcGenero").value || null,
          disponivel: $("#pcDisp").checked,
          status: intent,
          imagens,
          imagem_url: capa.url, imagem_path: capa.path, thumb_url: capa.thumb_url, thumb_path: capa.thumb_path, alt_text: capa.alt
        };
        R.formStatus(st, "Salvando…");
        const res = isNew
          ? await R.sb.from("publicacoes").insert({ ...payload, brecho_id: shop.id })
          : await R.sb.from("publicacoes").update(payload).eq("id", p.id);
        if (res.error) throw res.error;
        const lixo = removidas.flatMap(f => [f.path, f.thumb_path]).filter(Boolean);
        if (lixo.length) R.media.remove("brechos", lixo);
        R.toast(intent === "publicado" ? "Peça publicada no feed." : "Peça salva como rascunho.");
        close();
        onSaved?.();
      } catch (err) {
        if (novos.length) R.media.remove("brechos", novos.filter(Boolean));
        fotos.forEach(f => { if (!f.existing) { delete f.url; delete f.path; delete f.thumb_url; delete f.thumb_path; } });
        console.error("[Repeteco] peça:", err);
        R.formStatus(st, R.errorMessage(err, "Não foi possível salvar a peça."), true);
        d.querySelectorAll("button, input, select, textarea").forEach(x => { x.disabled = false; });
        paintFotos();
        $("#pcTam").disabled = sizeField($("#pcTipo").value).disabled;
      }
    });

    $("[data-delete]")?.addEventListener("click", async () => {
      if (!(await D.confirm(`Excluir “${p.titulo}”? As fotos e as curtidas da peça serão removidas.`, { confirmLabel: "Excluir peça" }))) return;
      const { error } = await R.sb.from("publicacoes").delete().eq("id", p.id);
      if (error) return R.toast(R.errorMessage(error), "error");
      const todas = [...fotos, ...removidas].flatMap(f => [f.path, f.thumb_path]).filter(Boolean);
      if (p.imagem_path) todas.push(p.imagem_path);
      R.media.remove("brechos", [...new Set(todas)]);
      R.toast("Peça excluída.");
      close();
      onSaved?.();
    });
    d.showModal();
    $("#pcTitulo").focus();
  };
})();
