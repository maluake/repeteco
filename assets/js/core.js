/* =====================================================
   REPETECO — núcleo compartilhado
   Cliente Supabase, sessão, perfil, utilidades e SEO.
   Exposto como window.R (scripts clássicos, sem build).
   ===================================================== */
(function () {
  const cfg = window.REPETECO_CONFIG || {};
  const R = (window.R = window.R || {});
  const scriptSrc = document.currentScript && document.currentScript.src;
  // Raiz do site calculada a partir deste arquivo (assets/js/core.js),
  // para que páginas em subpastas (dashboard/) gerem links corretos.
  R.root = scriptSrc ? new URL("../../", scriptSrc).href : new URL("./", location.href).href;
  R.url = (path = "") => new URL(path, R.root).href;

  /* ---------- Supabase ---------- */
  if (window.supabase && !R.sb) {
    R.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  if (!R.sb) console.error("[Repeteco] supabase-js não foi carregado.");

  /* ---------- utilidades ---------- */
  R.$ = (sel, root = document) => root.querySelector(sel);
  R.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  R.esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  R.params = () => new URLSearchParams(location.search);
  R.initials = v => (String(v || "R").trim().charAt(0) || "R").toUpperCase();
  R.debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  R.fmt = {
    price: v => (v === null || v === undefined || v === "") ? "" : brl.format(Number(v)),
    date: v => v ? new Date(v).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "",
    shortDate: v => v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—",
    place: (...parts) => parts.filter(Boolean).join(", "),
    count: (n, one, many) => `${n} ${n === 1 ? one : many}`
  };

  // Apenas URLs http(s) entram em src/href vindos do banco.
  R.safeUrl = v => {
    if (!v) return "";
    try {
      const u = new URL(String(v), location.href);
      return ["http:", "https:"].includes(u.protocol) ? u.href : "";
    } catch { return ""; }
  };
  R.instagramUrl = handle => handle ? `https://instagram.com/${encodeURIComponent(String(handle).replace(/^@/, "").trim())}` : "";
  R.whatsappUrl = phone => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 10) return "";
    return `https://wa.me/${digits.length <= 11 ? "55" + digits : digits}`;
  };

  /* ---------- mensagens de erro ---------- */
  const ERROS = [
    [/invalid login credentials/i, "E-mail ou senha incorretos."],
    [/email not confirmed/i, "Confirme seu e-mail antes de entrar. Procure a mensagem do Repeteco na sua caixa de entrada."],
    [/user already registered|already been registered/i, "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha."],
    [/password should be at least|weak password/i, "A senha precisa ter pelo menos 8 caracteres."],
    [/rate limit|too many requests|security purposes/i, "Muitas tentativas seguidas. Aguarde um minuto e tente novamente."],
    [/unable to validate email|invalid email|email address .* is invalid/i, "Este e-mail não parece válido."],
    [/new password should be different/i, "A nova senha precisa ser diferente da atual."],
    [/jwt expired|session.*(missing|expired)|auth session missing/i, "Sua sessão expirou. Entre novamente."],
    [/row-level security|permission denied|42501/i, "Você não tem permissão para fazer isso."],
    [/duplicate key/i, "Esse registro já existe."],
    [/payload too large|exceeded the maximum allowed size/i, "A imagem é grande demais. Use um arquivo menor."],
    [/failed to fetch|networkerror|load failed/i, "Não foi possível conectar. Verifique sua internet e tente de novo."],
    [/relation .* does not exist|could not find the (table|function)|schema cache/i, "O banco ainda não foi atualizado para esta versão do Repeteco (rode a migration v5)."]
  ];
  R.errorMessage = (err, fallback = "Algo deu errado. Tente novamente.") => {
    const raw = typeof err === "string" ? err : (err?.message || err?.error_description || "");
    for (const [re, msg] of ERROS) if (re.test(raw)) return msg;
    // mensagens das nossas próprias funções/triggers já vêm em português
    if (/[ãçéíóúâê]/i.test(raw) && raw.length < 160) return raw;
    return fallback;
  };

  /* ---------- erros de formulário acessíveis ----------
     Cada campo tem um <p class="field-error" id="<id>-erro">.
     O erro é ligado ao campo por aria-describedby. */
  R.fieldError = (input, msg) => {
    if (!input) return;
    const errId = `${input.id}-erro`;
    let el = document.getElementById(errId);
    if (!el) {
      el = document.createElement("p");
      el.className = "field-error";
      el.id = errId;
      input.insertAdjacentElement("afterend", el);
    }
    el.textContent = msg || "";
    const describedBy = new Set((input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean));
    if (msg) { input.setAttribute("aria-invalid", "true"); describedBy.add(errId); }
    else { input.removeAttribute("aria-invalid"); describedBy.delete(errId); }
    describedBy.size ? input.setAttribute("aria-describedby", [...describedBy].join(" ")) : input.removeAttribute("aria-describedby");
  };
  // Valida campos e foca o primeiro inválido. rules: [[input, mensagem|null], ...]
  R.validate = rules => {
    let first = null;
    rules.forEach(([input, msg]) => { R.fieldError(input, msg); if (msg && !first) first = input; });
    first?.focus();
    return !first;
  };
  R.formStatus = (el, msg, isError = false) => {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
    el.setAttribute("role", isError ? "alert" : "status");
  };

  /* ---------- toast (região aria-live) ---------- */
  let toastTimer;
  R.toast = (msg, type = "info") => {
    let region = document.getElementById("toastRegion");
    if (!region) {
      region = document.createElement("div");
      region.id = "toastRegion";
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      region.innerHTML = '<div class="toast"></div>';
      document.body.appendChild(region);
    }
    const el = region.firstElementChild;
    el.textContent = msg;
    el.classList.toggle("is-error", type === "error");
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
  };

  /* ---------- SEO dinâmico ---------- */
  function setMeta(attr, key, value) {
    if (!value) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", value);
  }
  R.seo = ({ title, description, image, type } = {}) => {
    if (title) {
      document.title = `${title} — ${cfg.siteName || "Repeteco"}`;
      setMeta("property", "og:title", title);
    }
    if (description) {
      const d = String(description).replace(/\s+/g, " ").trim().slice(0, 160);
      setMeta("name", "description", d);
      setMeta("property", "og:description", d);
    }
    if (image) setMeta("property", "og:image", R.safeUrl(image));
    if (type) setMeta("property", "og:type", type);
    setMeta("property", "og:url", location.href);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = location.href.split("#")[0];
  };

  /* ---------- ícones (traço, sem emojis) ---------- */
  const ICONS = {
    heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4 7.4 4c2 0 3.4 1.1 4.6 2.7C13.2 5.1 14.6 4 16.6 4c3.5 0 5.8 3.6 4.6 7.1-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
    bookmark: '<path d="M6 3.5h12v17l-6-4.2-6 4.2z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    menu: '<path d="M3.5 7h17M3.5 12h17M3.5 17h17"/>',
    close: '<path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11.2A6.5 6.5 0 0 1 12 3.3a6.5 6.5 0 0 1 6.5 6.5C18.5 15 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    back: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    list: '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-8.5 8.5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'
  };
  R.icon = (name, label) => {
    const a11y = label ? `role="img" aria-label="${R.esc(label)}"` : 'aria-hidden="true"';
    return `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false" ${a11y}>${ICONS[name] || ""}</svg>`;
  };

  /* ---------- imagens com fallback ---------- */
  R.img = (src, alt, { cls = "", sizes = "", eager = false, ratio = "" } = {}) => {
    const url = R.safeUrl(src);
    if (!url) return `<div class="img-fallback ${cls}" role="img" aria-label="${R.esc(alt || "Imagem indisponível")}"><span>${R.esc(R.initials(alt))}</span></div>`;
    return `<img class="${cls}" src="${R.esc(url)}" alt="${R.esc(alt || "")}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${sizes ? ` sizes="${sizes}"` : ""}${ratio ? ` style="aspect-ratio:${ratio}"` : ""} data-fallback>`;
  };
  document.addEventListener("error", e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-fallback")) return;
    const box = document.createElement("div");
    box.className = "img-fallback " + img.className;
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", img.alt ? `${img.alt} (imagem indisponível)` : "Imagem indisponível");
    box.innerHTML = `<span>${R.esc(R.initials(img.alt))}</span>`;
    img.replaceWith(box);
  }, true);

  /* ---------- sessão e perfil ---------- */
  const listeners = new Set();
  const state = { user: null, profile: null, brecho: null, loaded: false };
  R.auth = state;

  async function loadProfile(user) {
    if (!user) { state.profile = null; state.brecho = null; return; }
    let { data, error } = await R.sb.from("profiles")
      .select("id, nome, role, cidade, bio, avatar_url, created_at")
      .eq("id", user.id).maybeSingle();
    if (error) console.warn("[Repeteco] perfil:", error.message);
    if (!data && !error) {
      // Rede de segurança caso o trigger handle_new_user não exista.
      const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "Pessoa";
      const ins = await R.sb.from("profiles").insert({ id: user.id, nome, role: "usuario" })
        .select("id, nome, role, cidade, bio, avatar_url, created_at").maybeSingle();
      data = ins.data;
    }
    state.profile = data || { id: user.id, nome: user.email?.split("@")[0], role: "usuario" };
    const b = await R.sb.from("brechos").select("id, nome, slug, status").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1);
    state.brecho = b.error ? null : (b.data?.[0] || null);
  }

  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }
  R.onAuth = fn => { listeners.add(fn); if (state.loaded) fn(state); return () => listeners.delete(fn); };

  R.displayName = () => state.profile?.nome || state.user?.email?.split("@")[0] || "Você";
  R.isAdmin = () => state.profile?.role === "admin";
  R.hasPanel = () => R.isAdmin() || !!state.brecho;

  R.ready = (async () => {
    if (!R.sb) { state.loaded = true; return state; }
    try {
      const { data } = await R.sb.auth.getSession();
      state.user = data?.session?.user || null;
      await loadProfile(state.user);
    } catch (e) {
      console.warn("[Repeteco] sessão:", e?.message || e);
    }
    state.loaded = true;
    emit();
    R.sb.auth.onAuthStateChange((event, session) => {
      const next = session?.user || null;
      if (event === "PASSWORD_RECOVERY") document.dispatchEvent(new CustomEvent("repeteco:recovery"));
      if (event === "TOKEN_REFRESHED" || (next?.id === state.user?.id && event !== "USER_UPDATED")) { state.user = next; return; }
      state.user = next;
      // Não chamar o Supabase dentro do callback (evita deadlock do auth-js).
      setTimeout(async () => { await loadProfile(next); emit(); }, 0);
    });
    return state;
  })();

  R.refreshProfile = async () => { await loadProfile(state.user); emit(); };

  // Páginas privadas: redireciona para entrar.html?next=<página atual>.
  R.requireAuth = async () => {
    await R.ready;
    if (state.user) return state;
    const next = location.pathname.replace(new URL(R.root).pathname, "") + location.search;
    location.replace(R.url(`entrar.html?next=${encodeURIComponent(next)}`));
    return new Promise(() => {});
  };

  // Só aceita destinos relativos do próprio site (evita open redirect).
  R.safeNext = raw => {
    if (!raw) return R.url("index.html");
    try {
      const u = new URL(raw, R.root);
      return u.origin === location.origin ? u.href : R.url("index.html");
    } catch { return R.url("index.html"); }
  };

  // Eventos para as estatísticas do dono (visita, clique no mapa, contato).
  // Falhas são silenciosas: analytics nunca bloqueia a navegação.
  R.track = async (brechoId, tipo) => {
    if (!R.sb || !brechoId) return;
    await R.ready;
    try {
      await R.sb.from("brecho_eventos").insert({ brecho_id: brechoId, tipo, user_id: state.user?.id || null });
    } catch (e) { console.debug("[Repeteco] evento não registrado:", e?.message); }
  };

  R.signOut = async () => {
    await R.sb?.auth.signOut();
    location.href = R.url("index.html");
  };
})();
