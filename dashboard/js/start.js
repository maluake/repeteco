/* REPETECO — inicialização do painel conforme o papel da conta */
(function () {
  const R = window.R;
  const D = window.D;

  R.requireAuth().then(async state => {
    const admin = R.isAdmin();
    let shop = null;
    try { shop = await D.loadShop(); } catch (e) { console.warn("[Repeteco] brechó:", e.message); }

    if (!admin && !shop) {
      R.$("#panelNav").hidden = true;
      R.$("#view").innerHTML = R.render.state("empty", "Você ainda não tem um painel.",
        "O painel é liberado para quem cadastra um brechó. Envie o cadastro e acompanhe a análise por aqui.",
        `<a class="btn" href="${R.url("cadastro.html")}">Cadastrar meu brechó</a>`);
      return;
    }

    const groups = [];
    if (shop) groups.push({ title: shop.nome, items: ["visao-dono", "pecas", "perfil"] });
    if (admin) groups.push({ title: "Administração", items: ["visao-admin", "solicitacoes", "brechos", "usuarios", "publicacoes", "editorial", "mensagens"] });
    // Admin sem brechó começa pela visão administrativa.
    if (admin && !shop) groups.reverse();
    D.buildNav(groups);
    if (admin) {
      R.sb.rpc("admin_resumo").then(({ data }) => {
        if (!data) return;
        D.badge("solicitacoes", data.brechos_pendentes);
        D.badge("mensagens", data.mensagens_nao_lidas);
      });
    }
    D.go();
  });
})();
