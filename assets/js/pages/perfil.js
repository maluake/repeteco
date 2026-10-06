/* REPETECO — perfil da pessoa logada: dados, foto e senha */
(function () {
  const R = window.R;
  const form = R.$("#profileForm");
  const nome = R.$("#pNome");
  const cidade = R.$("#pCidade");
  const bio = R.$("#pBio");
  const bioCount = R.$("#pBioCount");
  const avatarBox = R.$("#avatarPreview");
  const status = R.$("#profileStatus");
  const saveBtn = R.$("#profileSave");
  let removeAvatar = false;
  let picker;

  function paintAvatar(url, name) {
    avatarBox.innerHTML = url ? `<img src="${R.esc(R.safeUrl(url))}" alt="Sua foto de perfil">` : `<span aria-hidden="true">${R.esc(R.initials(name))}</span>`;
    R.$("#avatarRemove").hidden = !url;
  }

  function fill(state) {
    const p = state.profile || {};
    nome.value = p.nome || "";
    cidade.value = p.cidade || "";
    bio.value = p.bio || "";
    bioCount.textContent = `${bio.value.length}/280`;
    R.$("#pEmail").value = state.user.email || "";
    R.$("#memberSince").textContent = p.created_at ? `No Repeteco desde ${R.fmt.date(p.created_at)}.` : "";
    paintAvatar(p.avatar_url, p.nome);
    R.$("#roleNote").innerHTML = R.isAdmin()
      ? `Você é administradora(or). <a class="link" href="${R.url("dashboard/index.html")}">Abrir o painel</a>.`
      : state.brecho
        ? `Você é responsável pelo brechó <strong>${R.esc(state.brecho.nome)}</strong>. <a class="link" href="${R.url("dashboard/index.html")}">Abrir o painel do brechó</a>.`
        : `Tem um brechó? <a class="link" href="${R.url("cadastro.html")}">Cadastre seu espaço</a>.`;
  }

  async function save(e) {
    e.preventDefault();
    const ok = R.validate([
      [nome, !nome.value.trim() ? "Informe como quer ser chamada(o)." : nome.value.trim().length > 80 ? "Use no máximo 80 caracteres." : null],
      [bio, bio.value.length > 280 ? "A bio pode ter até 280 caracteres." : null]
    ]);
    if (!ok) return;
    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando…";
    R.formStatus(status, "");
    const old = R.auth.profile?.avatar_url || null;
    let avatar_url = old;
    try {
      const file = picker.get();
      if (file) {
        R.formStatus(status, "Enviando foto…");
        avatar_url = (await R.media.upload("avatars", file, { max: 512, quality: 0.85 })).url;
      } else if (removeAvatar) {
        avatar_url = null;
      }
      const payload = { nome: nome.value.trim(), cidade: cidade.value.trim() || null, bio: bio.value.trim() || null, avatar_url };
      const { error } = await R.sb.from("profiles").update(payload).eq("id", R.auth.user.id);
      if (error) throw error;
      if (old && old !== avatar_url) R.media.remove("avatars", old);
      picker.reset();
      removeAvatar = false;
      await R.refreshProfile();
      R.formStatus(status, "Perfil atualizado.");
      R.toast("Perfil atualizado.");
    } catch (err) {
      console.error("[Repeteco] perfil:", err);
      R.formStatus(status, R.errorMessage(err, "Não foi possível salvar o perfil."), true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Salvar alterações";
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    const p1 = R.$("#newPass"), p2 = R.$("#newPass2");
    const st = R.$("#passStatus");
    const ok = R.validate([
      [p1, p1.value.length < 8 ? "A senha precisa ter pelo menos 8 caracteres." : null],
      [p2, p2.value !== p1.value ? "As senhas não coincidem." : null]
    ]);
    if (!ok) return;
    const btn = R.$("#passSave");
    btn.disabled = true;
    const { error } = await R.sb.auth.updateUser({ password: p1.value });
    btn.disabled = false;
    if (error) return R.formStatus(st, R.errorMessage(error), true);
    p1.value = p2.value = "";
    R.formStatus(st, "Senha alterada.");
  }

  bio.addEventListener("input", () => { bioCount.textContent = `${bio.value.length}/280`; });
  R.$("#avatarRemove").addEventListener("click", () => {
    removeAvatar = true;
    picker.reset();
    paintAvatar(null, nome.value);
    R.formStatus(status, "A foto será removida quando você salvar.");
  });
  form.addEventListener("submit", save);
  R.$("#passForm").addEventListener("submit", changePassword);

  R.requireAuth().then(() => {
    picker = R.media.picker(R.$("#avatarFile"), avatarBox, {
      onError: msg => { R.formStatus(status, msg, !!msg); if (!msg) { removeAvatar = false; R.$("#avatarRemove").hidden = false; } }
    });
    R.onAuth(s => s.user && fill(s));
  });
})();
