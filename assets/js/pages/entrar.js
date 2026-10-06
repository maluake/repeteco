/* REPETECO — entrar, criar conta e recuperar senha (Supabase Auth) */
(function () {
  const R = window.R;
  const params = R.params();
  const next = R.safeNext(params.get("next"));
  const views = { entrar: R.$("#viewLogin"), criar: R.$("#viewSignup"), recuperar: R.$("#viewForgot"), confirmar: R.$("#viewConfirm") };
  const tabs = R.$$("[role=tab]");
  let pendingEmail = "";

  function show(view, focus = true) {
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== view; });
    tabs.forEach(t => {
      const on = t.dataset.view === view;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    R.$("#authTabs").hidden = view === "confirmar" || view === "recuperar";
    const titles = { entrar: "Entrar", criar: "Criar conta", recuperar: "Recuperar senha", confirmar: "Confirme seu e-mail" };
    R.$("#authTitle").textContent = titles[view];
    R.seo({ title: titles[view] });
    if (focus) views[view].querySelector("input, button")?.focus();
  }

  const setBusy = (btn, busy, label) => { btn.disabled = busy; if (label) btn.textContent = label; };

  // ---------- entrar ----------
  R.$("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = R.$("#loginEmail"), pass = R.$("#loginPass"), st = R.$("#loginStatus"), btn = R.$("#loginBtn");
    R.$("#resendWrap").hidden = true;
    if (!R.validate([
      [email, !email.validity.valid || !email.value ? "Informe um e-mail válido." : null],
      [pass, !pass.value ? "Informe sua senha." : null]
    ])) return;
    setBusy(btn, true, "Entrando…");
    R.formStatus(st, "");
    const { error } = await R.sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    if (error) {
      setBusy(btn, false, "Entrar");
      R.formStatus(st, R.errorMessage(error), true);
      if (/not confirmed/i.test(error.message)) { pendingEmail = email.value.trim(); R.$("#resendWrap").hidden = false; }
      return;
    }
    R.formStatus(st, "Tudo certo. Redirecionando…");
    location.href = next;
  });

  // ---------- criar conta ----------
  R.$("#signupForm").addEventListener("submit", async e => {
    e.preventDefault();
    const nome = R.$("#suNome"), email = R.$("#suEmail"), pass = R.$("#suPass"), terms = R.$("#suTerms"), st = R.$("#signupStatus"), btn = R.$("#signupBtn");
    if (!R.validate([
      [nome, !nome.value.trim() ? "Informe seu nome." : null],
      [email, !email.validity.valid || !email.value ? "Informe um e-mail válido." : null],
      [pass, pass.value.length < 8 ? "A senha precisa ter pelo menos 8 caracteres." : null],
      [terms, !terms.checked ? "Para criar a conta, aceite os termos e a política de privacidade." : null]
    ])) return;
    setBusy(btn, true, "Criando conta…");
    R.formStatus(st, "");
    const { data, error } = await R.sb.auth.signUp({
      email: email.value.trim(),
      password: pass.value,
      options: { data: { nome: nome.value.trim() }, emailRedirectTo: R.url(`entrar.html?confirmado=1&next=${encodeURIComponent(params.get("next") || "perfil.html")}`) }
    });
    setBusy(btn, false, "Criar conta");
    if (error) return R.formStatus(st, R.errorMessage(error), true);
    // Com confirmação ativa, e-mail já cadastrado volta sem identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return R.formStatus(st, "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.", true);
    }
    if (data.session) { location.href = R.safeNext(params.get("next") || "perfil.html"); return; }
    pendingEmail = email.value.trim();
    R.$("#confirmEmail").textContent = pendingEmail;
    show("confirmar");
  });

  // ---------- recuperar senha ----------
  R.$("#forgotForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = R.$("#fgEmail"), st = R.$("#forgotStatus"), btn = R.$("#forgotBtn");
    if (!R.validate([[email, !email.validity.valid || !email.value ? "Informe um e-mail válido." : null]])) return;
    setBusy(btn, true, "Enviando…");
    const { error } = await R.sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: R.url("nova-senha.html") });
    setBusy(btn, false, "Enviar link");
    if (error && !/user not found/i.test(error.message)) return R.formStatus(st, R.errorMessage(error), true);
    // Mensagem neutra: não revela se o e-mail existe.
    R.formStatus(st, "Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Confira também a caixa de spam.");
  });

  async function resend() {
    if (!pendingEmail) return;
    const { error } = await R.sb.auth.resend({ type: "signup", email: pendingEmail, options: { emailRedirectTo: R.url("entrar.html?confirmado=1") } });
    R.toast(error ? R.errorMessage(error) : "Enviamos um novo e-mail de confirmação.", error ? "error" : "info");
  }
  R.$$("[data-resend]").forEach(b => b.addEventListener("click", resend));

  // ---------- navegação entre visões ----------
  tabs.forEach(t => t.addEventListener("click", () => show(t.dataset.view)));
  R.$("#authTabs").addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const cur = tabs.findIndex(t => t.getAttribute("aria-selected") === "true");
    const nxt = tabs[(cur + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    show(nxt.dataset.view, false);
    nxt.focus();
  });
  R.$$("[data-goto]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); show(a.dataset.goto); }));
  R.$$("[data-toggle-pass]").forEach(b => b.addEventListener("click", () => {
    const input = R.$(`#${b.dataset.togglePass}`);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    b.textContent = showing ? "Mostrar" : "Ocultar";
    b.setAttribute("aria-pressed", String(!showing));
  }));

  // ---------- estado inicial ----------
  const initial = params.get("modo") === "cadastro" ? "criar" : params.get("modo") === "recuperar" ? "recuperar" : "entrar";
  show(initial, false);
  if (params.get("confirmado")) R.formStatus(R.$("#loginStatus"), "E-mail confirmado. Agora é só entrar.");
  R.ready.then(state => {
    if (!state.user) return;
    if (params.get("confirmado")) { location.replace(next); return; }
    R.$("#alreadyIn").hidden = false;
    R.$("#alreadyName").textContent = R.displayName();
    R.$("#alreadyNext").href = next;
  });
})();
