/* REPETECO — página de um evento (?e=slug) + formulário de interesse em parceria.
   O formulário grava em evento_parcerias; a RLS só aceita o envio se o evento
   estiver publicado, aceitar parcerias e ainda não tiver terminado. */
(function () {
  const R = window.R;
  const root = R.$("#eventRoot");
  const key = R.params().get("e") || "";

  function notFound() {
    R.seo({ title: "Evento não encontrado" });
    root.innerHTML = `<div class="wrap">${R.render.state("empty", "Evento não encontrado.", "Ele pode ter sido removido ou o endereço mudou.", `<a class="btn" href="${R.url("eventos.html")}">Ver a agenda</a>`)}</div>`;
  }

  function partnershipForm(e) {
    const tipos = Object.entries(R.vocab.parcerias).map(([v, l]) => `<option value="${v}">${R.esc(l)}</option>`).join("");
    return `
      <section class="wrap-narrow" aria-labelledby="parTitle" style="padding-bottom:3.5rem">
        <form id="partnerForm" class="card card-pad" novalidate style="display:grid;gap:1rem">
          <div>
            <h2 id="parTitle">Quer participar como parceira(o)?</h2>
            <p class="muted" style="margin-top:.35rem">Brechós expositores, apoio de espaço ou estrutura, patrocínio, divulgação ou voluntariado. A equipe do Repeteco recebe o seu contato e responde por e-mail.</p>
          </div>
          <div class="form-grid">
            <div class="field"><label for="parNome">Nome ou empresa</label><input class="input" id="parNome" maxlength="80" autocomplete="name" required></div>
            <div class="field"><label for="parEmail">E-mail</label><input class="input" id="parEmail" type="email" maxlength="160" autocomplete="email" required></div>
            <div class="field"><label for="parTel">Telefone ou WhatsApp (opcional)</label><input class="input" id="parTel" type="tel" maxlength="30" autocomplete="tel" inputmode="tel"></div>
            <div class="field"><label for="parTipo">Como quer participar</label><select class="select" id="parTipo">${tipos}</select></div>
            <div class="field full"><label for="parMsg">Conte um pouco da proposta</label><textarea class="textarea" id="parMsg" maxlength="2000" rows="4"></textarea></div>
          </div>
          <p class="small muted" id="parBrecho" hidden></p>
          <p class="small muted">Usamos esses dados só para conversar sobre este evento. Veja a <a class="link" href="${R.url("privacidade.html")}">política de privacidade</a>.</p>
          <p class="form-status" id="parStatus" tabindex="-1"></p>
          <div><button class="btn" type="submit" id="parBtn">enviar interesse</button></div>
        </form>
      </section>`;
  }

  function bindPartnership(e) {
    const form = R.$("#partnerForm");
    if (!form) return;
    const fill = s => {
      if (!s.user) return;
      if (!R.$("#parNome").value) R.$("#parNome").value = s.brecho?.nome || s.profile?.nome || "";
      if (!R.$("#parEmail").value) R.$("#parEmail").value = s.user.email || "";
      if (s.brecho?.status === "approved") {
        R.$("#parBrecho").hidden = false;
        R.$("#parBrecho").textContent = `O interesse fica ligado ao brechó ${s.brecho.nome}.`;
      }
    };
    R.onAuth(fill);
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      const nome = R.$("#parNome").value.trim(), email = R.$("#parEmail").value.trim();
      if (!R.validate([
        [R.$("#parNome"), nome.length < 2 ? "Informe seu nome ou o da empresa." : null],
        [R.$("#parEmail"), !email || !R.$("#parEmail").validity.valid ? "Informe um e-mail válido." : null]
      ])) return;
      const btn = R.$("#parBtn"), st = R.$("#parStatus");
      btn.disabled = true;
      R.formStatus(st, "Enviando…");
      const s = R.auth;
      const { error } = await R.sb.from("evento_parcerias").insert({
        evento_id: e.id, nome, email,
        telefone: R.$("#parTel").value.trim() || null,
        tipo: R.$("#parTipo").value,
        mensagem: R.$("#parMsg").value.trim() || null,
        user_id: s.user?.id || null,
        brecho_id: s.brecho?.status === "approved" ? s.brecho.id : null
      });
      btn.disabled = false;
      if (error) {
        console.error("[Repeteco] parceria:", error);
        R.formStatus(st, R.errorMessage(error, "Não foi possível enviar. Este evento pode não estar mais recebendo parcerias."), true);
        return;
      }
      form.reset();
      fill(R.auth);
      R.formStatus(st, "Recebemos seu interesse. A equipe vai responder pelo e-mail informado.");
      st.focus();
    });
  }

  async function run() {
    if (!key) return notFound();
    const isUuid = /^[0-9a-f-]{36}$/i.test(key);
    // Rascunhos só aparecem para a equipe (RLS), como pré-visualização.
    const { data: e, error } = await R.sb.from("eventos").select("*").eq(isUuid ? "id" : "slug", key).maybeSingle();
    if (error) { root.innerHTML = `<div class="wrap">${R.render.state("error", "Não conseguimos abrir o evento.", R.errorMessage(error))}</div>`; return; }
    if (!e) return notFound();

    const fim = new Date(e.data_fim || e.data_inicio);
    const past = fim < new Date();
    const link = R.safeUrl(e.link);
    const endereco = [e.endereco, e.bairro, e.cidade].filter(Boolean).join(", ");
    const mapa = endereco && e.formato !== "online" ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(endereco)}` : "";
    const aceita = e.aceita_parcerias && !past && e.status === "publicado";
    R.seo({ title: e.titulo, description: e.resumo || String(e.descricao || "").slice(0, 160), image: e.capa_url });

    root.innerHTML = `
      ${e.status !== "publicado" ? '<p class="form-status wrap" role="status" style="margin-top:1rem">Pré-visualização: este evento é um rascunho e não aparece na agenda.</p>' : ""}
      <nav class="wrap breadcrumb" aria-label="Você está em"><ol><li><a href="${R.url("eventos.html")}">Eventos</a></li><li aria-current="page">${R.esc(e.titulo)}</li></ol></nav>
      <article>
        <div class="wrap event-hero">
          <div>
            <p class="eyebrow">${R.esc(R.label("formatosEvento", e.formato))}${past ? " · já aconteceu" : ""}</p>
            <h1>${R.esc(e.titulo)}</h1>
            ${e.resumo ? `<p class="lede" style="margin-top:.5rem">${R.esc(e.resumo)}</p>` : ""}
            <div class="event-facts">
              <div>${R.icon("calendar")}<span><time datetime="${R.esc(e.data_inicio)}">${R.esc(R.fmt.when(e.data_inicio))}</time>${e.data_fim ? ` até <time datetime="${R.esc(e.data_fim)}">${R.esc(R.fmt.when(e.data_fim))}</time>` : ""}</span></div>
              ${e.formato !== "online" ? `<div>${R.icon("pin")}<span>${R.esc([e.local_nome, endereco].filter(Boolean).join(" — ") || "Local a confirmar")}</span></div>` : ""}
              ${e.formato !== "presencial" ? `<div>${R.icon("globe")}<span>${link ? "Transmissão online pelo link abaixo" : "Link da transmissão será divulgado"}</span></div>` : ""}
            </div>
            <div class="cta-btns" style="margin-top:1.25rem">
              ${link && !past ? `<a class="btn" href="${R.esc(link)}" target="_blank" rel="noopener">${e.formato === "presencial" ? "inscrição e informações" : "acessar evento online"}<span class="visually-hidden"> (abre em nova aba)</span></a>` : ""}
              ${mapa ? `<a class="btn btn-outline" href="${mapa}" target="_blank" rel="noopener">${R.icon("pin")} como chegar<span class="visually-hidden"> no OpenStreetMap (nova aba)</span></a>` : ""}
              ${aceita ? '<a class="btn btn-ghost" href="#parTitle">quero ser parceira(o)</a>' : ""}
            </div>
          </div>
          ${e.capa_url ? `<figure class="event-cover" style="margin:0">${R.img(e.capa_url, e.capa_alt || "", { eager: true })}</figure>` : ""}
        </div>
        ${e.descricao ? `<div class="wrap-narrow article-body" style="padding-bottom:2.5rem">${R.render.articleHtml(e.descricao)}</div>` : ""}
      </article>
      ${aceita ? partnershipForm(e) : `<p class="wrap-narrow muted" style="padding-bottom:3rem">${past ? "Este evento já aconteceu." : "Este evento não está recebendo parcerias."} Quer propor algo para os próximos? <a class="link" href="${R.url("contato.html?assunto=parceria")}">Fale com a equipe</a>.</p>`}`;
    if (aceita) bindPartnership(e);
  }

  if (!R.sb) { root.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  run();
})();
