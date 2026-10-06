/* =====================================================
   REPETECO — editorial no painel (somente admin; RLS
   em artigos e no bucket "editorial" garante isso).
   ===================================================== */
(function () {
  const R = window.R;
  const D = window.D;

  D.route("editorial", {
    label: "Editorial",
    async render(el, arg) {
      if (arg) return editor(el, arg === "novo" ? null : arg);
      const { data, error } = await R.sb.from("artigos").select("id, slug, titulo, categoria, status, publicado_em, updated_at, autor_nome").order("updated_at", { ascending: false });
      if (error) throw error;
      el.innerHTML = `
        ${D.head("Editorial", "Matérias publicadas aparecem em /editorial. Rascunhos só são visíveis para a administração.", '<a class="btn" href="#editorial/novo">Nova matéria</a>')}
        ${!data.length ? R.render.state("empty", "Nenhuma matéria ainda.", "Escreva a primeira matéria do editorial.", '<a class="btn" href="#editorial/novo">Nova matéria</a>') : `
        <div class="table-wrap"><table class="dtable stack"><thead><tr><th scope="col">Título</th><th scope="col">Categoria</th><th scope="col">Status</th><th scope="col">Atualizada</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead>
        <tbody>${data.map(a => `<tr>
          <td data-label="Título"><strong>${R.esc(a.titulo)}</strong><small>/${R.esc(a.slug)}${a.autor_nome ? ` · ${R.esc(a.autor_nome)}` : ""}</small></td>
          <td data-label="Categoria">${R.esc(R.label("editorial", a.categoria))}</td>
          <td data-label="Status">${D.statusTag(a.status)}${a.publicado_em ? `<small>${R.fmt.shortDate(a.publicado_em)}</small>` : ""}</td>
          <td data-label="Atualizada">${R.fmt.shortDate(a.updated_at)}</td>
          <td class="no-label"><div class="actions">
            <a class="btn btn-ghost btn-sm" href="${R.url(`artigo.html?slug=${encodeURIComponent(a.slug)}`)}">${a.status === "publicado" ? "Ver" : "Pré-visualizar"}</a>
            <a class="btn btn-outline btn-sm" href="#editorial/${a.id}">Editar</a>
          </div></td></tr>`).join("")}</tbody></table></div>`}`;
    }
  });

  async function editor(el, id) {
    let a = { titulo: "", subtitulo: "", conteudo: "", categoria: "moda", status: "rascunho", capa_url: null, capa_path: null, capa_alt: "", slug: "" };
    if (id) {
      const { data, error } = await R.sb.from("artigos").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) { el.innerHTML = R.render.state("empty", "Matéria não encontrada.", "", '<a class="btn" href="#editorial">Voltar</a>'); return; }
      a = data;
    }
    const cats = Object.entries(R.vocab.editorial).map(([v, l]) => `<option value="${v}"${a.categoria === v ? " selected" : ""}>${l}</option>`).join("");
    el.innerHTML = `
      ${D.head(id ? "Editar matéria" : "Nova matéria", id ? `Status atual: ${D.statusLabel(a.status)}.` : "Comece como rascunho; publique quando estiver pronta.", '<a class="btn btn-ghost" href="#editorial">Voltar à lista</a>')}
      <form id="artForm" novalidate>
        <div class="article-editor">
          <div class="panel-card" style="display:grid;gap:1rem">
            <div class="field"><label for="aTitulo">Título</label><input class="input" id="aTitulo" maxlength="140" value="${R.esc(a.titulo)}" required></div>
            <div class="field"><label for="aSub">Subtítulo</label><input class="input" id="aSub" maxlength="240" value="${R.esc(a.subtitulo || "")}"></div>
            <div class="form-grid">
              <div class="field"><label for="aCat">Categoria</label><select class="select" id="aCat">${cats}</select></div>
              <div class="field"><label for="aSlug">Endereço (slug)</label><input class="input" id="aSlug" value="${R.esc(a.slug || "")}" aria-describedby="aSlug-dica" placeholder="gerado a partir do título"><p class="hint" id="aSlug-dica">Usado em artigo.html?slug=…</p></div>
            </div>
            <div class="media-pair">
              <div class="image-preview wide" id="aCapaPreview">${a.capa_url ? R.img(a.capa_url, "Capa atual") : "Sem capa"}</div>
              <div style="display:grid;gap:.75rem">
                <div class="field"><label for="aCapa">Imagem de capa</label><input class="input" id="aCapa" type="file"></div>
                <div class="field"><label for="aAlt">Descrição da capa (texto alternativo)</label><input class="input" id="aAlt" maxlength="240" value="${R.esc(a.capa_alt || "")}"></div>
                ${a.capa_url ? '<button class="btn btn-ghost btn-sm" type="button" id="aCapaRemove" style="justify-self:start">Remover capa</button>' : ""}
              </div>
            </div>
            <div class="field">
              <label for="aConteudo">Texto</label>
              <textarea class="textarea content" id="aConteudo" aria-describedby="aConteudo-dica">${R.esc(a.conteudo || "")}</textarea>
              <p class="hint" id="aConteudo-dica">Separe parágrafos com uma linha em branco. Use “## ” para intertítulos, “> ” para citação, “- ” para listas, **negrito**, *itálico* e [texto](https://link).</p>
            </div>
          </div>
          <section class="preview panel-card" aria-label="Pré-visualização">
            <span class="eyebrow">Pré-visualização</span>
            <h2 id="pvTitle" style="margin-top:.5rem"></h2>
            <p class="lede" id="pvSub"></p>
            <div class="article-body" id="pvBody"></div>
          </section>
        </div>
        <p class="form-status" id="aStatus" style="margin-top:1rem"></p>
        <div class="editor-foot" style="margin-top:1rem">
          <div class="group">
            <button class="btn btn-outline" type="submit" data-intent="rascunho">${a.status === "publicado" ? "Despublicar e salvar como rascunho" : "Salvar rascunho"}</button>
            <button class="btn" type="submit" data-intent="publicado">${a.status === "publicado" ? "Salvar e manter publicada" : "Publicar"}</button>
          </div>
          ${id ? '<button class="btn btn-danger" type="button" id="aDelete">Excluir matéria</button>' : ""}
        </div>
      </form>`;

    const $ = s => el.querySelector(s);
    const preview = () => {
      $("#pvTitle").textContent = $("#aTitulo").value || "Título da matéria";
      $("#pvSub").textContent = $("#aSub").value;
      $("#pvBody").innerHTML = R.render.articleHtml($("#aConteudo").value) || '<p class="muted">O texto aparece aqui.</p>';
    };
    preview();
    ["#aTitulo", "#aSub", "#aConteudo"].forEach(s => $(s).addEventListener("input", R.debounce(preview, 120)));

    let removeCapa = false;
    const picker = R.media.picker($("#aCapa"), $("#aCapaPreview"), { onError: m => R.fieldError($("#aCapa"), m) });
    $("#aCapaRemove")?.addEventListener("click", () => { removeCapa = true; picker.reset(); $("#aCapaPreview").textContent = "Sem capa"; });

    let intent = "rascunho";
    el.querySelectorAll("[data-intent]").forEach(b => b.addEventListener("click", () => { intent = b.dataset.intent; }));

    $("#artForm").addEventListener("submit", async e => {
      e.preventDefault();
      const st = $("#aStatus");
      const titulo = $("#aTitulo").value.trim();
      if (!R.validate([
        [$("#aTitulo"), titulo.length < 3 ? "O título precisa ter pelo menos 3 caracteres." : null],
        [$("#aConteudo"), intent === "publicado" && $("#aConteudo").value.trim().length < 20 ? "Escreva o texto antes de publicar." : null],
        [$("#aAlt"), intent === "publicado" && (picker.get() || (a.capa_url && !removeCapa)) && !$("#aAlt").value.trim() ? "Descreva a capa para quem usa leitor de tela." : null]
      ])) return;
      const buttons = el.querySelectorAll("button");
      buttons.forEach(b => { b.disabled = true; });
      R.formStatus(st, "Salvando…");
      try {
        let capa_url = removeCapa ? null : a.capa_url;
        let capa_path = removeCapa ? null : a.capa_path;
        const file = picker.get();
        if (file) {
          R.formStatus(st, "Enviando a capa…");
          const up = await R.media.upload("editorial", file, { max: 2000 });
          capa_url = up.url; capa_path = up.path;
        }
        const payload = {
          titulo, subtitulo: $("#aSub").value.trim() || null, categoria: $("#aCat").value,
          conteudo: $("#aConteudo").value, capa_url, capa_path, capa_alt: $("#aAlt").value.trim() || null,
          status: intent, slug: $("#aSlug").value.trim() || null
        };
        // Ao republicar depois de despublicar, a data volta a ser a de agora.
        if (intent === "publicado" && a.status !== "publicado") payload.publicado_em = new Date().toISOString();
        const res = id
          ? await R.sb.from("artigos").update(payload).eq("id", id).select("id, slug").single()
          : await R.sb.from("artigos").insert(payload).select("id, slug").single();
        if (res.error) throw res.error;
        if (a.capa_path && a.capa_path !== capa_path) R.media.remove("editorial", a.capa_path);
        R.toast(intent === "publicado" ? "Matéria publicada." : "Rascunho salvo.");
        D.navigate(`editorial/${res.data.id}`);
      } catch (err) {
        console.error("[Repeteco] editorial:", err);
        R.formStatus(st, R.errorMessage(err, "Não foi possível salvar a matéria."), true);
        buttons.forEach(b => { b.disabled = false; });
      }
    });

    $("#aDelete")?.addEventListener("click", async () => {
      if (!(await D.confirm(`Excluir “${a.titulo}”? A matéria sai do ar e não pode ser recuperada.`, { confirmLabel: "Excluir matéria" }))) return;
      const { error } = await R.sb.from("artigos").delete().eq("id", id);
      if (error) return R.toast(R.errorMessage(error), "error");
      if (a.capa_path) R.media.remove("editorial", a.capa_path);
      R.toast("Matéria excluída.");
      D.navigate("editorial");
    });
  }
})();
