/* =====================================================
   REPETECO — busca com filtros combináveis
   Estado no URL (compartilhável). Toda mudança gera uma
   nova consulta ao Supabase; nada é filtrado só na tela.
   ===================================================== */
(function () {
  const R = window.R;
  const V = R.vocab;
  const PAGE = 24;
  const form = R.$("#filtersForm");
  const qInput = R.$("#q");
  const results = R.$("#results");
  const statusEl = R.$("#resultsStatus");
  const chips = R.$("#activeFilters");
  const moreWrap = R.$("#resultsMore");
  const moreBtn = R.$("#resultsMoreBtn");
  const MULTI = ["bairro", "cidade", "tipo", "tam", "condicao", "estilo", "genero"];
  const PIECE_KEYS = ["tipo", "tam", "preco_max", "condicao", "estilo", "genero", "disp"];
  let offset = 0;
  let runId = 0;

  // ---------- estado <-> URL ----------
  function readState() {
    const p = R.params();
    const s = { q: p.get("q") || "", modo: p.get("tipo_busca") === "brechos" ? "brechos" : "pecas", ordem: p.get("ordem") || "", preco_max: p.get("preco_max") || "", disp: p.get("disp") === "1", cat: p.get("cat") || "" };
    MULTI.forEach(k => { s[k] = p.getAll(k).filter(Boolean); });
    return s;
  }
  function writeState(s) {
    const p = new URLSearchParams();
    if (s.q) p.set("q", s.q);
    if (s.modo === "brechos") p.set("tipo_busca", "brechos");
    MULTI.forEach(k => s[k].forEach(v => p.append(k, v)));
    if (s.preco_max) p.set("preco_max", s.preco_max);
    if (s.disp) p.set("disp", "1");
    if (s.cat) p.set("cat", s.cat);
    if (s.ordem) p.set("ordem", s.ordem);
    history.replaceState(null, "", `${location.pathname}${p.toString() ? "?" + p : ""}`);
  }
  function formToState() {
    const fd = new FormData(form);
    const s = { q: qInput.value.trim(), modo: R.$('input[name="tipo_busca"]:checked')?.value || "pecas", ordem: R.$("#ordem").value, preco_max: fd.get("preco_max") || "", disp: fd.get("disp") === "1", cat: fd.get("cat") || "" };
    MULTI.forEach(k => { s[k] = fd.getAll(k); });
    return s;
  }
  function stateToForm(s) {
    qInput.value = s.q;
    R.$$('input[name="tipo_busca"]').forEach(r => { r.checked = r.value === s.modo; });
    R.$("#ordem").value = s.ordem;
    R.$$("input", form).forEach(i => {
      if (MULTI.includes(i.name)) i.checked = s[i.name].includes(i.value);
      if (i.name === "preco_max" || i.name === "cat") i.checked = (s[i.name] || "") === i.value;
      if (i.name === "disp") i.checked = s.disp;
    });
    syncModeUI(s.modo);
    // Grupos recolhidos abrem sozinhos quando têm filtro ativo.
    R.$$("details.filter-group", form).forEach(d => { if (d.querySelector('input:checked:not([value=""])')) d.open = true; });
  }

  // ---------- opções de filtro ----------
  const checks = (name, items) => items.map(({ value, label }) =>
    `<label class="check"><input type="checkbox" name="${name}" value="${R.esc(value)}"> ${R.esc(label)}</label>`).join("");
  const radios = (name, items, anyLabel) =>
    `<label class="check"><input type="radio" name="${name}" value=""> ${anyLabel}</label>` +
    items.map(({ value, label }) => `<label class="check"><input type="radio" name="${name}" value="${R.esc(value)}"> ${R.esc(label)}</label>`).join("");

  async function buildFilters(s) {
    const { data } = await R.sb.from("brechos_publicos").select("bairro, cidade").limit(2000);
    const uniq = arr => [...new Set(arr.filter(Boolean).map(x => x.trim()))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const bairros = uniq([...(data || []).map(b => b.bairro), ...s.bairro]);
    const cidades = uniq([...(data || []).map(b => b.cidade), ...s.cidade]);
    R.$("#fBairro").innerHTML = bairros.length ? checks("bairro", bairros.map(v => ({ value: v, label: v }))) : '<p class="small muted">Nenhum bairro cadastrado ainda.</p>';
    R.$("#fCidade").innerHTML = checks("cidade", cidades.map(v => ({ value: v, label: v })));
    R.$("#fCat").innerHTML = radios("cat", V.categoriasBrecho.map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })), "Todas");
    R.$("#fTipo").innerHTML = checks("tipo", R.vocab.list(V.tipos));
    R.$("#fTam").innerHTML = `<div class="size-grid">${V.tamanhos.map(t => `<label><input type="checkbox" name="tam" value="${t}"><span>${t}</span></label>`).join("")}</div>`;
    R.$("#fPreco").innerHTML = radios("preco_max", V.precos, "Qualquer preço");
    R.$("#fCondicao").innerHTML = checks("condicao", R.vocab.list(V.condicoes));
    R.$("#fEstilo").innerHTML = checks("estilo", R.vocab.list(V.estilos));
    R.$("#fGenero").innerHTML = checks("genero", R.vocab.list(V.generos));
  }

  function syncModeUI(modo) {
    R.$("#ordem").innerHTML = modo === "brechos"
      ? '<option value="">Mais recentes</option><option value="nome">Nome (A–Z)</option>'
      : '<option value="">Mais recentes</option><option value="preco_asc">Menor preço</option><option value="preco_desc">Maior preço</option>';
    const s = R.params().get("ordem") || "";
    if ([...R.$("#ordem").options].some(o => o.value === s)) R.$("#ordem").value = s;
    R.$("#pieceFiltersNote").hidden = modo !== "brechos";
  }

  // ---------- consultas ----------
  const clean = q => q.replace(/[,()*%:"\\]/g, " ").replace(/\s+/g, " ").trim();
  const hasPieceFilters = s => PIECE_KEYS.some(k => Array.isArray(s[k]) ? s[k].length : !!s[k]);

  function applyPieceFilters(q, s) {
    if (s.tipo.length) q = q.in("tipo", s.tipo);
    if (s.tam.length) q = q.in("tamanho", s.tam);
    if (s.condicao.length) q = q.in("condicao", s.condicao);
    if (s.estilo.length) q = q.in("estilo", s.estilo);
    if (s.genero.length) q = q.in("genero", s.genero);
    if (s.preco_max) q = q.lte("preco", Number(s.preco_max));
    if (s.disp) q = q.eq("disponivel", true);
    return q;
  }

  async function brechoIdsByCategory(cat) {
    const { data, error } = await R.sb.from("brechos_publicos").select("id").filter("categorias", "cs", JSON.stringify([cat])).limit(2000);
    if (error) throw error;
    return data.map(d => d.id);
  }

  async function queryPieces(s, from) {
    let q = R.sb.from("feed_publicacoes").select("*", { count: "exact" });
    const term = clean(s.q);
    if (term) q = q.or(`titulo.ilike.*${term}*,descricao.ilike.*${term}*,brecho_nome.ilike.*${term}*,bairro.ilike.*${term}*`);
    if (s.bairro.length) q = q.in("bairro", s.bairro);
    if (s.cidade.length) q = q.in("cidade", s.cidade);
    if (s.cat) q = q.in("brecho_id", (await brechoIdsByCategory(s.cat)).concat(["00000000-0000-0000-0000-000000000000"]));
    q = applyPieceFilters(q, s);
    if (s.ordem === "preco_asc") q = q.order("preco", { ascending: true, nullsFirst: false });
    else if (s.ordem === "preco_desc") q = q.order("preco", { ascending: false, nullsFirst: false });
    else q = q.order("created_at", { ascending: false });
    return q.range(from, from + PAGE - 1);
  }

  async function queryShops(s, from) {
    let q = R.sb.from("brechos_publicos").select("*", { count: "exact" });
    const term = clean(s.q);
    if (term) q = q.or(`nome.ilike.*${term}*,descricao.ilike.*${term}*,bairro.ilike.*${term}*`);
    if (s.bairro.length) q = q.in("bairro", s.bairro);
    if (s.cidade.length) q = q.in("cidade", s.cidade);
    if (s.cat) q = q.filter("categorias", "cs", JSON.stringify([s.cat]));
    if (hasPieceFilters(s)) {
      // Brechós que têm ao menos uma peça publicada com os atributos escolhidos.
      const sub = await applyPieceFilters(R.sb.from("feed_publicacoes").select("brecho_id"), s).limit(5000);
      if (sub.error) throw sub.error;
      const ids = [...new Set(sub.data.map(r => r.brecho_id))];
      q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    q = s.ordem === "nome" ? q.order("nome", { ascending: true }) : q.order("created_at", { ascending: false });
    return q.range(from, from + PAGE - 1);
  }

  // ---------- chips de filtros ativos ----------
  function chipList(s) {
    const out = [];
    if (s.q) out.push(["q", "", `“${s.q}”`]);
    s.bairro.forEach(v => out.push(["bairro", v, v]));
    s.cidade.forEach(v => out.push(["cidade", v, v]));
    if (s.cat) out.push(["cat", s.cat, `Categoria: ${s.cat}`]);
    s.tipo.forEach(v => out.push(["tipo", v, R.label("tipos", v)]));
    s.tam.forEach(v => out.push(["tam", v, `Tam. ${v}`]));
    if (s.preco_max) out.push(["preco_max", s.preco_max, `Até ${R.fmt.price(s.preco_max)}`]);
    s.condicao.forEach(v => out.push(["condicao", v, R.label("condicoes", v)]));
    s.estilo.forEach(v => out.push(["estilo", v, R.label("estilos", v)]));
    s.genero.forEach(v => out.push(["genero", v, R.label("generos", v)]));
    if (s.disp) out.push(["disp", "1", "Disponíveis"]);
    return out;
  }
  function renderChips(s) {
    const list = chipList(s);
    R.$("#filterCount").textContent = list.filter(c => c[0] !== "q").length ? ` (${list.filter(c => c[0] !== "q").length})` : "";
    chips.innerHTML = list.length
      ? list.map(([k, v, label]) => `<li class="chip">${R.esc(label)}<button type="button" data-remove="${k}" data-value="${R.esc(v)}" aria-label="Remover filtro ${R.esc(label)}">${R.icon("close")}</button></li>`).join("")
        + '<li><button class="btn btn-ghost btn-sm" type="button" id="clearAll">Limpar tudo</button></li>'
      : "";
  }

  // ---------- execução ----------
  async function run(reset = true) {
    const s = formToState();
    const id = ++runId;
    if (reset) {
      writeState(s);
      renderChips(s);
      offset = 0;
      results.setAttribute("aria-busy", "true");
      results.innerHTML = s.modo === "pecas" ? `<div class="tile-grid contained">${R.render.skeletonTiles(6)}</div>` : '<p class="muted">Buscando brechós…</p>';
      moreWrap.hidden = true;
      R.seo({ title: s.q ? `Busca: ${s.q}` : (s.modo === "brechos" ? "Buscar brechós" : "Buscar peças") });
    } else {
      moreBtn.disabled = true;
    }
    let res;
    try {
      res = s.modo === "brechos" ? await queryShops(s, offset) : await queryPieces(s, offset);
    } catch (e) { res = { error: e }; }
    if (id !== runId) return; // uma busca mais nova já começou
    results.setAttribute("aria-busy", "false");
    moreBtn.disabled = false;

    if (res.error) {
      console.error("[Repeteco] busca:", res.error);
      results.innerHTML = R.render.state("error", "A busca não funcionou agora.", R.errorMessage(res.error), '<button class="btn" type="button" data-retry>Tentar de novo</button>');
      statusEl.textContent = "Erro na busca.";
      return;
    }
    const rows = res.data || [];
    const total = res.count ?? rows.length;
    const noun = s.modo === "brechos" ? ["brechó encontrado", "brechós encontrados"] : ["peça encontrada", "peças encontradas"];
    R.$("#resultsCount").textContent = R.fmt.count(total, noun[0], noun[1]);
    statusEl.textContent = `${R.fmt.count(total, noun[0], noun[1])}.`;

    if (reset && !rows.length) {
      results.innerHTML = R.render.state("empty", "Nada por aqui com esses filtros.", "Tente remover algum filtro ou buscar por outro termo.",
        chipList(s).length ? '<button class="btn btn-outline" type="button" data-clear>Limpar filtros</button>' : "");
      return;
    }
    const html = s.modo === "brechos" ? rows.map(b => R.render.brechoRow(b)).join("") : rows.map(p => R.render.tile(p)).join("");
    if (reset) results.innerHTML = s.modo === "brechos" ? `<div class="shop-list">${html}</div>` : `<div class="tile-grid contained">${html}</div>`;
    else results.firstElementChild.insertAdjacentHTML("beforeend", html);
    R.interactions.sync(results);
    offset += rows.length;
    moreWrap.hidden = offset >= total;
  }

  function clearAll() {
    qInput.value = "";
    R.$$("input", form).forEach(i => { if (i.type === "checkbox") i.checked = false; if (i.type === "radio") i.checked = i.value === ""; });
    run();
  }

  // ---------- eventos ----------
  R.$("#searchForm").addEventListener("submit", e => { e.preventDefault(); run(); });
  form.addEventListener("change", () => run());
  R.$("#ordem").addEventListener("change", () => run());
  R.$$('input[name="tipo_busca"]').forEach(r => r.addEventListener("change", () => { syncModeUI(r.value); run(); }));
  moreBtn.addEventListener("click", () => run(false));
  document.addEventListener("click", e => {
    const rm = e.target.closest("[data-remove]");
    if (rm) {
      const { remove: k, value: v } = rm.dataset;
      if (k === "q") qInput.value = "";
      else R.$$(`input[name="${k}"]`, form).forEach(i => {
        if (i.type === "radio") i.checked = i.value === "";
        else if (i.value === v) i.checked = false;
      });
      run();
      setTimeout(() => (R.$("#activeFilters [data-remove]") || qInput).focus(), 0);
    }
    if (e.target.closest("#clearAll, [data-clear]")) { clearAll(); qInput.focus(); }
    if (e.target.closest("[data-retry]")) run();
  });

  // Filtros em painel no celular: o mesmo formulário é movido para o diálogo.
  const dialog = R.$("#filtersDialog");
  const aside = R.$("#filtersAside");
  R.$("#openFilters").addEventListener("click", () => {
    R.$("#filtersDialogBody").appendChild(form);
    dialog.showModal();
  });
  R.$$("[data-close-filters]").forEach(b => b.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("close", () => { aside.appendChild(form); R.$("#openFilters").focus(); });

  // ---------- início ----------
  (async () => {
    if (!R.sb) { results.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
    const s = readState();
    await buildFilters(s);
    stateToForm(s);
    run();
  })();
})();
