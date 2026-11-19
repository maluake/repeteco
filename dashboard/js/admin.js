/* =====================================================
   REPETECO — painel administrativo
   Toda permissão é verificada no banco (RLS + funções
   admin_*). O frontend só esconde o que não se aplica.
   ===================================================== */
(function () {
  const R = window.R;
  const D = window.D;
  const fmtPlace = b => R.fmt.place(b.bairro, b.cidade) || "Localização não informada";

  /* ---------- visão geral ---------- */
  D.route("visao-admin", {
    label: "Visão geral",
    async render(el) {
      const { data: s, error } = await R.sb.rpc("admin_resumo");
      if (error) throw error;
      D.badge("solicitacoes", s.brechos_pendentes);
      D.badge("mensagens", s.mensagens_nao_lidas);
      const weeks = s.semanas || [];
      const series = key => weeks.map(w => ({ label: `sem. ${D.dayLabel(w.semana)}`, value: Number(w[key]) || 0 }));
      el.innerHTML = `
        ${D.head("Visão geral", "Números calculados no banco a partir dos dados reais da plataforma.")}
        ${D.stats([
          { label: "Pessoas cadastradas", value: s.usuarios, note: `${R.fmt.count(Number(s.donos), "dono", "donos")} · ${R.fmt.count(Number(s.admins), "admin", "admins")}`, href: "#usuarios" },
          { label: "Brechós aprovados", value: s.brechos_aprovados, note: s.brechos_online !== undefined ? `${s.brechos_online} com venda online` : "", href: "#brechos" },
          { label: "Aguardando análise", value: s.brechos_pendentes, href: "#solicitacoes" },
          { label: "Peças publicadas", value: s.publicacoes, note: s.promocoes !== undefined ? `${s.promocoes} em promoção` : "", href: "#publicacoes" },
          { label: "Matérias publicadas", value: s.artigos_publicados, note: `${s.artigos_rascunho} em rascunho`, href: "#editorial" },
          { label: "Curtidas e salvos", value: Number(s.curtidas) + Number(s.salvos), note: `${s.curtidas} curtidas · ${s.salvos} salvos` },
          { label: "Visitas a brechós", value: s.visitas_30d, note: "últimos 30 dias" },
          { label: "Mensagens não lidas", value: s.mensagens_nao_lidas, href: "#mensagens" },
          ...(s.eventos_proximos !== undefined ? [
            { label: "Próximos eventos", value: s.eventos_proximos, href: "#eventos" },
            { label: "Parcerias novas", value: s.parcerias_novas, note: "pedidos aguardando resposta", href: "#parcerias" }
          ] : [])
        ])}
        <h2 style="font-size:1.4rem;margin-bottom:1.25rem">Crescimento nas últimas 12 semanas</h2>
        <div class="charts quad">
          ${D.bars({ title: "Novas contas", points: series("usuarios"), unit: "contas" })}
          ${D.bars({ title: "Novos cadastros de brechó", points: series("brechos"), unit: "cadastros" })}
          ${D.bars({ title: "Peças publicadas", points: series("publicacoes"), unit: "peças" })}
          ${D.bars({ title: "Curtidas e salvos", points: series("interacoes"), unit: "interações" })}
        </div>
        ${s.brechos_sem_localizacao ? `<p class="banner pending"><span><strong>${s.brechos_sem_localizacao}</strong> brechó(s) aprovado(s) ainda sem posição no mapa. O dono ajusta isso em “Perfil do brechó”.</span></p>` : ""}`;
    }
  });

  /* ---------- solicitações ---------- */
  D.route("solicitacoes", {
    label: "Solicitações",
    async render(el, selectedId) {
      const filtro = sessionStorage.getItem("rp-fila") || "pending";
      const { data, error } = await R.sb.from("brechos").select("*").eq("status", filtro).order("created_at", { ascending: true });
      if (error) throw error;
      if (filtro === "pending") D.badge("solicitacoes", data.length);
      const sel = data.find(b => String(b.id) === selectedId) || data[0];
      el.innerHTML = `
        ${D.head("Solicitações de cadastro", "Revise os dados antes de publicar. Ao aprovar, o responsável ganha acesso ao painel do brechó.")}
        <div class="toolbar" role="group" aria-label="Mostrar">
          <button class="btn btn-sm ${filtro === "pending" ? "" : "btn-outline"}" type="button" data-fila="pending" aria-pressed="${filtro === "pending"}">Em análise</button>
          <button class="btn btn-sm ${filtro === "rejected" ? "" : "btn-outline"}" type="button" data-fila="rejected" aria-pressed="${filtro === "rejected"}">Recusados</button>
        </div>
        ${!data.length ? R.render.state("empty", filtro === "pending" ? "Nenhuma solicitação pendente." : "Nenhum cadastro recusado.", "Novos cadastros aparecem aqui assim que são enviados.") : `
        <div class="queue">
          <ul class="queue-list" aria-label="Cadastros">
            ${data.map(b => `<li><button type="button" data-open="${R.esc(b.id)}" aria-current="${b.id === sel.id}">
              <strong>${R.esc(b.nome)}</strong><span>${R.esc(fmtPlace(b))} · enviado ${R.fmt.shortDate(b.created_at)}</span></button></li>`).join("")}
          </ul>
          <section class="detail" aria-labelledby="detailTitle">${detail(sel)}</section>
        </div>`}`;
      el.querySelectorAll("[data-fila]").forEach(b => b.addEventListener("click", () => { sessionStorage.setItem("rp-fila", b.dataset.fila); D.go(); }));
      el.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => D.navigate(`solicitacoes/${b.dataset.open}`)));
      el.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", () => setStatus(b.dataset.id, b.dataset.status, b.dataset.nome)));
    }
  });

  function detail(b) {
    const cats = Array.isArray(b.categorias) ? b.categorias.join(", ") : "";
    return `
      ${b.foto_capa ? `<div class="image-preview wide" style="margin-bottom:1rem">${R.img(b.foto_capa, `Foto enviada por ${b.nome}`)}</div>` : ""}
      <div style="display:flex;justify-content:space-between;gap:1rem;align-items:start;flex-wrap:wrap"><h2 id="detailTitle">${R.esc(b.nome)}</h2>${D.statusTag(b.status)}</div>
      <p style="margin-top:.75rem;white-space:pre-line">${R.esc(b.descricao || "Sem apresentação.")}</p>
      <dl class="facts">
        <div><dt>Endereço</dt><dd>${R.esc([b.endereco, b.bairro, b.cidade].filter(Boolean).join(", ") || "—")}</dd></div>
        <div><dt>Categorias</dt><dd>${R.esc(cats || "—")}</dd></div>
        <div><dt>Responsável</dt><dd>${R.esc(b.nome_responsavel || "—")}<br><a class="link" href="mailto:${R.esc(b.email_responsavel || "")}">${R.esc(b.email_responsavel || "")}</a></dd></div>
        <div><dt>WhatsApp</dt><dd>${b.whatsapp ? `<a class="link" href="${R.whatsappUrl(b.whatsapp)}" target="_blank" rel="noopener">${R.esc(b.whatsapp)}</a>` : "—"}</dd></div>
        <div><dt>Instagram</dt><dd>${b.instagram ? `<a class="link" href="${R.instagramUrl(b.instagram)}" target="_blank" rel="noopener">@${R.esc(b.instagram)}</a>` : "—"}</dd></div>
        <div><dt>Enviado em</dt><dd>${R.fmt.date(b.created_at)}</dd></div>
      </dl>
      <div class="detail-actions">
        ${b.status !== "approved" ? `<button class="btn btn-success" type="button" data-status="approved" data-id="${R.esc(b.id)}" data-nome="${R.esc(b.nome)}">Aprovar e publicar</button>` : ""}
        ${b.status !== "rejected" ? `<button class="btn btn-danger" type="button" data-status="rejected" data-id="${R.esc(b.id)}" data-nome="${R.esc(b.nome)}">Recusar</button>` : ""}
      </div>`;
  }

  async function setStatus(id, status, nome) {
    const msgs = {
      approved: [`Aprovar “${nome}”? O brechó passa a aparecer no site e o responsável ganha acesso ao painel.`, "Aprovar", false],
      rejected: [`Recusar ou despublicar “${nome}”? Ele deixa de aparecer no site. O responsável pode corrigir os dados e reenviar.`, "Recusar", true],
      pending: [`Voltar “${nome}” para análise? Ele deixa de aparecer no site até ser aprovado de novo.`, "Voltar para análise", true]
    };
    const [msg, label, danger] = msgs[status];
    if (!(await D.confirm(msg, { confirmLabel: label, danger }))) return;
    const { error } = await R.sb.from("brechos").update({ status }).eq("id", id);
    if (error) return R.toast(R.errorMessage(error), "error");
    R.toast(status === "approved" ? "Brechó aprovado e publicado." : status === "rejected" ? "Cadastro recusado." : "Cadastro voltou para análise.");
    D.go();
  }

  /* ---------- todos os brechós ---------- */
  D.route("brechos", {
    label: "Brechós",
    async render(el) {
      const { data, error } = await R.sb.from("brechos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      // Aprovados com endereço e sem posição no mapa (brechós só online não entram no mapa).
      const semMapa = data.filter(b => b.status === "approved" && !R.map.hasCoords(b) && b.modalidade !== "online" && b.endereco);
      el.innerHTML = `
        ${D.head("Brechós", `${R.fmt.count(data.length, "cadastro", "cadastros")} na plataforma.`)}
        ${semMapa.length ? `<section class="banner pending" aria-labelledby="geoTitle" style="flex-wrap:wrap">
          <span id="geoTitle"><strong>${R.fmt.count(semMapa.length, "brechó aprovado ainda não aparece", "brechós aprovados ainda não aparecem")} no mapa.</strong> Localize pelo endereço (OpenStreetMap); depois confira cada um em “Editar”.</span>
          <button class="btn btn-sm" type="button" id="geoAll">Posicionar no mapa</button>
          <span class="small" id="geoStatus" role="status" style="flex-basis:100%"></span>
        </section>` : ""}
        <div class="toolbar">
          <div class="field"><label for="bSearch">Buscar</label><input class="input" id="bSearch" type="search" placeholder="Nome, bairro ou e-mail"></div>
          <div class="field"><label for="bStatus">Status</label><select class="select" id="bStatus"><option value="">Todos</option><option value="approved">Aprovados</option><option value="pending">Em análise</option><option value="rejected">Recusados</option></select></div>
        </div>
        <p class="visually-hidden" role="status" id="bCount"></p>
        <div class="table-wrap"><table class="dtable stack"><thead><tr><th scope="col">Brechó</th><th scope="col">Local</th><th scope="col">Status</th><th scope="col">Mapa</th><th scope="col">Cadastro</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead><tbody id="bRows"></tbody></table></div>`;
      const paint = () => {
        const q = R.$("#bSearch").value.toLowerCase().trim();
        const st = R.$("#bStatus").value;
        const rows = data.filter(b => (!st || b.status === st) && (!q || [b.nome, b.bairro, b.cidade, b.email_responsavel].join(" ").toLowerCase().includes(q)));
        R.$("#bCount").textContent = R.fmt.count(rows.length, "brechó listado", "brechós listados");
        R.$("#bRows").innerHTML = rows.length ? rows.map(b => `<tr>
          <td data-label="Brechó"><strong>${R.esc(b.nome)}</strong><small>${b.origem === "curadoria" ? "Curadoria · sem conta responsável" : b.origem === "demonstracao" ? "Acervo de demonstração" : R.esc(b.email_responsavel || "")}</small></td>
          <td data-label="Local">${R.esc(fmtPlace(b))}</td>
          <td data-label="Status">${D.statusTag(b.status)}</td>
          <td data-label="Mapa">${b.latitude ? "Sim" : "Sem posição"}</td>
          <td data-label="Cadastro">${R.fmt.shortDate(b.created_at)}</td>
          <td class="no-label"><div class="actions">
            ${b.status === "approved" ? `<a class="btn btn-ghost btn-sm" href="${R.url(`brecho.html?b=${encodeURIComponent(b.slug || b.id)}`)}">Ver página</a>` : ""}
            <a class="btn btn-outline btn-sm" href="#editar-brecho/${R.esc(b.id)}">Editar</a>
            <a class="btn btn-ghost btn-sm" href="#solicitacoes/${R.esc(b.id)}" data-review="${R.esc(b.status)}">Detalhes</a>
            ${b.status === "approved" ? `<button class="btn btn-danger btn-sm" type="button" data-status="pending" data-id="${R.esc(b.id)}" data-nome="${R.esc(b.nome)}">Despublicar</button>` : ""}
            <button class="btn btn-danger btn-sm" type="button" data-delete="${R.esc(b.id)}" data-nome="${R.esc(b.nome)}">Excluir</button>
          </div></td></tr>`).join("") : `<tr><td colspan="6">${R.render.state("empty", "Nenhum brechó com esses filtros.")}</td></tr>`;
      };
      paint();
      R.$("#bSearch").addEventListener("input", R.debounce(paint, 150));
      R.$("#bStatus").addEventListener("change", paint);
      R.$("#geoAll", el)?.addEventListener("click", async () => {
        const btn = R.$("#geoAll", el), st = R.$("#geoStatus", el);
        btn.disabled = true;
        const falhas = [];
        let ok = 0;
        for (const [i, b] of semMapa.entries()) {
          st.textContent = `Localizando ${i + 1} de ${semMapa.length}: ${b.nome}…`;
          // "(casa 8)", "loja 02"… atrapalham a busca: fica só rua e número.
          const rua = String(b.endereco).replace(/\(.*?\)/g, "").replace(/\b(loja|sala|casa|conj\.?|apto?)\s*\S+/gi, "").replace(/[,\s]+$/, "");
          try {
            const g = await R.map.geocode([rua, b.bairro, b.cidade || "São Paulo"].filter(Boolean).join(", "));
            const { error: err } = await R.sb.from("brechos").update({ latitude: g.latitude, longitude: g.longitude, endereco_formatado: g.endereco_formatado }).eq("id", b.id);
            if (err) throw err;
            ok += 1;
          } catch (err) {
            falhas.push(`${b.nome} (${err.message})`);
          }
          // O OpenStreetMap pede no máximo 1 consulta por segundo.
          if (i < semMapa.length - 1) await new Promise(r => setTimeout(r, 1100));
        }
        R.toast(`${R.fmt.count(ok, "brechó posicionado", "brechós posicionados")} no mapa.`);
        if (falhas.length) {
          st.textContent = `Não encontrados: ${falhas.join("; ")}. Use “Editar” para marcar no mapa.`;
          btn.disabled = false;
        } else D.go();
      });
      el.addEventListener("click", async e => {
        const rev = e.target.closest("[data-review]");
        if (rev) sessionStorage.setItem("rp-fila", rev.dataset.review === "rejected" ? "rejected" : "pending");
        const st = e.target.closest("[data-status]");
        if (st) return setStatus(st.dataset.id, st.dataset.status, st.dataset.nome);
        const del = e.target.closest("[data-delete]");
        if (!del) return;
        if (!(await D.confirm(`Excluir definitivamente “${del.dataset.nome}”? As peças, curtidas e estatísticas dele também serão apagadas. Essa ação não pode ser desfeita.`, { confirmLabel: "Excluir brechó" }))) return;
        const { error: err } = await R.sb.from("brechos").delete().eq("id", del.dataset.delete);
        if (err) return R.toast(R.errorMessage(err), "error");
        R.toast("Brechó excluído.");
        D.go();
      });
    }
  });

  /* ---------- usuários ---------- */
  const ROLES = ["usuario", "dono", "admin"];
  const ROLE_LABEL = { usuario: "Pessoa usuária", dono: "Dono de brechó", admin: "Administração" };
  // Troca de função pela função do banco (v7); sem ela, tenta a tabela e
  // confere se a linha mudou de fato (a RLS pode recusar sem dar erro).
  async function definirFuncao(id, role) {
    const rpc = await R.sb.rpc("admin_definir_funcao", { p_user_id: id, p_role: role });
    if (!rpc.error) return;
    if (rpc.error.code !== "PGRST202") throw rpc.error;
    const { data, error } = await R.sb.from("profiles").update({ role }).eq("id", id).select("role");
    if (error) throw error;
    if (!data?.length || data[0].role !== role) throw new Error("O banco não aplicou a mudança. Rode supabase/v7/1_reparos.sql no SQL Editor.");
  }
  D.route("usuarios", {
    label: "Pessoas",
    async render(el) {
      const { data, error } = await R.sb.rpc("admin_listar_usuarios");
      if (error) throw error;
      el.innerHTML = `
        ${D.head("Pessoas", "Contas cadastradas. A função “dono” é atribuída automaticamente quando um brechó é aprovado.")}
        <div class="toolbar"><div class="field"><label for="uSearch">Buscar</label><input class="input" id="uSearch" type="search" placeholder="Nome ou e-mail"></div></div>
        <div class="table-wrap"><table class="dtable stack"><thead><tr><th scope="col">Pessoa</th><th scope="col">Função</th><th scope="col">Cidade</th><th scope="col">Cadastro</th><th scope="col">Último acesso</th></tr></thead><tbody id="uRows"></tbody></table></div>`;
      const paint = () => {
        const q = R.$("#uSearch").value.toLowerCase().trim();
        const rows = data.filter(u => !q || `${u.nome} ${u.email}`.toLowerCase().includes(q));
        R.$("#uRows").innerHTML = rows.map(u => {
          const self = u.id === R.auth.user.id;
          return `<tr>
            <td data-label="Pessoa"><strong>${R.esc(u.nome || "Sem nome")}</strong><small>${R.esc(u.email || "")}</small></td>
            <td data-label="Função"><label class="visually-hidden" for="role-${u.id}">Função de ${R.esc(u.nome || u.email)}</label>
              <select class="select" id="role-${u.id}" data-role="${u.id}" style="min-height:2.4rem;width:auto"${self ? ' disabled aria-describedby="selfRoleNote"' : ""}>
                ${ROLES.includes(u.role) ? "" : `<option value="${R.esc(u.role || "")}" selected>Valor antigo: ${R.esc(u.role || "vazio")}</option>`}
                ${ROLES.map(r => `<option value="${r}"${u.role === r ? " selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}
              </select></td>
            <td data-label="Cidade">${R.esc(u.cidade || "—")}</td>
            <td data-label="Cadastro">${R.fmt.shortDate(u.created_at)}</td>
            <td data-label="Último acesso">${R.fmt.shortDate(u.last_sign_in_at)}</td></tr>`;
        }).join("");
      };
      el.insertAdjacentHTML("beforeend", '<p class="small muted" id="selfRoleNote" style="margin-top:1rem">Você não pode alterar a sua própria função, para não perder o acesso administrativo.</p>');
      paint();
      R.$("#uSearch").addEventListener("input", R.debounce(paint, 150));
      el.addEventListener("change", async e => {
        const sel = e.target.closest("[data-role]");
        if (!sel) return;
        const u = data.find(x => x.id === sel.dataset.role);
        if (!(await D.confirm(`Alterar a função de ${u.nome || u.email} para “${sel.options[sel.selectedIndex].text}”?`, { confirmLabel: "Alterar", danger: sel.value === "admin" }))) { sel.value = u.role; return; }
        sel.disabled = true;
        try {
          await definirFuncao(u.id, sel.value);
          u.role = sel.value;
          R.toast(`Função de ${u.nome || u.email} atualizada para “${ROLE_LABEL[u.role]}”.`);
          paint();
        } catch (err) {
          console.error("[Repeteco] função:", err);
          sel.value = u.role;
          R.toast(R.errorDetail(err, "Não foi possível alterar a função."), "error");
        } finally { sel.disabled = u.id === R.auth.user.id; }
      });
    }
  });

  /* ---------- publicações ---------- */
  D.route("publicacoes", {
    label: "Peças publicadas",
    async render(el) {
      const [pubs, shops] = await Promise.all([
        R.sb.from("publicacoes").select("id, titulo, imagem_url, imagem_path, status, disponivel, preco, created_at, brecho_id").order("created_at", { ascending: false }).limit(300),
        R.sb.from("brechos").select("id, nome, slug")
      ]);
      if (pubs.error) throw pubs.error;
      const shopName = new Map((shops.data || []).map(b => [b.id, b]));
      el.innerHTML = `
        ${D.head("Peças publicadas", "Moderação das peças publicadas pelos brechós (as 300 mais recentes).")}
        ${!pubs.data.length ? R.render.state("empty", "Nenhuma peça publicada ainda.") : `
        <div class="table-wrap"><table class="dtable stack"><thead><tr><th scope="col"><span class="visually-hidden">Foto</span></th><th scope="col">Peça</th><th scope="col">Brechó</th><th scope="col">Status</th><th scope="col">Data</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead>
        <tbody>${pubs.data.map(p => {
          const b = shopName.get(p.brecho_id) || {};
          return `<tr>
            <td class="no-label">${R.img(p.imagem_url, "", { cls: "thumb" })}</td>
            <td data-label="Peça"><strong>${R.esc(p.titulo)}</strong><small>${R.fmt.price(p.preco)}${p.disponivel === false ? " · vendida" : ""}</small></td>
            <td data-label="Brechó">${R.esc(b.nome || "—")}</td>
            <td data-label="Status">${D.statusTag(p.status)}</td>
            <td data-label="Data">${R.fmt.shortDate(p.created_at)}</td>
            <td class="no-label"><div class="actions">
              ${p.status === "publicado" ? `<a class="btn btn-ghost btn-sm" href="${R.links.peca(p.id)}">Ver</a>` : ""}
              <button class="btn btn-outline btn-sm" type="button" data-toggle-pub="${p.id}" data-status="${p.status}">${p.status === "publicado" ? "Ocultar" : "Republicar"}</button>
              <button class="btn btn-danger btn-sm" type="button" data-del-pub="${p.id}" data-path="${R.esc(p.imagem_path || "")}" data-title="${R.esc(p.titulo)}">Excluir</button>
            </div></td></tr>`;
        }).join("")}</tbody></table></div>`}`;
      el.addEventListener("click", async e => {
        const t = e.target.closest("[data-toggle-pub]");
        if (t) {
          const status = t.dataset.status === "publicado" ? "rascunho" : "publicado";
          const { error } = await R.sb.from("publicacoes").update({ status }).eq("id", t.dataset.togglePub);
          if (error) return R.toast(R.errorMessage(error), "error");
          R.toast(status === "publicado" ? "Peça republicada." : "Peça ocultada do site.");
          return D.go();
        }
        const d = e.target.closest("[data-del-pub]");
        if (!d) return;
        if (!(await D.confirm(`Excluir “${d.dataset.title}”? A foto e as curtidas da peça também serão removidas.`, { confirmLabel: "Excluir peça" }))) return;
        const { error } = await R.sb.from("publicacoes").delete().eq("id", d.dataset.delPub);
        if (error) return R.toast(R.errorMessage(error), "error");
        if (d.dataset.path) R.media.remove("brechos", d.dataset.path);
        R.toast("Peça excluída.");
        D.go();
      });
    }
  });

  /* ---------- mensagens ---------- */
  const ASSUNTOS = { duvida: "Dúvida", brecho: "Brechó", imprensa: "Imprensa", parceria: "Parceria", privacidade: "Privacidade", acessibilidade: "Acessibilidade", outro: "Outro" };
  D.route("mensagens", {
    label: "Mensagens",
    async render(el) {
      const { data, error } = await R.sb.from("contatos").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      D.badge("mensagens", data.filter(m => !m.lido).length);
      el.innerHTML = `
        ${D.head("Mensagens", "Recebidas pelo formulário de contato. Responda pelo e-mail da pessoa.")}
        ${!data.length ? R.render.state("empty", "Nenhuma mensagem recebida.") : `
        <div class="table-wrap"><table class="dtable stack"><thead><tr><th scope="col">De</th><th scope="col">Assunto</th><th scope="col">Mensagem</th><th scope="col">Data</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead>
        <tbody>${data.map(m => `<tr class="${m.lido ? "" : "is-unread"}">
          <td data-label="De">${R.esc(m.nome)}${m.lido ? "" : ' <span class="visually-hidden">(não lida)</span>'}<small>${R.esc(m.email)}</small></td>
          <td data-label="Assunto">${R.esc(ASSUNTOS[m.assunto] || m.assunto)}</td>
          <td data-label="Mensagem" style="white-space:pre-line;max-width:32rem">${R.esc(m.mensagem)}</td>
          <td data-label="Data">${R.fmt.shortDate(m.created_at)}</td>
          <td class="no-label"><div class="actions">
            <a class="btn btn-outline btn-sm" href="mailto:${R.esc(m.email)}?subject=${encodeURIComponent("Re: contato com o Repeteco")}">Responder</a>
            <button class="btn btn-ghost btn-sm" type="button" data-read="${m.id}" data-value="${!m.lido}">${m.lido ? "Marcar como não lida" : "Marcar como lida"}</button>
            <button class="btn btn-danger btn-sm" type="button" data-del-msg="${m.id}">Excluir</button>
          </div></td></tr>`).join("")}</tbody></table></div>`}`;
      el.addEventListener("click", async e => {
        const r = e.target.closest("[data-read]");
        if (r) {
          const { error } = await R.sb.from("contatos").update({ lido: r.dataset.value === "true" }).eq("id", r.dataset.read);
          if (error) return R.toast(R.errorMessage(error), "error");
          return D.go();
        }
        const d = e.target.closest("[data-del-msg]");
        if (!d || !(await D.confirm("Excluir esta mensagem?", { confirmLabel: "Excluir" }))) return;
        const { error } = await R.sb.from("contatos").delete().eq("id", d.dataset.delMsg);
        if (error) return R.toast(R.errorMessage(error), "error");
        D.go();
      });
    }
  });
})();
