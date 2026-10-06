/* =====================================================
   REPETECO — cabeçalho e rodapé compartilhados
   Uma única fonte para a navegação de todas as páginas.
   A página indica sua seção com <body data-page="...">.
   ===================================================== */
(function () {
  const R = window.R;
  const u = R.url;

  const NAV = [
    { id: "home", href: "index.html", label: "Início" },
    { id: "feed", href: "feed.html", label: "Feed" },
    { id: "brechos", href: "brechos.html", label: "Brechós e mapa" },
    { id: "editorial", href: "editorial.html", label: "Editorial" }
  ];

  const FOOTER = [
    { title: "Explorar", links: [
      ["feed.html", "Feed de peças"], ["brechos.html", "Brechós e mapa"], ["busca.html", "Busca com filtros"],
      ["editorial.html", "Editorial"], ["salvos.html", "Meus salvos"]
    ] },
    { title: "O Repeteco", links: [
      ["sobre.html", "Sobre o Repeteco"], ["como-funciona.html", "Como funciona"],
      ["sustentabilidade.html", "Sustentabilidade"], ["cadastro.html", "Divulgar meu brechó"]
    ] },
    { title: "Ajuda e políticas", links: [
      ["contato.html", "Contato"], ["acessibilidade.html", "Acessibilidade"],
      ["termos.html", "Termos de uso"], ["privacidade.html", "Política de privacidade"]
    ] }
  ];

  const page = document.body.dataset.page || "";

  function renderHeader() {
    const host = document.getElementById("site-header");
    if (!host) return;
    host.className = "site-header";
    host.innerHTML = `
      <div class="wrap header-inner">
        <a class="logo" href="${u("index.html")}">re<span>pé</span>teco<span class="visually-hidden">, página inicial</span></a>
        <nav class="main-nav" id="mainNav" aria-label="Principal">
          <ul>
            ${NAV.map(n => `<li><a class="nav-link" href="${u(n.href)}"${n.id === page ? ' aria-current="page"' : ""}>${n.label}</a></li>`).join("")}
          </ul>
        </nav>
        <div class="header-actions">
          <a class="header-search" href="${u("busca.html")}"${page === "busca" ? ' aria-current="page"' : ""}>${R.icon("search")}<span class="label-text">Busca</span><span class="visually-hidden"> (peças e brechós)</span></a>
          <div id="headerAccount" class="user-menu"></div>
          <button class="icon-btn menu-toggle" id="menuToggle" type="button" aria-controls="mainNav" aria-expanded="false">
            ${R.icon("menu")}<span class="visually-hidden">Abrir menu</span>
          </button>
        </div>
      </div>`;

    const toggle = R.$("#menuToggle");
    const nav = R.$("#mainNav");
    const setMenu = open => {
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.innerHTML = `${R.icon(open ? "close" : "menu")}<span class="visually-hidden">${open ? "Fechar menu" : "Abrir menu"}</span>`;
    };
    toggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
    });
    matchMedia("(min-width: 52.01rem)").addEventListener?.("change", e => e.matches && setMenu(false));
  }

  function renderAccount(state) {
    const host = document.getElementById("headerAccount");
    if (!host) return;
    if (!state.user) {
      const next = encodeURIComponent(location.pathname.replace(new URL(R.root).pathname, "") + location.search);
      const onAuthPage = page === "entrar";
      host.innerHTML = `<a class="header-link" href="${u("entrar.html" + (onAuthPage ? "" : `?next=${next}`))}">${R.icon("user")}<span class="hide-mobile">Entrar</span><span class="visually-hidden"> ou criar conta</span></a>`;
      return;
    }
    const nome = R.displayName();
    const avatar = state.profile?.avatar_url ? `<img src="${R.esc(R.safeUrl(state.profile.avatar_url))}" alt="">` : R.esc(R.initials(nome));
    const panelLink = R.isAdmin()
      ? `<a href="${u("dashboard/index.html")}">Painel administrativo</a>`
      : state.brecho ? `<a href="${u("dashboard/index.html")}">Painel do meu brechó</a>`
      : `<a href="${u("cadastro.html")}">Divulgar meu brechó</a>`;
    host.innerHTML = `
      <button class="header-link" id="accountBtn" type="button" aria-expanded="false" aria-controls="accountPanel">
        <span class="avatar">${avatar}</span><span class="hide-mobile">${R.esc(nome.split(" ")[0])}</span>
        <span class="visually-hidden">Abrir menu da conta</span>
      </button>
      <div class="user-menu-panel" id="accountPanel" hidden>
        <div class="who"><strong>${R.esc(nome)}</strong><span>${R.esc(state.user.email || "")}</span></div>
        <a href="${u("perfil.html")}">Meu perfil</a>
        <a href="${u("salvos.html")}">Salvos e curtidos</a>
        ${panelLink}
        <hr>
        <button type="button" data-open-a11y>Acessibilidade</button>
        <button type="button" id="signOutBtn">Sair da conta</button>
      </div>`;
    const btn = R.$("#accountBtn");
    const panel = R.$("#accountPanel");
    const close = (focus) => { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); if (focus) btn.focus(); };
    btn.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector("a")?.focus();
    });
    panel.addEventListener("keydown", e => { if (e.key === "Escape") close(true); });
    R.$("#signOutBtn").addEventListener("click", R.signOut);
  }

  document.addEventListener("click", e => {
    const host = document.getElementById("headerAccount");
    const panel = document.getElementById("accountPanel");
    if (panel && !panel.hidden && !host.contains(e.target)) {
      panel.hidden = true;
      R.$("#accountBtn")?.setAttribute("aria-expanded", "false");
    }
  });

  function renderFooter() {
    const host = document.getElementById("site-footer");
    if (!host) return;
    host.className = "site-footer";
    const year = new Date().getFullYear();
    host.innerHTML = `
      <div class="wrap footer-top">
        <div class="footer-brand">
          <a class="logo" href="${u("index.html")}">re<span>pé</span>teco</a>
          <p>Curadoria de brechós, sebos e antiquários de São Paulo. Moda que já teve uma história e ainda tem muitas pela frente.</p>
        </div>
        ${FOOTER.map(col => `
          <nav class="footer-col" aria-label="${col.title}">
            <h2>${col.title}</h2>
            <ul>${col.links.map(([href, label]) => `<li><a href="${u(href)}">${label}</a></li>`).join("")}</ul>
          </nav>`).join("")}
      </div>
      <div class="wrap footer-bottom">
        <span>© ${year} Repeteco · Brechós de São Paulo</span>
        <button class="footer-a11y-btn" type="button" data-open-a11y>Ajustes de acessibilidade</button>
      </div>`;
  }

  function skipLink() {
    if (document.querySelector(".skip-link")) return;
    const a = document.createElement("a");
    a.className = "skip-link";
    a.href = "#conteudo";
    a.textContent = "Pular para o conteúdo";
    document.body.prepend(a);
  }

  skipLink();
  renderHeader();
  renderFooter();
  R.onAuth(renderAccount);
})();
