/* REPETECO — solicitação de cadastro de brechó
   Fluxo: login obrigatório → insert em brechos (status forçado
   para "pending" pelo banco) → envio opcional da foto de capa. */
(function () {
  const R = window.R;
  const form = R.$("#storeForm");
  const gate = R.$("#storeGate");
  const st = R.$("#storeStatus");
  const btn = R.$("#storeSubmit");
  let picker;

  const STATUS_TXT = {
    pending: ["Sua solicitação está em análise.", "A equipe revisa os cadastros em até 3 dias úteis. Você pode completar as informações pelo painel enquanto isso."],
    approved: ["Seu brechó já está no Repeteco.", "Use o painel para publicar peças, editar o perfil e acompanhar as estatísticas."],
    rejected: ["Sua solicitação precisa de ajustes.", "Revise as informações no painel; ao salvar, o cadastro volta para análise."]
  };

  function renderGate(state) {
    if (!state.user) {
      const next = encodeURIComponent("cadastro.html");
      gate.innerHTML = `
        <h2>Primeiro, entre na sua conta</h2>
        <p class="muted" style="margin-top:.5rem">O brechó fica vinculado à sua conta. Assim só você consegue editar o perfil e publicar peças.</p>
        <div class="hero-actions"><a class="btn" href="${R.url(`entrar.html?modo=cadastro&next=${next}`)}">Criar conta</a><a class="btn btn-outline" href="${R.url(`entrar.html?next=${next}`)}">Já tenho conta</a></div>`;
      gate.hidden = false;
      form.hidden = true;
      return;
    }
    if (state.brecho) {
      const [title, text] = STATUS_TXT[state.brecho.status] || STATUS_TXT.pending;
      gate.innerHTML = `
        <span class="status ${R.esc(state.brecho.status)}">${{ pending: "Em análise", approved: "Aprovado", rejected: "Precisa de ajustes" }[state.brecho.status] || "Em análise"}</span>
        <h2 style="margin-top:.75rem">${title}</h2>
        <p class="muted" style="margin-top:.5rem">${text}</p>
        <div class="hero-actions"><a class="btn" href="${R.url("dashboard/index.html")}">Abrir o painel do ${R.esc(state.brecho.nome)}</a></div>`;
      gate.hidden = false;
      form.hidden = true;
      return;
    }
    gate.hidden = true;
    form.hidden = false;
    const n = R.$("#respNome"), e = R.$("#respEmail");
    if (!n.value) n.value = state.profile?.nome || "";
    if (!e.value) e.value = state.user.email || "";
  }

  R.$("#catGroup").innerHTML = R.vocab.categoriasBrecho.map(c =>
    `<label class="check"><input type="checkbox" name="categorias" value="${R.esc(c)}"> ${R.esc(c[0].toUpperCase() + c.slice(1))}</label>`).join("");

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const v = id => R.$(`#${id}`).value.trim();
    const cats = R.$$('input[name="categorias"]:checked').map(i => i.value);
    const wa = v("respWhats").replace(/\D/g, "");
    if (!R.validate([
      [R.$("#respNome"), !v("respNome") ? "Informe o nome da pessoa responsável." : null],
      [R.$("#respEmail"), !R.$("#respEmail").validity.valid || !v("respEmail") ? "Informe um e-mail válido." : null],
      [R.$("#respWhats"), wa.length < 10 ? "Informe o WhatsApp com DDD." : null],
      [R.$("#lojaNome"), v("lojaNome").length < 2 ? "Informe o nome do espaço." : null],
      [R.$("#lojaBairro"), !v("lojaBairro") ? "Informe o bairro." : null],
      [R.$("#lojaCidade"), !v("lojaCidade") ? "Informe a cidade." : null],
      [R.$("#catFirst"), !cats.length ? "Escolha pelo menos uma categoria." : null]
    ])) return;

    btn.disabled = true;
    btn.textContent = "Enviando…";
    R.formStatus(st, "");
    try {
      const { data, error } = await R.sb.from("brechos").insert({
        user_id: R.auth.user.id,
        nome: v("lojaNome"), descricao: v("lojaDesc") || null, categorias: cats,
        cidade: v("lojaCidade"), bairro: v("lojaBairro"), endereco: v("lojaEndereco") || null,
        nome_responsavel: v("respNome"), email_responsavel: v("respEmail"),
        whatsapp: wa, instagram: v("respInsta").replace(/^@/, "") || null
      }).select("id").single();
      if (error) throw error;

      const file = picker.get();
      if (file) {
        R.formStatus(st, "Cadastro criado. Enviando a foto…");
        try {
          const up = await R.media.upload("brechos", file, { max: 1800 });
          const upd = await R.sb.from("brechos").update({ foto_capa: up.url }).eq("id", data.id);
          if (upd.error) throw upd.error;
        } catch (imgErr) {
          R.toast(`Cadastro enviado, mas a foto não foi salva: ${R.errorMessage(imgErr)} Você pode enviá-la pelo painel.`, "error");
        }
      }
      await R.refreshProfile();
      window.scrollTo({ top: 0 });
      R.$("#storeIntro").focus();
      R.toast("Solicitação enviada para análise.");
    } catch (err) {
      console.error("[Repeteco] cadastro:", err);
      R.formStatus(st, R.errorMessage(err, "Não foi possível enviar o cadastro."), true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Enviar para análise";
    }
  });

  picker = R.media.picker(R.$("#lojaFoto"), R.$("#lojaFotoPreview"), { onError: m => R.fieldError(R.$("#lojaFoto"), m) });
  R.onAuth(renderGate);
})();
