/* =====================================================
   REPETECO — painel do dono do brechó
   O banco garante que o dono só lê/edita o próprio brechó
   e só publica peças depois da aprovação.
   ===================================================== */
(function () {
  const R = window.R;
  const D = window.D;
  const V = R.vocab;
  let shop = null;

  async function loadShop() {
    const { data, error } = await R.sb.from("brechos").select("*").eq("user_id", R.auth.user.id).order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    shop = data[0] || null;
    return shop;
  }
  D.loadShop = loadShop;

  function banner() {
    if (!shop || shop.status === "approved") return "";
    return shop.status === "pending"
      ? `<div class="banner pending" role="status"><span><strong>Cadastro em análise.</strong> Você já pode completar o perfil; as peças poderão ser publicadas depois da aprovação.</span><a class="link" href="#perfil">Completar perfil</a></div>`
      : `<div class="banner rejected" role="status"><span><strong>O cadastro precisa de ajustes.</strong> Revise as informações e salve: o brechó volta para análise automaticamente.</span><a class="link" href="#perfil">Revisar dados</a></div>`;
  }

  /* ---------- visão geral ---------- */
  D.route("visao-dono", {
    label: "Visão geral",
    async render(el) {
      await loadShop();
      const { data: s, error } = await R.sb.rpc("estatisticas_brecho", { p_brecho_id: shop.id });
      if (error) throw error;
      const checks = [
        ["Foto de capa", !!shop.foto_capa], ["Logo", !!shop.logo_url], ["Apresentação", (shop.descricao || "").length >= 40],
        ["Endereço no mapa", R.map.hasCoords(shop)], ["WhatsApp ou Instagram", !!(shop.whatsapp || shop.instagram)],
        ["Horário de funcionamento", !!shop.horario], ["Primeira peça publicada", Number(s.publicacoes) > 0]
      ];
      const done = checks.filter(c => c[1]).length;
      const days = (s.visitas_por_dia || []).map(d => ({ label: D.dayLabel(d.dia), value: Number(d.total) || 0 }));
      el.innerHTML = `
        ${D.head(shop.nome, "Como as pessoas estão encontrando o seu brechó.",
          shop.status === "approved" ? `<a class="btn btn-outline" href="${R.url(`brecho.html?b=${encodeURIComponent(shop.slug || shop.id)}`)}">Ver página pública</a><a class="btn" href="#pecas/nova">Publicar peça</a>` : "")}
        ${banner()}
        ${D.stats([
          { label: "Visitas à página", value: s.visitas_30d, note: "últimos 30 dias" },
          { label: "Cliques no mapa e rota", value: s.cliques_mapa_30d, note: "últimos 30 dias" },
          { label: "Cliques em contato", value: s.cliques_contato_30d, note: "WhatsApp, Instagram e site" },
          { label: "Curtidas", value: Number(s.curtidas_brecho) + Number(s.curtidas_publicacoes), note: `${s.curtidas_publicacoes} em peças · ${s.curtidas_brecho} no brechó` },
          { label: "Salvamentos", value: Number(s.salvos_brecho) + Number(s.salvos_publicacoes), note: `${s.salvos_publicacoes} em peças · ${s.salvos_brecho} no brechó` },
          { label: "Peças publicadas", value: s.publicacoes, note: s.rascunhos ? `${s.rascunhos} em rascunho` : "", href: "#pecas" }
        ])}
        <div class="two-col">
          <div>
            <div class="charts" style="grid-template-columns:1fr">${D.bars({ title: "Visitas por dia", points: days, unit: "visitas", note: "últimos 14 dias" })}</div>
            <h2 style="font-size:1.3rem;margin-bottom:.75rem">Peças com mais interesse</h2>
            ${(s.top_publicacoes || []).length ? `<div class="table-wrap"><table class="dtable"><thead><tr><th scope="col">Peça</th><th scope="col">Curtidas</th><th scope="col">Salvos</th></tr></thead><tbody>
              ${s.top_publicacoes.map(p => `<tr><td><a class="link" href="#pecas/${p.id}">${R.esc(p.titulo)}</a></td><td>${p.curtidas}</td><td>${p.salvos}</td></tr>`).join("")}
            </tbody></table></div>` : '<p class="muted">Publique peças para acompanhar quais chamam mais atenção.</p>'}
          </div>
          <section aria-labelledby="checkTitle">
            <h2 id="checkTitle" style="font-size:1.3rem">Perfil completo: ${done} de ${checks.length}</h2>
            <p class="muted small" style="margin:.4rem 0 1rem">Perfis completos aparecem melhor na busca e no mapa.</p>
            <ul class="checklist">${checks.map(([l, ok]) => `<li class="${ok ? "ok" : "todo"}"><span>${l}<span class="visually-hidden">${ok ? ": feito" : ": pendente"}</span></span>${ok ? "" : `<a class="link small" href="${l.startsWith("Primeira") ? "#pecas/nova" : "#perfil"}">Resolver</a>`}</li>`).join("")}</ul>
          </section>
        </div>
        <p class="small muted" style="margin-top:2rem">Por privacidade, o Repeteco mostra apenas totais: você não vê quem curtiu ou salvou.</p>`;
    }
  });

  /* ---------- peças ---------- */
  D.route("pecas", {
    label: "Minhas peças",
    async render(el, arg) {
      await loadShop();
      const { data, error } = await R.sb.from("publicacoes").select("*").eq("brecho_id", shop.id).order("created_at", { ascending: false });
      if (error) throw error;
      const canPublish = shop.status === "approved";
      el.innerHTML = `
        ${D.head("Minhas peças", `${R.fmt.count(data.length, "peça", "peças")} cadastradas.`, canPublish ? '<button class="btn" type="button" data-new>Publicar peça</button>' : "")}
        ${banner()}
        ${!data.length ? R.render.state("empty", "Nenhuma peça ainda.", canPublish ? "Publique a primeira peça com uma boa foto vertical, em luz natural." : "Depois da aprovação você poderá publicar peças aqui.", canPublish ? '<button class="btn" type="button" data-new>Publicar peça</button>' : "") : `
        <div class="owner-pieces">${data.map(p => `
          <article class="owner-piece">
            <div class="tile-media">${R.img(p.imagem_url, p.alt_text || p.titulo)}</div>
            <h3>${R.esc(p.titulo)}</h3>
            <div class="meta">${D.statusTag(p.status)}<span>${R.fmt.price(p.preco)}</span>${p.disponivel ? "" : "<span>Vendida</span>"}</div>
            <div class="row">
              <button class="btn btn-outline btn-sm" type="button" data-edit="${p.id}">Editar<span class="visually-hidden"> ${R.esc(p.titulo)}</span></button>
              <button class="btn btn-ghost btn-sm" type="button" data-sold="${p.id}" data-value="${!p.disponivel}">${p.disponivel ? "Marcar vendida" : "Marcar disponível"}<span class="visually-hidden">: ${R.esc(p.titulo)}</span></button>
            </div>
          </article>`).join("")}</div>`}`;
      el.addEventListener("click", async e => {
        if (e.target.closest("[data-new]")) return openEditor(null);
        const ed = e.target.closest("[data-edit]");
        if (ed) return openEditor(data.find(p => p.id === ed.dataset.edit));
        const sold = e.target.closest("[data-sold]");
        if (sold) {
          const { error: err } = await R.sb.from("publicacoes").update({ disponivel: sold.dataset.value === "true" }).eq("id", sold.dataset.sold);
          if (err) return R.toast(R.errorMessage(err), "error");
          R.toast(sold.dataset.value === "true" ? "Peça disponível de novo." : "Peça marcada como vendida.");
          D.go();
        }
      });
      if (arg === "nova" && canPublish) openEditor(null);
      else if (arg && arg !== "nova") { const p = data.find(x => x.id === arg); if (p) openEditor(p); }
    }
  });

  const options = (obj, current, empty = "Selecione") =>
    `<option value="">${empty}</option>` + Object.entries(obj).map(([v, l]) => `<option value="${v}"${current === v ? " selected" : ""}>${l}</option>`).join("");

  function openEditor(p) {
    const isNew = !p;
    p = p || { titulo: "", descricao: "", tipo: "", tamanho: "", preco: "", condicao: "", estilo: "", genero: "", disponivel: true, status: "publicado", alt_text: "" };
    const d = document.createElement("dialog");
    d.className = "sheet wide";
    d.setAttribute("aria-labelledby", "pieceTitle");
    d.innerHTML = `
      <form method="dialog" id="pieceForm" novalidate>
        <div class="sheet-head"><h2 id="pieceTitle">${isNew ? "Publicar peça" : "Editar peça"}</h2><button class="icon-btn" type="button" data-cancel aria-label="Fechar">${R.icon("close")}</button></div>
        <div class="sheet-body editor">
          <div class="image-slot">
            <div class="image-preview" id="pcPreview">${p.imagem_url ? R.img(p.imagem_url, "Foto atual") : "Nenhuma foto escolhida"}</div>
            <div class="field"><label for="pcFoto">${isNew ? "Foto da peça" : "Trocar foto"}</label><input class="input" id="pcFoto" type="file"><p class="hint">Vertical (3:4) fica melhor no feed. Reduzimos a imagem antes do envio.</p></div>
          </div>
          <div class="form-grid">
            <div class="field full"><label for="pcTitulo">Nome da peça</label><input class="input" id="pcTitulo" maxlength="90" value="${R.esc(p.titulo)}" placeholder="Ex.: Jaqueta jeans anos 90"></div>
            <div class="field full"><label for="pcAlt">Descrição da foto</label><input class="input" id="pcAlt" maxlength="240" value="${R.esc(p.alt_text || "")}" aria-describedby="pcAlt-dica"><p class="hint" id="pcAlt-dica">Para leitores de tela. Ex.: “Jaqueta jeans azul-clara com botões de metal, aberta sobre cabide”.</p></div>
            <div class="field"><label for="pcPreco">Preço (R$)</label><input class="input" id="pcPreco" type="number" min="0" step="0.01" inputmode="decimal" value="${p.preco ?? ""}"></div>
            <div class="field"><label for="pcTipo">Tipo</label><select class="select" id="pcTipo">${options(V.tipos, p.tipo)}</select></div>
            <div class="field"><label for="pcTam">Tamanho</label><select class="select" id="pcTam"><option value="">Selecione</option>${V.tamanhos.map(t => `<option${p.tamanho === t ? " selected" : ""}>${t}</option>`).join("")}</select></div>
            <div class="field"><label for="pcCond">Condição</label><select class="select" id="pcCond">${options(V.condicoes, p.condicao)}</select></div>
            <div class="field"><label for="pcEstilo">Estilo</label><select class="select" id="pcEstilo">${options(V.estilos, p.estilo)}</select></div>
            <div class="field"><label for="pcGenero">Gênero</label><select class="select" id="pcGenero">${options(V.generos, p.genero)}</select></div>
            <div class="field full"><label for="pcDesc">Detalhes</label><textarea class="textarea" id="pcDesc" maxlength="1200" placeholder="Medidas, tecido, marca, detalhes de uso…">${R.esc(p.descricao || "")}</textarea></div>
            <label class="check full"><input type="checkbox" id="pcDisp"${p.disponivel ? " checked" : ""}> Disponível para venda</label>
          </div>
        </div>
        <p class="form-status" id="pcStatus" style="margin:0 1.25rem 1rem"></p>
        <div class="editor-foot">
          <div class="group">
            <button class="btn" type="submit" data-intent="publicado">${isNew ? "Publicar" : p.status === "publicado" ? "Salvar" : "Salvar e publicar"}</button>
            <button class="btn btn-outline" type="submit" data-intent="rascunho">${p.status === "publicado" && !isNew ? "Ocultar (rascunho)" : "Salvar rascunho"}</button>
          </div>
          ${isNew ? "" : '<button class="btn btn-danger" type="button" data-delete>Excluir peça</button>'}
        </div>
      </form>`;
    document.body.appendChild(d);
    const opener = document.activeElement;
    const $ = s => d.querySelector(s);
    const picker = R.media.picker($("#pcFoto"), $("#pcPreview"), { onError: m => R.fieldError($("#pcFoto"), m) });
    let intent = "publicado";
    d.querySelectorAll("[data-intent]").forEach(b => b.addEventListener("click", () => { intent = b.dataset.intent; }));
    const close = () => { d.close(); };
    d.addEventListener("close", () => { d.remove(); opener?.focus?.(); if (location.hash.includes("/")) history.replaceState(null, "", "#pecas"); });
    $("[data-cancel]").addEventListener("click", close);

    $("#pieceForm").addEventListener("submit", async e => {
      e.preventDefault();
      const titulo = $("#pcTitulo").value.trim();
      const preco = $("#pcPreco").value === "" ? null : Number($("#pcPreco").value);
      if (!R.validate([
        [$("#pcFoto"), isNew && !picker.get() ? "Escolha uma foto da peça." : null],
        [$("#pcTitulo"), titulo.length < 2 ? "Dê um nome à peça." : null],
        [$("#pcPreco"), preco !== null && (isNaN(preco) || preco < 0) ? "Informe um preço válido." : null]
      ])) return;
      const st = $("#pcStatus");
      d.querySelectorAll("button").forEach(b => { b.disabled = true; });
      try {
        const payload = {
          titulo, preco, descricao: $("#pcDesc").value.trim() || null, alt_text: $("#pcAlt").value.trim() || null,
          tipo: $("#pcTipo").value || null, tamanho: $("#pcTam").value || null, condicao: $("#pcCond").value || null,
          estilo: $("#pcEstilo").value || null, genero: $("#pcGenero").value || null,
          disponivel: $("#pcDisp").checked, status: intent
        };
        const file = picker.get();
        if (file) {
          R.formStatus(st, "Enviando a foto…");
          const up = await R.media.upload("brechos", file, { max: 1600 });
          payload.imagem_url = up.url;
          payload.imagem_path = up.path;
        }
        R.formStatus(st, "Salvando…");
        const res = isNew
          ? await R.sb.from("publicacoes").insert({ ...payload, brecho_id: shop.id })
          : await R.sb.from("publicacoes").update(payload).eq("id", p.id);
        if (res.error) {
          if (file && payload.imagem_path) R.media.remove("brechos", payload.imagem_path);
          throw res.error;
        }
        if (!isNew && file && p.imagem_path) R.media.remove("brechos", p.imagem_path);
        R.toast(intent === "publicado" ? "Peça publicada no feed." : "Peça salva como rascunho.");
        close();
        D.go();
      } catch (err) {
        console.error("[Repeteco] peça:", err);
        R.formStatus(st, R.errorMessage(err, "Não foi possível salvar a peça."), true);
        d.querySelectorAll("button").forEach(b => { b.disabled = false; });
      }
    });

    $("[data-delete]")?.addEventListener("click", async () => {
      if (!(await D.confirm(`Excluir “${p.titulo}”? A foto e as curtidas da peça serão removidas.`, { confirmLabel: "Excluir peça" }))) return;
      const { error } = await R.sb.from("publicacoes").delete().eq("id", p.id);
      if (error) return R.toast(R.errorMessage(error), "error");
      if (p.imagem_path) R.media.remove("brechos", p.imagem_path);
      R.toast("Peça excluída.");
      close();
      D.go();
    });
    d.showModal();
    $("#pcFoto").focus();
  }

  /* ---------- perfil do brechó ---------- */
  D.route("perfil", {
    label: "Perfil do brechó",
    async render(el) {
      await loadShop();
      const b = shop;
      const cats = Array.isArray(b.categorias) ? b.categorias : [];
      const f = (id, label, value, attrs = "", hint = "") => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" value="${R.esc(value || "")}" ${attrs}${hint ? ` aria-describedby="${id}-dica"` : ""}>${hint ? `<p class="hint" id="${id}-dica">${hint}</p>` : ""}</div>`;
      el.innerHTML = `
        ${D.head("Perfil do brechó", "Estas informações aparecem na página pública, na busca e no mapa.", b.status === "approved" ? `<a class="btn btn-outline" href="${R.url(`brecho.html?b=${encodeURIComponent(b.slug || b.id)}`)}">Ver página pública</a>` : "")}
        ${banner()}
        <form id="shopForm" novalidate style="display:grid;gap:2.5rem">
          <section aria-labelledby="sIdent"><h2 id="sIdent" style="font-size:1.3rem;margin-bottom:1rem">Identidade</h2>
            <div class="form-grid">
              ${f("sNome", "Nome do brechó", b.nome, 'maxlength="80" required')}
              <div class="field full"><label for="sDesc">Apresentação</label><textarea class="textarea" id="sDesc" maxlength="1200">${R.esc(b.descricao || "")}</textarea></div>
            </div>
            <fieldset style="border:0;padding:0;margin:1rem 0 0"><legend class="label">Categorias</legend>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(10rem,1fr));gap:0 1rem">${V.categoriasBrecho.map(c => `<label class="check"><input type="checkbox" name="sCat" value="${R.esc(c)}"${cats.includes(c) ? " checked" : ""}> ${R.esc(c[0].toUpperCase() + c.slice(1))}</label>`).join("")}</div>
            </fieldset>
          </section>
          <section aria-labelledby="sImgs"><h2 id="sImgs" style="font-size:1.3rem;margin-bottom:1rem">Imagens</h2>
            <div class="form-grid">
              <div class="media-pair"><div class="image-preview square" id="sLogoPrev">${b.logo_url ? R.img(b.logo_url, "Logo atual") : "Sem logo"}</div><div class="field"><label for="sLogo">Logo</label><input class="input" id="sLogo" type="file"><p class="hint">Quadrada, de preferência.</p></div></div>
              <div class="media-pair"><div class="image-preview wide" id="sCapaPrev">${b.foto_capa ? R.img(b.foto_capa, "Capa atual") : "Sem capa"}</div><div class="field"><label for="sCapa">Foto de capa</label><input class="input" id="sCapa" type="file"><p class="hint">Fachada ou ambiente, na horizontal.</p></div></div>
            </div>
          </section>
          <section aria-labelledby="sContato"><h2 id="sContato" style="font-size:1.3rem;margin-bottom:1rem">Contato e horário</h2>
            <div class="form-grid">
              ${f("sWhats", "WhatsApp com DDD", b.whatsapp, 'type="tel" inputmode="tel"')}
              ${f("sInsta", "Instagram", b.instagram ? "@" + String(b.instagram).replace(/^@/, "") : "", 'placeholder="@seubrecho"')}
              ${f("sSite", "Site", b.site, 'type="url" placeholder="https://"')}
              ${f("sHorario", "Horário de funcionamento", b.horario, 'maxlength="120" placeholder="Ter a sáb, 11h às 19h"')}
            </div>
          </section>
          <section aria-labelledby="sLocal"><h2 id="sLocal" style="font-size:1.3rem;margin-bottom:1rem">Localização</h2>
            <div class="form-grid">
              ${f("sEndereco", "Endereço", b.endereco, 'autocomplete="street-address" placeholder="Rua, número"')}
              ${f("sBairro", "Bairro", b.bairro, "required")}
              ${f("sCidade", "Cidade", b.cidade || "São Paulo", "required")}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;margin-top:1rem">
              <button class="btn btn-outline btn-sm" type="button" id="sGeo">${R.icon("pin")} Localizar endereço no mapa</button>
              <span class="small muted" id="sGeoStatus" role="status">${R.map.hasCoords(b) ? "Posição salva. Arraste o marcador ou clique no mapa para ajustar." : "Ainda sem posição no mapa."}</span>
            </div>
            <div class="map-canvas location-map" id="sMap"></div>
            <p class="hint" style="margin-top:.5rem">O mapa é opcional para quem usa teclado: o endereço por escrito também aparece na página do brechó.</p>
          </section>
          <p class="form-status" id="sStatus"></p>
          <div><button class="btn" type="submit" id="sSave">Salvar perfil</button></div>
        </form>`;

      const $ = s => el.querySelector(s);
      const logo = R.media.picker($("#sLogo"), $("#sLogoPrev"), { onError: m => R.fieldError($("#sLogo"), m) });
      const capa = R.media.picker($("#sCapa"), $("#sCapaPrev"), { onError: m => R.fieldError($("#sCapa"), m) });
      let coords = R.map.hasCoords(b) ? { latitude: Number(b.latitude), longitude: Number(b.longitude), endereco_formatado: b.endereco_formatado } : null;

      const map = R.map.create($("#sMap"), { center: coords ? [coords.latitude, coords.longitude] : undefined, zoom: coords ? 16 : undefined });
      let pin = null;
      const placePin = (lat, lng) => {
        const onMove = (la, ln) => { coords = { ...(coords || {}), latitude: la, longitude: ln }; $("#sGeoStatus").textContent = "Posição ajustada. Salve para confirmar."; };
        if (!map) return;
        if (pin) { pin.setLatLng([lat, lng]); map.setView([lat, lng], 16); }
        else pin = R.map.editablePin(map, lat, lng, onMove);
      };
      if (coords) placePin(coords.latitude, coords.longitude);
      else map?.on("click", e => { placePin(e.latlng.lat, e.latlng.lng); coords = { latitude: e.latlng.lat, longitude: e.latlng.lng }; $("#sGeoStatus").textContent = "Posição marcada. Salve para confirmar."; });

      $("#sGeo").addEventListener("click", async () => {
        const btn = $("#sGeo");
        const q = [$("#sEndereco").value, $("#sBairro").value, $("#sCidade").value].filter(Boolean).join(", ");
        btn.disabled = true;
        $("#sGeoStatus").textContent = "Procurando endereço…";
        try {
          const g = await R.map.geocode(q);
          coords = g;
          placePin(g.latitude, g.longitude);
          $("#sGeoStatus").textContent = `Encontrado: ${g.endereco_formatado}. Confira o marcador e salve.`;
        } catch (err) {
          $("#sGeoStatus").textContent = err.message;
        } finally { btn.disabled = false; }
      });

      $("#shopForm").addEventListener("submit", async e => {
        e.preventDefault();
        const site = $("#sSite").value.trim();
        const wa = $("#sWhats").value.replace(/\D/g, "");
        if (!R.validate([
          [$("#sNome"), $("#sNome").value.trim().length < 2 ? "Informe o nome do brechó." : null],
          [$("#sBairro"), !$("#sBairro").value.trim() ? "Informe o bairro." : null],
          [$("#sCidade"), !$("#sCidade").value.trim() ? "Informe a cidade." : null],
          [$("#sWhats"), wa && wa.length < 10 ? "Informe o WhatsApp com DDD." : null],
          [$("#sSite"), site && !R.safeUrl(site.includes("://") ? site : "https://" + site) ? "Informe um endereço de site válido." : null]
        ])) return;
        const btn = $("#sSave"), st = $("#sStatus");
        btn.disabled = true;
        R.formStatus(st, "Salvando…");
        const uploaded = [];
        try {
          const payload = {
            nome: $("#sNome").value.trim(), descricao: $("#sDesc").value.trim() || null,
            categorias: R.$$('input[name="sCat"]:checked', el).map(i => i.value),
            whatsapp: wa || null, instagram: $("#sInsta").value.trim().replace(/^@/, "") || null,
            site: site ? (site.includes("://") ? site : "https://" + site) : null,
            horario: $("#sHorario").value.trim() || null,
            endereco: $("#sEndereco").value.trim() || null, bairro: $("#sBairro").value.trim(), cidade: $("#sCidade").value.trim()
          };
          if (coords) Object.assign(payload, { latitude: coords.latitude, longitude: coords.longitude, endereco_formatado: coords.endereco_formatado || null });
          if (logo.get()) { const up = await R.media.upload("brechos", logo.get(), { max: 600 }); payload.logo_url = up.url; uploaded.push(up.path); }
          if (capa.get()) { const up = await R.media.upload("brechos", capa.get(), { max: 2000 }); payload.foto_capa = up.url; uploaded.push(up.path); }
          const { error } = await R.sb.from("brechos").update(payload).eq("id", b.id);
          if (error) throw error;
          if (payload.logo_url && b.logo_url) R.media.remove("brechos", b.logo_url);
          if (payload.foto_capa && b.foto_capa) R.media.remove("brechos", b.foto_capa);
          await R.refreshProfile();
          R.toast(b.status === "rejected" ? "Dados salvos e reenviados para análise." : "Perfil do brechó atualizado.");
          D.go();
        } catch (err) {
          uploaded.forEach(path => R.media.remove("brechos", path));
          console.error("[Repeteco] perfil do brechó:", err);
          R.formStatus(st, R.errorMessage(err, "Não foi possível salvar."), true);
          btn.disabled = false;
        }
      });
    }
  });
})();
