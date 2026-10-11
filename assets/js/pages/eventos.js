/* REPETECO — agenda de eventos organizados pela equipe (tabela eventos) */
(function () {
  const R = window.R;
  const up = R.$("#upcomingList");
  const past = R.$("#pastList");

  async function run() {
    const agora = new Date(Date.now() - 86400000).toISOString();
    // Próximos: ainda não terminaram. Passados: os mais recentes primeiro.
    const [prox, ant] = await Promise.all([
      R.sb.from("eventos").select("*").eq("status", "publicado").or(`data_fim.gte.${agora},and(data_fim.is.null,data_inicio.gte.${agora})`).order("data_inicio", { ascending: true }).limit(50),
      R.sb.from("eventos").select("*").eq("status", "publicado").lt("data_inicio", agora).order("data_inicio", { ascending: false }).limit(12)
    ]);
    up.setAttribute("aria-busy", "false");
    if (prox.error) {
      up.innerHTML = R.render.state("error", "Não conseguimos carregar a agenda.", R.errorMessage(prox.error), '<button class="btn" type="button" onclick="location.reload()">tentar de novo</button>');
      return;
    }
    up.innerHTML = prox.data.length
      ? prox.data.map(e => R.render.eventCard(e)).join("")
      : R.render.state("empty", "Nenhum evento marcado por enquanto.", "Novas feiras, bazares e encontros aparecem aqui assim que forem confirmados.");
    const passados = (ant.data || []).filter(e => !prox.data.some(p => p.id === e.id));
    if (passados.length) {
      past.innerHTML = passados.map(e => R.render.eventCard(e, { heading: "h3" })).join("");
      R.$("#pastSection").hidden = false;
    }
  }

  if (!R.sb) { up.innerHTML = R.render.state("error", "Não foi possível conectar ao Repeteco."); return; }
  run();
})();
