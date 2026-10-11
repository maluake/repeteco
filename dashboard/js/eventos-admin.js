/* =====================================================
   REPETECO — eventos e parcerias no painel (somente admin;
   a RLS de eventos/evento_parcerias garante isso no banco).
   ===================================================== */
(function () {
  const R = window.R;
  const D = window.D;
  const V = R.vocab;

  // ISO (UTC) → valor de <input type="datetime-local"> no fuso do navegador.
  const toLocal = iso => {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const fromLocal = v => v ? new Date(v).toISOString() : null;
  const PARCERIA_STATUS = { nova: "Nova", em_conversa: "Em conversa", confirmada: "Confirmada", recusada: "Recusada" };

  D.route("eventos", {
    label: "Eventos",
    async render(el, arg) {
      if (arg) return editor(el, arg === "novo" ? null : arg);
      const { data, error } = await R.sb.from("eventos").select("id, slug, titulo, data_inicio, formato, status, aceita_parcerias").order("data_inicio", { ascending: false });
      if (error) throw error;
      const agora = new Date();
      el.innerHTML = `
        ${D.head("Eventos", "Eventos publicados aparecem em /eventos e na página inicial. Rascunhos só são visíveis para a administração.", '<a class="btn" href="#eventos/novo">Novo evento</a>')}
        ${!data.length ? R.render.state("empty", "Nenhum evento ainda.", "Crie o primeiro evento do Repeteco.", '<a class="btn" href="#eventos/novo">Novo evento</a>') : `
        <div class="table-wrap"><table class="dtable stack"><thead><tr><th scope="col">Evento</th><th scope="col">Data</th><th scope="col">Formato</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead>
        <tbody>${data.map(e => `<tr>
          <td data-label="Evento"><strong>${R.esc(e.titulo)}</strong><small>/${R.esc(e.slug)}${e.aceita_parcerias ? " · aceita parcerias" : ""}</small></td>
          <td data-label="Data">${R.esc(R.fmt.when(e.data_inicio))}${new Date(e.data_inicio) < agora ? "<small>já aconteceu</small>" : ""}</td>
          <td data-label="Formato">${R.esc(R.label("formatosEvento", e.formato))}</td>
          <td data-label="Status">${D.statusTag(e.status)}</td>
          <td class="no-label"><div class="actions">
            <a class="btn btn-ghost btn-sm" href="${R.url(`evento.html?e=${encodeURIComponent(e.slug)}`)}">${e.status === "publicado" ? "Ver" : "Pré-visualizar"}</a>
            <a class="btn btn-outline btn-sm" href="#eventos/${e.id}">Editar</a>
          </div></td></tr>`).join("")}</tbody></table></div>`}`;
    }
  });

  async function editor(el, id) {
    let e = { titulo: "", resumo: "", descricao: "", data_inicio: null, data_fim: null, formato: "presencial", local_nome: "", endereco: "", bairro: "", cidade: "São Paulo", link: "", capa_url: null, capa_path: null, capa_alt: "", aceita_parcerias: true, status: "rascunho", slug: "" };
    if (id) {
      const { data, error } = await R.sb.from("eventos").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) { el.innerHTML = R.render.state("empty", "Evento não encontrado.", "", '<a class="btn" href="#eventos">Voltar</a>'); return; }
      e = data;
    }
    const v = x => R.esc(x || "");
    const formatos = Object.entries(V.formatosEvento).map(([k, l]) => `<option value="${k}"${e.formato === k ? " selected" : ""}>${l}</option>`).join("");
    el.innerHTML = `
      ${D.head(id ? "Editar evento" : "Novo evento", id ? `Status atual: ${D.statusLabel(e.status)}.` : "Comece como rascunho; publique quando data e local estiverem confirmados.", '<a class="btn btn-ghost" href="#eventos">Voltar à lista</a>')}
      <form id="evForm" novalidate>
        <div class="panel-card" style="display:grid;gap:1rem">
          <div class="field"><label for="eTitulo">Nome do evento</label><input class="input" id="eTitulo" maxlength="140" value="${v(e.titulo)}" required></div>
          <div class="field"><label for="eResumo">Resumo (aparece na agenda)</label><input class="input" id="eResumo" maxlength="240" value="${v(e.resumo)}"></div>
          <div class="form-grid">
            <div class="field"><label for="eInicio">Começa em</label><input class="input" id="eInicio" type="datetime-local" value="${toLocal(e.data_inicio)}" required></div>
            <div class="field"><label for="eFim">Termina em (opcional)</label><input class="input" id="eFim" type="datetime-local" value="${toLocal(e.data_fim)}"></div>
            <div class="field"><label for="eFormato">Formato</label><select class="select" id="eFormato">${formatos}</select></div>
            <div class="field"><label for="eSlug">Endereço (slug)</label><input class="input" id="eSlug" value="${v(e.slug)}" placeholder="gerado a partir do nome" aria-describedby="eSlug-dica"><p class="hint" id="eSlug-dica">Usado em evento.html?e=…</p></div>
          </div>
          <div class="form-grid" id="eLocalWrap">
            <div class="field"><label for="eLocal">Local</label><input class="input" id="eLocal" maxlength="120" value="${v(e.local_nome)}" placeholder="Ex.: Praça Benedito Calixto"></div>
            <div class="field"><label for="eEndereco">Endereço</label><input class="input" id="eEndereco" maxlength="200" value="${v(e.endereco)}"></div>
            <div class="field"><label for="eBairro">Bairro</label><input class="input" id="eBairro" maxlength="80" value="${v(e.bairro)}"></div>
            <div class="field"><label for="eCidade">Cidade</label><input class="input" id="eCidade" maxlength="80" value="${v(e.cidade)}"></div>
          </div>
          <div class="field"><label for="eLink">Link (inscrição ou transmissão)</label><input class="input" id="eLink" type="url" value="${v(e.link)}" placeholder="https://"></div>
          <div class="media-pair">
            <div class="image-preview wide" id="eCapaPreview">${e.capa_url ? R.img(e.capa_url, "Capa atual") : "Sem capa"}</div>
            <div style="display:grid;gap:.75rem">
              <div class="field"><label for="eCapa">Imagem de capa</label><input class="input" id="eCapa" type="file"></div>
              <div class="field"><label for="eAlt">Descrição da capa (texto alternativo)</label><input class="input" id="eAlt" maxlength="240" value="${v(e.capa_alt)}"></div>
              ${e.capa_url ? '<button class="btn btn-ghost btn-sm" type="button" id="eCapaRemove" style="justify-self:start">Remover capa</button>' : ""}
            </div>
          </div>
          <div class="field"><label for="eDesc">Descrição e programação</label><textarea class="textarea content" id="eDesc" aria-describedby="eDesc-dica">${v(e.descricao)}</textarea>
            <p class="hint" id="eDesc-dica">Mesma formatação do editorial: “## ” para intertítulos, “- ” para listas, **negrito** e [texto](https://link).</p></div>
          <label class="check"><input type="checkbox" id="eParcerias"${e.aceita_parcerias ? " checked" : ""}> Mostrar formulário de parceria na página do evento</label>
        </div>
        <p class="form-status" id="eStatus" style="margin-top:1rem"></p>
        <div class="editor-foot" style="margin-top:1rem">
          <div class="group">
            <button class="btn btn-outline" type="submit" data-intent="rascunho">${e.status === "publicado" ? "Despublicar e salvar como rascunho" : "Salvar rascunho"}</button>
            <button class="btn" type="submit" data-intent="publicado">${e.status === "publicado" ? "Salvar e manter publicado" : "Publicar"}</button>
          </div>
          ${id ? '<button class="btn btn-danger" type="button" id="eDelete">Excluir evento</button>' : ""}
        </div>
      </form>`;

    const $ = s => el.querySelector(s);
    const syncFormato = () => { $("#eLocalWrap").hidden = $("#eFormato").value === "online"; };
    $("#eFormato").addEventListener("change", syncFormato);
    syncFormato();

    let removeCapa = false;
    const picker = R.media.picker($("#eCapa"), $("#eCapaPreview"), { aspect: 16 / 9, onError: m => R.fieldError($("#eCapa"), m) });
    $("#eCapaRemove")?.addEventListener("click", () => { removeCapa = true; picker.reset(); $("#eCapaPreview").textContent = "Sem capa"; });

    let intent = "rascunho";
    el.querySelectorAll("[data-intent]").forEach(b => b.addEventListener("click", () => { intent = b.dataset.intent; }));

    $("#evForm").addEventListener("submit", async ev => {
      ev.preventDefault();
      const st = $("#eStatus");
      const titulo = $("#eTitulo").value.trim();
      const inicio = fromLocal($("#eInicio").value), fim = fromLocal($("#eFim").value);
      const formato = $("#eFormato").value;
      const linkRaw = $("#eLink").value.trim();
      const link = linkRaw ? (linkRaw.includes("://") ? linkRaw : "https://" + linkRaw) : null;
      if (!R.validate([
        [$("#eTitulo"), titulo.length < 3 ? "O nome precisa ter pelo menos 3 caracteres." : null],
        [$("#eInicio"), !inicio ? "Informe quando o evento começa." : null],
        [$("#eFim"), fim && inicio && fim < inicio ? "O fim precisa ser depois do início." : null],
        [$("#eLocal"), intent === "publicado" && formato !== "online" && !$("#eLocal").value.trim() && !$("#eEndereco").value.trim() ? "Informe o local antes de publicar." : null],
        [$("#eLink"), link && !R.safeUrl(link) ? "Informe um link válido." : intent === "publicado" && formato === "online" && !link ? "Evento online precisa do link de acesso." : null],
        [$("#eAlt"), intent === "publicado" && (picker.get() || (e.capa_url && !removeCapa)) && !$("#eAlt").value.trim() ? "Descreva a capa para quem usa leitor de tela." : null]
      ])) return;
      const buttons = el.querySelectorAll("button");
      buttons.forEach(b => { b.disabled = true; });
      R.formStatus(st, "Salvando…");
      let novaCapa = null;
      try {
        let capa_url = removeCapa ? null : e.capa_url;
        let capa_path = removeCapa ? null : e.capa_path;
        if (picker.get()) {
          R.formStatus(st, "Enviando a capa…");
          const up = await R.media.upload("editorial", picker.get(), { max: 1600, maxBytes: 250 * 1024 });
          capa_url = up.url; capa_path = novaCapa = up.path;
        }
        const online = formato === "online";
        const payload = {
          titulo, resumo: $("#eResumo").value.trim() || null, descricao: $("#eDesc").value.trim() || null,
          data_inicio: inicio, data_fim: fim, formato,
          local_nome: online ? null : ($("#eLocal").value.trim() || null),
          endereco: online ? null : ($("#eEndereco").value.trim() || null),
          bairro: online ? null : ($("#eBairro").value.trim() || null),
          cidade: online ? null : ($("#eCidade").value.trim() || null),
          link, capa_url, capa_path, capa_alt: $("#eAlt").value.trim() || null,
          aceita_parcerias: $("#eParcerias").checked, status: intent, slug: $("#eSlug").value.trim() || null
        };
        const res = id
          ? await R.sb.from("eventos").update(payload).eq("id", id).select("id").single()
          : await R.sb.from("eventos").insert(payload).select("id").single();
        if (res.error) throw res.error;
        if (e.capa_path && e.capa_path !== capa_path) R.media.remove("editorial", e.capa_path);
        R.toast(intent === "publicado" ? "Evento publicado." : "Rascunho salvo.");
        D.navigate(`eventos/${res.data.id}`);
      } catch (err) {
        if (novaCapa) R.media.remove("editorial", novaCapa);
        console.error("[Repeteco] evento:", err);
        R.formStatus(st, R.errorMessage(err, "Não foi possível salvar o evento."), true);
        buttons.forEach(b => { b.disabled = false; });
      }
    });

    $("#eDelete")?.addEventListener("click", async () => {
      if (!(await D.confirm(`Excluir “${e.titulo}”? Os pedidos de parceria deste evento também serão apagados.`, { confirmLabel: "Excluir evento" }))) return;
      const { error } = await R.sb.from("eventos").delete().eq("id", id);
      if (error) return R.toast(R.errorMessage(error), "error");
      if (e.capa_path) R.media.remove("editorial", e.capa_path);
      R.toast("Evento excluído.");
      D.navigate("eventos");
    });
  }

  D.route("parcerias", {
    label: "Parcerias",
    async render(el) {
      const { data, error } = await R.sb.from("evento_parcerias").select("*, eventos(titulo, slug)").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      D.badge("parcerias", data.filter(p => p.status === "nova").length);
      const opts = cur => Object.entries(PARCERIA_STATUS).map(([k, l]) => `<option value="${k}"${cur === k ? " selected" : ""}>${l}</option>`).join("");
      el.innerHTML = `
        ${D.head("Parcerias", "Pessoas, brechós e empresas interessadas em participar dos eventos. Responda pelo e-mail informado e registre o andamento aqui.")}
        ${!data.length ? R.render.state("empty", "Nenhum pedido de parceria ainda.", "Os pedidos chegam pelo formulário na página de cada evento que aceita parcerias.") : `
        <div class="table-wrap"><table class="dtable stack"><thead><tr><th scope="col">Quem</th><th scope="col">Evento</th><th scope="col">Proposta</th><th scope="col">Andamento</th></tr></thead>
        <tbody>${data.map(p => `<tr class="${p.status === "nova" ? "is-unread" : ""}">
          <td data-label="Quem"><strong>${R.esc(p.nome)}</strong><small><a class="link" href="mailto:${R.esc(p.email)}">${R.esc(p.email)}</a>${p.telefone ? ` · ${R.esc(p.telefone)}` : ""}</small><small>${R.fmt.shortDate(p.created_at)}${p.brecho_id ? " · brechó cadastrado" : ""}</small></td>
          <td data-label="Evento">${p.eventos ? `<a class="link" href="${R.url(`evento.html?e=${encodeURIComponent(p.eventos.slug)}`)}">${R.esc(p.eventos.titulo)}</a>` : "—"}</td>
          <td data-label="Proposta"><span class="tag">${R.esc(R.label("parcerias", p.tipo))}</span>${p.mensagem ? `<small style="white-space:pre-line">${R.esc(p.mensagem)}</small>` : ""}</td>
          <td data-label="Andamento"><label class="visually-hidden" for="ps-${p.id}">Andamento do pedido de ${R.esc(p.nome)}</label><select class="select input-sm" id="ps-${p.id}" data-parceria="${p.id}">${opts(p.status)}</select></td>
        </tr>`).join("")}</tbody></table></div>`}`;
      el.addEventListener("change", async ev => {
        const sel = ev.target.closest("[data-parceria]");
        if (!sel) return;
        sel.disabled = true;
        const { error: err } = await R.sb.from("evento_parcerias").update({ status: sel.value }).eq("id", sel.dataset.parceria);
        sel.disabled = false;
        if (err) return R.toast(R.errorMessage(err), "error");
        sel.closest("tr").classList.toggle("is-unread", sel.value === "nova");
        D.badge("parcerias", R.$$("[data-parceria]", el).filter(x => x.value === "nova").length);
        R.toast(`Andamento: ${PARCERIA_STATUS[sel.value]}.`);
      });
    }
  });
})();
