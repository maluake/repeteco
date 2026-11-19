/* =====================================================
   REPETECO — armazenamento (somente admin): espaço usado por
   bucket, maiores arquivos e limpeza de arquivos sem uso.
   A lista vem de admin_uso_armazenamento (v7); a remoção usa
   a API do Storage, com a policy que já permite admin apagar.
   ===================================================== */
(function () {
  const R = window.R;
  const D = window.D;
  const BUCKETS = { avatars: "Fotos de perfil", brechos: "Brechós e peças", editorial: "Editorial e eventos" };
  const DIA = 86400000;
  const size = b => {
    const n = Number(b) || 0;
    return n >= 1048576 ? `${(n / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.round(n / 1024).toLocaleString("pt-BR")} KB`;
  };

  D.route("armazenamento", {
    label: "Armazenamento",
    async render(el) {
      const { data, error } = await R.sb.rpc("admin_uso_armazenamento");
      if (error) throw error;
      // Arquivo sem uso há mais de 1 dia (evita apagar um envio em andamento).
      const orfaos = data.filter(f => !f.em_uso && Date.now() - new Date(f.criado_em) > DIA);
      const total = data.reduce((s, f) => s + Number(f.bytes || 0), 0);
      const porBucket = Object.keys(BUCKETS).map(b => {
        const fs = data.filter(f => f.bucket === b);
        return { b, n: fs.length, bytes: fs.reduce((s, f) => s + Number(f.bytes || 0), 0) };
      });
      const lixo = orfaos.reduce((s, f) => s + Number(f.bytes || 0), 0);
      el.innerHTML = `
        ${D.head("Armazenamento", "Espaço ocupado pelas imagens no Supabase Storage. O plano gratuito inclui 1 GB.")}
        ${D.stats([
          { label: "Total usado", text: size(total), note: R.fmt.count(data.length, "arquivo", "arquivos") },
          ...porBucket.map(x => ({ label: BUCKETS[x.b], value: x.n, note: size(x.bytes) })),
          { label: "Sem uso", value: orfaos.length, note: size(lixo) }
        ])}
        <section class="panel-card" aria-labelledby="orfTitle" style="margin-bottom:1.25rem">
          <h2 id="orfTitle" style="font-size:1.2rem">Arquivos sem uso</h2>
          <p class="muted" style="margin:.4rem 0 1rem">Imagens que nenhum perfil, brechó, peça, matéria ou evento usa mais (sobras de trocas de foto e envios interrompidos). Só entram arquivos com mais de 1 dia.</p>
          ${orfaos.length
            ? `<button class="btn btn-danger" type="button" id="stClean">Apagar ${R.fmt.count(orfaos.length, "arquivo", "arquivos")} sem uso (${size(lixo)})</button>`
            : '<p class="small">Nada para limpar.</p>'}
          <p class="form-status" id="stStatus" style="margin-top:.75rem"></p>
        </section>
        <section class="panel-card" aria-labelledby="bigTitle">
          <h2 id="bigTitle" style="font-size:1.2rem;margin-bottom:1rem">Maiores arquivos</h2>
          ${!data.length ? '<p class="small muted">Nenhum arquivo enviado ainda.</p>' : `
          <div class="table-wrap"><table class="dtable stack"><thead><tr><th scope="col">Arquivo</th><th scope="col">Local</th><th scope="col">Tamanho</th><th scope="col">Situação</th></tr></thead>
          <tbody>${data.slice(0, 25).map(f => `<tr>
            <td data-label="Arquivo"><small style="word-break:break-all">${R.esc(f.caminho)}</small></td>
            <td data-label="Local">${R.esc(BUCKETS[f.bucket] || f.bucket)}</td>
            <td data-label="Tamanho">${size(f.bytes)}</td>
            <td data-label="Situação">${f.em_uso ? '<span class="status approved">Em uso</span>' : '<span class="status pending">Sem uso</span>'}</td>
          </tr>`).join("")}</tbody></table></div>
          <p class="small muted" style="margin-top:.75rem">Imagens enviadas pelo site já são reduzidas antes do envio (peças até ~150 KB, miniaturas ~24 KB, fotos de perfil e logos ~35 KB, capas ~180 KB). Arquivos grandes aqui costumam ser anteriores a essa compressão: trocar a foto pelo painel gera uma versão leve e apaga a antiga.</p>`}
        </section>`;

      R.$("#stClean", el)?.addEventListener("click", async () => {
        if (!(await D.confirm(`Apagar ${R.fmt.count(orfaos.length, "arquivo", "arquivos")} que nada no site usa? Isso libera ${size(lixo)} e não pode ser desfeito.`, { confirmLabel: "Apagar arquivos" }))) return;
        const btn = R.$("#stClean", el), st = R.$("#stStatus", el);
        btn.disabled = true;
        let feitos = 0;
        try {
          for (const b of Object.keys(BUCKETS)) {
            const paths = orfaos.filter(f => f.bucket === b).map(f => f.caminho);
            for (let i = 0; i < paths.length; i += 100) {
              const { error: err } = await R.sb.storage.from(b).remove(paths.slice(i, i + 100));
              if (err) throw err;
              feitos += paths.slice(i, i + 100).length;
              R.formStatus(st, `Apagando… ${feitos} de ${orfaos.length}`);
            }
          }
          R.toast(`${R.fmt.count(feitos, "arquivo apagado", "arquivos apagados")}. ${size(lixo)} liberados.`);
          D.go();
        } catch (err) {
          console.error("[Repeteco] limpeza:", err);
          R.formStatus(st, R.errorDetail(err, `Parou depois de ${feitos} arquivos.`), true);
          btn.disabled = false;
        }
      });
    }
  });
})();
