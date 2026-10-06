/* =====================================================
   REPETECO — painel: rotas por hash, navegação e
   componentes (indicadores, gráficos, confirmações).
   ===================================================== */
(function () {
  const R = window.R;
  const D = (window.D = { routes: new Map(), groups: [] });
  const view = () => document.getElementById("view");

  // Registra uma seção: D.route("pecas", { group, label, render(el, arg) })
  D.route = (id, def) => D.routes.set(id, { id, ...def });

  D.buildNav = (groups) => {
    D.groups = groups;
    R.$("#panelNav").innerHTML = groups.map(g => `
      <h2>${R.esc(g.title)}</h2>
      <ul>${g.items.map(id => {
        const r = D.routes.get(id);
        return `<li><a href="#${id}" data-route="${id}">${R.esc(r.label)}<span class="badge" data-badge="${id}" hidden></span></a></li>`;
      }).join("")}</ul>`).join("");
  };

  D.badge = (id, n) => {
    const b = R.$(`[data-badge="${id}"]`);
    if (!b) return;
    b.hidden = !n;
    b.textContent = n || "";
    b.setAttribute("aria-label", `${n} pendente(s)`);
  };

  async function go() {
    const [id, arg] = decodeURIComponent(location.hash.slice(1)).split("/");
    const allowed = D.groups.flatMap(g => g.items);
    const target = allowed.includes(id) ? id : allowed[0];
    R.$$("[data-route]").forEach(a => {
      if (a.dataset.route === target) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const route = D.routes.get(target);
    // Nó novo a cada navegação: descarta os listeners da seção anterior.
    const old = view();
    const el = old.cloneNode(false);
    old.replaceWith(el);
    el.innerHTML = '<p class="muted">Carregando…</p>';
    document.title = `${route.label} — Painel — Repeteco`;
    try {
      await route.render(el, arg);
    } catch (e) {
      console.error("[Repeteco] painel:", e);
      el.innerHTML = R.render.state("error", "Esta seção não pôde ser carregada.", R.errorMessage(e), '<button class="btn" type="button" onclick="location.reload()">Recarregar</button>');
    }
    const h1 = el.querySelector("h1");
    if (D.started && h1) { h1.tabIndex = -1; h1.focus(); } // anuncia a nova seção ao leitor de tela
    D.started = true;
  }
  D.go = go;
  D.navigate = hash => { if (location.hash === `#${hash}`) go(); else location.hash = hash; };
  window.addEventListener("hashchange", go);

  /* ---------- componentes ---------- */
  D.head = (title, text = "", actions = "") =>
    `<div class="view-head"><div><h1>${R.esc(title)}</h1>${text ? `<p>${R.esc(text)}</p>` : ""}</div>${actions ? `<div style="display:flex;gap:.5rem;flex-wrap:wrap">${actions}</div>` : ""}</div>`;

  D.stats = items => `<dl class="stats">${items.map(s =>
    `<div class="stat"><dt>${R.esc(s.label)}</dt><dd>${s.href ? `<a href="${s.href}">${fmtN(s.value)}</a>` : fmtN(s.value)}${s.note ? `<span class="note">${R.esc(s.note)}</span>` : ""}</dd></div>`).join("")}</dl>`;
  const fmtN = v => (v === null || v === undefined) ? "—" : Number(v).toLocaleString("pt-BR");

  // Gráfico de barras de uma série, com dica no foco/hover e tabela de dados.
  D.bars = ({ title, points, unit = "", note = "" }) => {
    const max = Math.max(1, ...points.map(p => p.value));
    const total = points.reduce((a, p) => a + p.value, 0);
    const id = `c${Math.random().toString(36).slice(2, 8)}`;
    return `
      <figure class="chart" aria-labelledby="${id}">
        <figcaption><strong id="${id}">${R.esc(title)}</strong><span>${fmtN(total)} no período${note ? ` · ${R.esc(note)}` : ""}</span></figcaption>
        <div class="bars" role="list">
          ${points.map(p => `<div class="bar" role="listitem" tabindex="0" aria-label="${R.esc(p.label)}: ${fmtN(p.value)} ${R.esc(unit)}">
            <i style="height:${(p.value / max) * 100}%"></i><span class="tip" aria-hidden="true">${R.esc(p.label)} · ${fmtN(p.value)}</span></div>`).join("")}
        </div>
        <div class="bar-axis" aria-hidden="true"><span>${R.esc(points[0]?.label || "")}</span><span>máx. ${fmtN(max)}</span><span>${R.esc(points[points.length - 1]?.label || "")}</span></div>
        <details><summary>Ver dados em tabela</summary>
          <table class="dtable"><thead><tr><th scope="col">Período</th><th scope="col">${R.esc(unit || "Total")}</th></tr></thead>
          <tbody>${points.map(p => `<tr><td>${R.esc(p.label)}</td><td>${fmtN(p.value)}</td></tr>`).join("")}</tbody></table>
        </details>
      </figure>`;
  };

  D.dayLabel = iso => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  // Confirmação acessível para ações destrutivas.
  D.confirm = (message, { confirmLabel = "Confirmar", danger = true } = {}) => new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "sheet";
    d.setAttribute("aria-labelledby", "confirmTitle");
    d.innerHTML = `<div class="sheet-head"><h2 id="confirmTitle">Confirmar</h2></div>
      <div class="sheet-body"><p>${R.esc(message)}</p>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap">
        <button class="btn btn-outline" type="button" value="no">Cancelar</button>
        <button class="btn ${danger ? "btn-danger" : ""}" type="button" value="yes">${R.esc(confirmLabel)}</button></div></div>`;
    document.body.appendChild(d);
    const opener = document.activeElement;
    d.addEventListener("click", e => { const b = e.target.closest("button[value]"); if (b) d.close(b.value); });
    d.addEventListener("close", () => { resolve(d.returnValue === "yes"); d.remove(); opener?.focus?.(); });
    d.showModal();
    d.querySelector('button[value="no"]').focus();
  });

  D.statusLabel = s => ({ pending: "Em análise", approved: "Aprovado", rejected: "Recusado", publicado: "Publicado", rascunho: "Rascunho" }[s] || s);
  D.statusTag = s => `<span class="status ${R.esc(s)}">${R.esc(D.statusLabel(s))}</span>`;
})();
