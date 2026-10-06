/* REPETECO — definir nova senha a partir do link de recuperação */
(function () {
  const R = window.R;
  const form = R.$("#resetForm");
  const invalid = R.$("#resetInvalid");
  let ready = false;

  function enable() {
    if (ready) return;
    ready = true;
    invalid.hidden = true;
    form.hidden = false;
    R.$("#rpPass").focus();
  }

  document.addEventListener("repeteco:recovery", enable);
  R.ready.then(state => {
    // O Supabase autentica a sessão pelo link; sem sessão, o link expirou.
    if (state.user) enable();
    else setTimeout(() => { if (!ready) invalid.hidden = false; }, 1200);
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const p1 = R.$("#rpPass"), p2 = R.$("#rpPass2"), st = R.$("#resetStatus"), btn = R.$("#resetBtn");
    if (!R.validate([
      [p1, p1.value.length < 8 ? "A senha precisa ter pelo menos 8 caracteres." : null],
      [p2, p1.value !== p2.value ? "As senhas não coincidem." : null]
    ])) return;
    btn.disabled = true;
    const { error } = await R.sb.auth.updateUser({ password: p1.value });
    btn.disabled = false;
    if (error) return R.formStatus(st, R.errorMessage(error), true);
    R.formStatus(st, "Senha atualizada. Redirecionando para o seu perfil…");
    setTimeout(() => { location.href = R.url("perfil.html"); }, 1200);
  });
})();
