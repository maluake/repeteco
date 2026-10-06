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
  const col = kind => kind === "p" ? "publicacao_id" : "brecho_id";

  async function load(state) {
    liked.clear(); saved.clear();
    if (state?.user && R.sb) {
      const [l, s] = await Promise.all([
        R.sb.from("curtidas").select("brecho_id, publicacao_id").eq("user_id", state.user.id),
        R.sb.from("salvos").select("brecho_id, publicacao_id").eq("user_id", state.user.id)
      ]);
      const add = (set, rows) => (rows || []).forEach(r => set.add(r.publicacao_id ? `p:${r.publicacao_id}` : `b:${r.brecho_id}`));
      if (!l.error) add(liked, l.data); else console.warn("[Repeteco] curtidas:", l.error.message);
      if (!s.error) add(saved, s.data); else console.warn("[Repeteco] salvos:", s.error.message);
    }
    sync();
    document.dispatchEvent(new CustomEvent("repeteco:interactions"));
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
    const table = act === "like" ? "curtidas" : "salvos";
    const wasOn = set.has(key);
    const twins = R.$$(`[data-act="${act}"][data-kind="${kind}"][data-id="${CSS.escape(id)}"]`);

    busy.add(act + key);
    wasOn ? set.delete(key) : set.add(key);
    twins.forEach(b => { setPressed(b, !wasOn); if (act === "like") bumpCount(b, wasOn ? -1 : 1); });

    const req = wasOn
      ? R.sb.from(table).delete().eq("user_id", R.auth.user.id).eq(col(kind), id)
      : R.sb.from(table).insert({ user_id: R.auth.user.id, [col(kind)]: id });
    const { error } = await req;
    busy.delete(act + key);

    if (error && !/duplicate key/i.test(error.message)) {
      wasOn ? set.add(key) : set.delete(key);
      twins.forEach(b => { setPressed(b, wasOn); if (act === "like") bumpCount(b, wasOn ? 1 : -1); });
      R.toast(R.errorMessage(error, "Não foi possível salvar sua escolha."), "error");
      return;
    }
    R.toast(act === "like" ? (wasOn ? "Curtida removida." : "Curtido.") : (wasOn ? "Removido dos salvos." : "Salvo. Veja em Salvos."));
    document.dispatchEvent(new CustomEvent("repeteco:toggled", { detail: { act, kind, id, on: !wasOn } }));
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(btn);
  });

  R.actionButtons = (kind, id, { title = "", count = null, variant = "" } = {}) => {
    const t = R.esc(title);
    const like = `<button type="button" class="act act-like ${variant}" data-act="like" data-kind="${kind}" data-id="${R.esc(id)}" data-title="${t}" aria-pressed="false">
        ${R.icon("heart")}<span class="act-label visually-hidden">Curtir${t ? ": " + t : ""}</span>${count !== null ? `<span class="act-count"><span class="visually-hidden">, curtidas: </span><span class="act-n">${Number(count) || 0}</span></span>` : ""}
      </button>`;
    const save = `<button type="button" class="act act-save ${variant}" data-act="save" data-kind="${kind}" data-id="${R.esc(id)}" data-title="${t}" aria-pressed="false">
        ${R.icon("bookmark")}<span class="act-label visually-hidden">Salvar${t ? ": " + t : ""}</span>
      </button>`;
    return like + save;
  };

  R.interactions = { liked, saved, sync, reload: () => load(R.auth) };
  R.onAuth(load);
})();
