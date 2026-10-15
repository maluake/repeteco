/* REPETECO — formulário de contato (grava na tabela contatos) */
(function () {
  const R = window.R;
  const form = R.$("#contactForm");
  const nome = R.$("#ctNome"), email = R.$("#ctEmail"), assunto = R.$("#ctAssunto"), msg = R.$("#ctMensagem");
  const st = R.$("#contactStatus"), btn = R.$("#contactBtn");

  const pre = R.params().get("assunto");
  if (pre && [...assunto.options].some(o => o.value === pre)) assunto.value = pre;

  R.ready.then(state => {
    if (!state.user) return;
    if (!nome.value) nome.value = R.displayName();
    if (!email.value) email.value = state.user.email || "";
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!R.validate([
      [nome, nome.value.trim().length < 2 ? "Informe seu nome." : null],
      [email, !email.value || !email.validity.valid ? "Informe um e-mail válido para a resposta." : null],
      [msg, msg.value.trim().length < 10 ? "Escreva a mensagem (mínimo de 10 caracteres)." : null]
    ])) return;
    btn.disabled = true;
    btn.textContent = "Enviando…";
    const { error } = await R.sb.from("contatos").insert({
      nome: nome.value.trim(), email: email.value.trim(), assunto: assunto.value,
      mensagem: msg.value.trim(), user_id: R.auth.user?.id || null
    });
    btn.disabled = false;
    btn.textContent = "Enviar mensagem";
    if (error) return R.formStatus(st, R.errorMessage(error, "Não foi possível enviar agora. Tente novamente em instantes."), true);
    msg.value = "";
    R.formStatus(st, "Mensagem enviada. Respondemos pelo e-mail informado em até 5 dias úteis.");
    st.focus?.();
  });
})();
