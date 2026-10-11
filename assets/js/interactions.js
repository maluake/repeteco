/* =====================================================
   REPETECO — curtidas e salvos (persistidos no Supabase)
   Alvos: publicações ("p") e brechós ("b").
   Uso no HTML gerado: R.actionButtons("p", id, {...})
   ===================================================== */
(function () {
  const R = window.R;
  const liked = new Set();
  const saved = new Set();
  const busy = new Set();
  let rows = [];

  // Estado vem da função minhas_interacoes (só a própria conta).
  async function load(state) {
    liked.clear(); saved.clear(); rows = [];
    if (state?.user && R.sb) {
      const { data, error } = await R.sb.rpc("minhas_interacoes");
      if (error) console.warn("[Repeteco] curtidas/salvos:", error.message);
      rows = data || [];
      rows.forEach(r => {
        const key = r.publicacao_id ? `p:${r.publicacao_id}` : `b:${r.brecho_id}`;
        (r.tipo === "curtida" ? liked : saved).add(key);
      });
    }
    sync();
    document.dispatchEvent(new CustomEvent("repeteco:interactions"));
  }

  // Ids das peças/brechós curtidos ou salvos pela conta (para listas).
  async function mine(tipo, kind) {
    await R.ready;
    if (!R.auth.user) return null;
    const { data, error } = await R.sb.rpc("minhas_interacoes");
    if (error) throw error;
    return (data || []).filter(r => r.tipo === tipo && (kind === "p" ? r.publicacao_id : !r.publicacao_id && r.brecho_id))
      .map(r => kind === "p" ? r.publicacao_id : r.brecho_id);
  }

  function sync(root = document) {
    root.querySelectorAll("[data-act]").forEach(btn => {
      const key = `${btn.dataset.kind}:${btn.dataset.id}`;
      const on = (btn.dataset.act === "like" ? liked : saved).has(key);
      setPressed(btn, on);
    });
  }

  function setPressed(btn, on) {
    btn.setAttribute("aria-pressed", String(on));
    const label = btn.dataset.act === "like" ? (on ? "Remover curtida" : "Curtir") : (on ? "Remover dos salvos" : "Salvar");
    const sr = btn.querySelector(".act-label");
    if (sr) sr.textContent = `${label}${btn.dataset.title ? ": " + btn.dataset.title : ""}`;
  }

  function bumpCount(btn, delta) {
    const c = btn.querySelector(".act-n");
    if (!c) return;
    const n = Math.max(0, (parseInt(c.textContent, 10) || 0) + delta);
    c.textContent = String(n);
  }

  async function toggle(btn) {
    const { act, kind, id } = btn.dataset;
    const key = `${kind}:${id}`;
    if (busy.has(act + key)) return;
    await R.ready;
    if (!R.auth.user) {
      const next = encodeURIComponent(location.pathname.replace(new URL(R.root).pathname, "") + location.search);
      R.toast(act === "like" ? "Entre na sua conta para curtir." : "Entre na sua conta para salvar.");
      setTimeout(() => { location.href = R.url(`entrar.html?next=${next}`); }, 900);
      return;
    }
    const set = act === "like" ? liked : saved;
    const wasOn = set.has(key);
    const twins = R.$$(`[data-act="${act}"][data-kind="${kind}"][data-id="${CSS.escape(id)}"]`);

    busy.add(act + key);
    wasOn ? set.delete(key) : set.add(key);
    twins.forEach(b => { setPressed(b, !wasOn); if (act === "like") bumpCount(b, wasOn ? -1 : 1); });

    const { data: nowOn, error } = await R.sb.rpc("alternar_interacao", {
      p_tipo: act === "like" ? "curtida" : "salvo",
      p_publicacao_id: kind === "p" ? id : null,
      p_brecho_id: kind === "b" ? id : null
    });
    busy.delete(act + key);

    if (error) {
      wasOn ? set.add(key) : set.delete(key);
      twins.forEach(b => { setPressed(b, wasOn); if (act === "like") bumpCount(b, wasOn ? 1 : -1); });
      console.error("[Repeteco] curtir/salvar falhou:", error.code, error.message, error.details || "", error.hint || "");
      const fallback = "Não foi possível salvar sua escolha.";
      // PGRST202: a função ainda não existe no banco (falta rodar supabase/v6/1_interacoes_pecas.sql).
      const base = error.code === "PGRST202" ? `${fallback} O banco ainda não tem a função alternar_interacao.` : R.errorMessage(error, fallback);
      R.toast(base === fallback ? `${base} (${error.code || "erro"}: ${error.message})` : base, "error");
      return;
    }
    // O banco é a fonte da verdade: corrige a tela se divergiu.
    if (nowOn === wasOn) {
      nowOn ? set.add(key) : set.delete(key);
      twins.forEach(b => { setPressed(b, nowOn); if (act === "like") bumpCount(b, nowOn ? 1 : -1); });
    }
    R.toast(act === "like" ? (nowOn ? "Curtido." : "Curtida removida.") : (nowOn ? "Salvo. Veja em Salvos." : "Removido dos salvos."));
    document.dispatchEvent(new CustomEvent("repeteco:toggled", { detail: { act, kind, id, on: nowOn } }));
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(btn);
  });

  R.likeButton = (kind, id, { title = "", count = null, variant = "" } = {}) => {
    const t = R.esc(title);
    return `<button type="button" class="act act-like ${variant}" data-act="like" data-kind="${kind}" data-id="${R.esc(id)}" data-title="${t}" aria-pressed="false">
        ${R.icon("heart")}<span class="act-label visually-hidden">Curtir${t ? ": " + t : ""}</span>${count !== null ? `<span class="act-count"><span class="visually-hidden">, curtidas: </span><span class="act-n">${Number(count) || 0}</span></span>` : ""}
      </button>`;
  };
  R.saveButton = (kind, id, { title = "", variant = "" } = {}) => {
    const t = R.esc(title);
    return `<button type="button" class="act act-save ${variant}" data-act="save" data-kind="${kind}" data-id="${R.esc(id)}" data-title="${t}" aria-pressed="false">
        ${R.icon("bookmark")}<span class="act-label visually-hidden">Salvar${t ? ": " + t : ""}</span>
      </button>`;
  };
  R.actionButtons = (kind, id, opts = {}) => R.likeButton(kind, id, opts) + R.saveButton(kind, id, opts);

  R.interactions = { liked, saved, sync, mine, reload: () => load(R.auth) };
  R.onAuth(load);
})();
