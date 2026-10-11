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
            <div class="charts" style="grid-template-columns:1fr;margin-bottom:1rem">${D.bars({ title: "Visitas por dia", points: days, unit: "visitas", note: "últimos 14 dias" })}</div>
            <h2 style="margin-bottom:.75rem">Peças com mais interesse</h2>
            ${(s.top_publicacoes || []).length ? `<div class="table-wrap"><table class="dtable"><thead><tr><th scope="col">Peça</th><th scope="col">Curtidas</th><th scope="col">Salvos</th></tr></thead><tbody>
              ${s.top_publicacoes.map(p => `<tr><td><a class="link" href="#pecas/${p.id}">${R.esc(p.titulo)}</a></td><td>${p.curtidas}</td><td>${p.salvos}</td></tr>`).join("")}
            </tbody></table></div>` : '<p class="muted">Publique peças para acompanhar quais chamam mais atenção.</p>'}
          </div>
          <section class="panel-card" aria-labelledby="checkTitle">
            <h2 id="checkTitle">Perfil completo: ${done} de ${checks.length}</h2>
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
            <div class="tile-media">${R.img(p.thumb_url || p.imagem_url, p.alt_text || p.titulo)}${(p.imagens || []).length > 1 ? `<span class="multi-flag">${R.icon("stack")}<span class="visually-hidden">${p.imagens.length} fotos</span></span>` : ""}</div>
            <h3>${R.esc(p.titulo)}</h3>
            <div class="meta">${D.statusTag(p.status)}<span>${R.render.priceHtml(p)}</span>${p.disponivel ? "" : "<span>Vendida</span>"}</div>
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

  const openEditor = p => D.openPieceEditor(p, shop, () => D.go());

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
        <div class="shop-editor"><form id="shopForm" novalidate style="display:grid;gap:1rem">
          <section class="panel-card" aria-labelledby="sIdent"><h2 id="sIdent" style="margin-bottom:1rem">Identidade</h2>
            <div class="form-grid">
              ${f("sNome", "Nome do brechó", b.nome, 'maxlength="80" required')}
              <div class="field full"><label for="sDesc">Apresentação</label><textarea class="textarea" id="sDesc" maxlength="1200">${R.esc(b.descricao || "")}</textarea></div>
            </div>
            <fieldset style="border:0;padding:0;margin:1rem 0 0"><legend class="label">Categorias</legend>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(10rem,1fr));gap:0 1rem">${V.categoriasBrecho.map(c => `<label class="check"><input type="checkbox" name="sCat" value="${R.esc(c)}"${cats.includes(c) ? " checked" : ""}> ${R.esc(c[0].toUpperCase() + c.slice(1))}</label>`).join("")}</div>
            </fieldset>
          </section>
          <section class="panel-card" aria-labelledby="sImgs"><h2 id="sImgs" style="margin-bottom:1rem">Imagens</h2>
            <div class="form-grid">
              <div class="media-pair"><div class="image-preview square" id="sLogoPrev">${b.logo_url ? R.img(b.logo_url, "Logo atual") : "Sem logo"}</div><div class="field"><label for="sLogo">Logo</label><input class="input" id="sLogo" type="file"><p class="hint">Quadrada, de preferência.</p></div></div>
              <div class="media-pair"><div class="image-preview wide" id="sCapaPrev">${b.foto_capa ? R.img(b.foto_capa, "Capa atual") : "Sem capa"}</div><div class="field"><label for="sCapa">Foto de capa</label><input class="input" id="sCapa" type="file"><p class="hint">Fachada ou ambiente, na horizontal.</p></div></div>
            </div>
          </section>
          <section class="panel-card" aria-labelledby="sContato"><h2 id="sContato" style="margin-bottom:1rem">Contato e horário</h2>
            <div class="form-grid">
              ${f("sWhats", "WhatsApp com DDD", b.whatsapp, 'type="tel" inputmode="tel"')}
              ${f("sInsta", "Instagram", b.instagram ? "@" + String(b.instagram).replace(/^@/, "") : "", 'placeholder="@seubrecho"')}
              ${f("sSite", "Site", b.site, 'type="url" placeholder="https://"')}
              ${f("sHorario", "Horário de funcionamento", b.horario, 'maxlength="120" placeholder="Ter a sáb, 11h às 19h"')}
            </div>
          </section>
          <section class="panel-card" aria-labelledby="sLocal"><h2 id="sLocal" style="margin-bottom:1rem">Atendimento e localização</h2>
            <fieldset style="border:0;padding:0;margin:0 0 1rem"><legend class="label">Como o brechó atende</legend>
              <div class="pill-tabs" style="justify-content:flex-start">${Object.entries(V.modalidades).map(([v, l]) => `<label class="check"><input type="radio" name="sModo" value="${v}"${(b.modalidade || "fisica") === v ? " checked" : ""}> ${l}</label>`).join("")}</div>
            </fieldset>
            <div class="form-grid" id="sOnlineWrap">
              ${f("sLoja", "Link da loja online", b.loja_online_url, 'type="url" placeholder="https://"', "Site de vendas, catálogo ou perfil onde as pessoas compram.").replace('class="field"', 'class="field full"')}
            </div>
            <div id="sAddrWrap">
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
            </div>
            <p class="hint" id="sOnlineNote" hidden>Brechós só online não aparecem no mapa; ficam na lista de brechós, na busca e no feed.</p>
          </section>
          <p class="form-status" id="sStatus"></p>
          <div><button class="btn" type="submit" id="sSave">Salvar alterações</button></div>
        </form>
        <aside class="shop-preview" aria-labelledby="pvTitle">
          <p id="pvTitle">prévia — card no site</p>
          <div class="preview-card" id="shopPreview"></div>
          <p class="note">A prévia muda enquanto você edita. Salve para publicar.</p>
        </aside></div>`;

      const $ = s => el.querySelector(s);
      const modo = () => el.querySelector('input[name="sModo"]:checked')?.value || "fisica";
      let map = null;
      const syncModo = () => {
        const m = modo();
        $("#sOnlineWrap").hidden = m === "fisica";
        $("#sAddrWrap").hidden = m === "online";
        $("#sOnlineNote").hidden = m !== "online";
        $("#sBairro").required = m !== "online";
        if (m !== "online") setTimeout(() => map?.invalidateSize(), 50);
      };
      el.querySelectorAll('input[name="sModo"]').forEach(r => r.addEventListener("change", syncModo));
      const preview = () => {
        const cover = $("#sCapaPrev img")?.getAttribute("src");
        const cat = R.$$('input[name="sCat"]:checked', el)[0]?.value;
        $("#shopPreview").innerHTML = `
          <div class="pc-cover">${cover ? `<img src="${R.esc(cover)}" alt="">` : "foto de capa"}</div>
          <div class="pc-body">
            <span class="pc-name">${R.esc($("#sNome").value || "Seu brechó")}</span>
            ${cat ? `<span class="tag" style="justify-self:start">${R.esc(cat)}</span>` : ""}
            <span class="pc-place">${R.esc(R.fmt.place($("#sBairro").value, $("#sCidade").value) || "Bairro, cidade")}</span>
            <span class="btn btn-sm" aria-hidden="true">ver no mapa</span>
          </div>`;
      };
      el.addEventListener("input", R.debounce(preview, 120));
      el.addEventListener("change", () => setTimeout(preview, 50));
      const logo = R.media.picker($("#sLogo"), $("#sLogoPrev"), { aspect: 1, onError: m => R.fieldError($("#sLogo"), m) });
      const capa = R.media.picker($("#sCapa"), $("#sCapaPrev"), { aspect: 16 / 9, onError: m => R.fieldError($("#sCapa"), m) });
      let coords = R.map.hasCoords(b) ? { latitude: Number(b.latitude), longitude: Number(b.longitude), endereco_formatado: b.endereco_formatado } : null;

      preview();
      map = R.map.create($("#sMap"), { center: coords ? [coords.latitude, coords.longitude] : undefined, zoom: coords ? 16 : undefined });
      let pin = null;
      const placePin = (lat, lng) => {
        const onMove = (la, ln) => { coords = { ...(coords || {}), latitude: la, longitude: ln }; $("#sGeoStatus").textContent = "Posição ajustada. Salve para confirmar."; };
        if (!map) return;
        if (pin) { pin.setLatLng([lat, lng]); map.setView([lat, lng], 16); }
        else pin = R.map.editablePin(map, lat, lng, onMove);
      };
      syncModo();
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
        const m = modo();
        const lojaRaw = $("#sLoja").value.trim();
        const loja = lojaRaw ? (lojaRaw.includes("://") ? lojaRaw : "https://" + lojaRaw) : "";
        const wa = $("#sWhats").value.replace(/\D/g, "");
        if (!R.validate([
          [$("#sNome"), $("#sNome").value.trim().length < 2 ? "Informe o nome do brechó." : null],
          [$("#sBairro"), m !== "online" && !$("#sBairro").value.trim() ? "Informe o bairro." : null],
          [$("#sLoja"), loja && !R.safeUrl(loja) ? "Informe um link válido." : m === "online" && !loja && !site && !$("#sInsta").value.trim() ? "Brechó online precisa de um link de loja, site ou Instagram." : null],
          [$("#sCidade"), m !== "online" && !$("#sCidade").value.trim() ? "Informe a cidade." : null],
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
            modalidade: m, loja_online_url: m === "fisica" ? null : (loja || null),
            endereco: $("#sEndereco").value.trim() || null, bairro: $("#sBairro").value.trim() || null, cidade: $("#sCidade").value.trim() || null
          };
          if (coords && m !== "online") Object.assign(payload, { latitude: coords.latitude, longitude: coords.longitude, endereco_formatado: coords.endereco_formatado || null });
          if (logo.get()) { const up = await R.media.upload("brechos", logo.get(), { max: 400, maxBytes: 60 * 1024 }); payload.logo_url = up.url; uploaded.push(up.path); }
          if (capa.get()) { const up = await R.media.upload("brechos", capa.get(), { max: 1600, maxBytes: 220 * 1024 }); payload.foto_capa = up.url; uploaded.push(up.path); }
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
