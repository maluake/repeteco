/* =====================================================
   REPETECO — horário de funcionamento por dia da semana.

   Formato salvo em brechos.horarios (jsonb, opcional, v11):
   lista de 7 itens, de domingo (0) a sábado (6); cada item é
   {"abre": "11:00", "fecha": "19:00"} ou null (fechado).
   Fechamento depois da meia-noite ("fecha" menor que "abre") vale
   até a madrugada do dia seguinte.

   O texto livre antigo (brechos.horario) continua existindo como
   observação ("fechado em feriados", "só com agendamento"…).
   ===================================================== */
(function () {
  const R = window.R;
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

  // Aceita qualquer coisa vinda do banco e devolve 7 itens válidos (ou null se não houver horário).
  function normalize(h) {
    if (!Array.isArray(h) || h.length !== 7) return null;
    const out = h.map(d => (d && HHMM.test(d.abre) && HHMM.test(d.fecha) && d.abre !== d.fecha ? { abre: d.abre, fecha: d.fecha } : null));
    return out.some(Boolean) ? out : null;
  }

  const min = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const hora = s => (s.endsWith(":00") ? `${Number(s.slice(0, 2))}h` : `${Number(s.slice(0, 2))}h${s.slice(3)}`);

  // Dia da semana e minutos no fuso de São Paulo, independente do fuso do aparelho.
  function agoraSP(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = t => parts.find(p => p.type === t)?.value;
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { dia, min: Number(get("hour")) * 60 + Number(get("minute")) };
  }

  // { aberto, texto } — ex.: "Aberto agora · fecha às 19h", "Fechado agora · abre amanhã às 11h".
  function status(h, now) {
    const H = normalize(h);
    if (!H) return null;
    const { dia, min: m } = agoraSP(now);
    const hoje = H[dia], ontem = H[(dia + 6) % 7];
    // Ainda dentro do horário de ontem que passou da meia-noite.
    if (ontem && min(ontem.fecha) < min(ontem.abre) && m < min(ontem.fecha)) return { aberto: true, texto: `Aberto agora · fecha às ${hora(ontem.fecha)}` };
    if (hoje) {
      const a = min(hoje.abre), f = min(hoje.fecha);
      const vira = f < a;
      if (m >= a && (vira || m < f)) return { aberto: true, texto: `Aberto agora · fecha às ${hora(hoje.fecha)}` };
      if (m < a) return { aberto: false, texto: `Fechado agora · abre hoje às ${hora(hoje.abre)}` };
    }
    for (let i = 1; i <= 7; i++) {
      const d = H[(dia + i) % 7];
      if (d) return { aberto: false, texto: `Fechado agora · abre ${i === 1 ? "amanhã" : DIAS[(dia + i) % 7]} às ${hora(d.abre)}` };
    }
    return null;
  }

  // Linhas agrupando dias seguidos com o mesmo horário, começando na segunda.
  function linhas(h) {
    const H = normalize(h);
    if (!H) return [];
    const ordem = [1, 2, 3, 4, 5, 6, 0];
    const grupos = [];
    for (const d of ordem) {
      const v = H[d], chave = v ? `${v.abre}-${v.fecha}` : "fechado";
      const ult = grupos[grupos.length - 1];
      if (ult && ult.chave === chave) ult.dias.push(d); else grupos.push({ chave, dias: [d], v });
    }
    const cap = t => t[0].toUpperCase() + t.slice(1);
    return grupos.map(g => ({
      dias: cap(g.dias.length > 2 ? `${CURTO[g.dias[0]]} a ${CURTO[g.dias[g.dias.length - 1]]}` : g.dias.map(d => CURTO[d]).join(" e ")),
      horario: g.v ? `${hora(g.v.abre)} às ${hora(g.v.fecha)}` : "fechado"
    }));
  }

  /* ---------- editor (painel do dono) ---------- */
  function editorHtml(h) {
    const H = normalize(h) || Array(7).fill(null);
    const row = d => {
      const v = H[d];
      return `<div class="hours-row" data-dia="${d}">
        <label class="check"><input type="checkbox" data-aberto${v ? " checked" : ""}> ${DIAS[d][0].toUpperCase() + DIAS[d].slice(1)}</label>
        <label class="visually-hidden" for="hAbre${d}">Abre (${DIAS[d]})</label><input class="input" type="time" id="hAbre${d}" data-abre value="${v ? v.abre : "11:00"}"${v ? "" : " disabled"}>
        <span aria-hidden="true">às</span>
        <label class="visually-hidden" for="hFecha${d}">Fecha (${DIAS[d]})</label><input class="input" type="time" id="hFecha${d}" data-fecha value="${v ? v.fecha : "19:00"}"${v ? "" : " disabled"}>
      </div>`;
    };
    return `<fieldset class="hours-editor"><legend class="label">Dias e horários</legend>
      <p class="hint" style="margin:0 0 .5rem">Marque os dias em que o brechó abre. A página mostra se está aberto agora.</p>
      ${[1, 2, 3, 4, 5, 6, 0].map(row).join("")}
      <button class="btn btn-ghost btn-sm" type="button" data-copiar-horario>Copiar o horário de segunda para os dias marcados</button>
    </fieldset>`;
  }

  function bindEditor(root) {
    root.addEventListener("change", e => {
      const cb = e.target.closest("[data-aberto]");
      if (!cb) return;
      const row = cb.closest(".hours-row");
      row.querySelectorAll("input[type=time]").forEach(i => { i.disabled = !cb.checked; });
    });
    root.querySelector("[data-copiar-horario]")?.addEventListener("click", () => {
      const seg = root.querySelector('.hours-row[data-dia="1"]');
      const abre = seg.querySelector("[data-abre]").value, fecha = seg.querySelector("[data-fecha]").value;
      root.querySelectorAll(".hours-row").forEach(r => {
        if (!r.querySelector("[data-aberto]").checked) return;
        r.querySelector("[data-abre]").value = abre;
        r.querySelector("[data-fecha]").value = fecha;
      });
    });
  }

  // Lê o editor: { valor, erro } — valor é a lista de 7 ou null se nenhum dia marcado.
  function readEditor(root) {
    const out = Array(7).fill(null);
    for (const r of root.querySelectorAll(".hours-row")) {
      if (!r.querySelector("[data-aberto]").checked) continue;
      const d = Number(r.dataset.dia);
      const abre = r.querySelector("[data-abre]").value, fecha = r.querySelector("[data-fecha]").value;
      if (!HHMM.test(abre) || !HHMM.test(fecha) || abre === fecha) return { erro: `Confira o horário de ${DIAS[d]}.`, campo: r.querySelector("[data-abre]") };
      out[d] = { abre, fecha };
    }
    return { valor: out.some(Boolean) ? out : null };
  }

  R.horarios = { normalize, status, linhas, editorHtml, bindEditor, readEditor, agoraSP };
})();
