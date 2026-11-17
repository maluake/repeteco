#!/usr/bin/env node
/* =====================================================
   REPETECO — gera supabase/migrations/ (formato do Supabase CLI)
   a partir dos arquivos de versão (01_base_v4.sql, v5/ … v11/).

   Os arquivos de versão continuam sendo a fonte: quem roda à mão no
   SQL Editor segue o README como sempre. A pasta migrations/ é uma
   cópia ordenada para quem usa `supabase db push` / `supabase start`.

   Uso: node scripts/gerar-migracoes.js          (reescreve migrations/)
        node scripts/gerar-migracoes.js --check  (falha se estiver desatualizada)

   Para acrescentar uma versão nova: crie supabase/vNN/1_nome.sql e
   inclua a pasta em ORDEM abaixo. Nunca renumere versões já publicadas.
   ===================================================== */
const fs = require("fs");
const path = require("path");

const SUPA = path.resolve(__dirname, "../supabase");
const OUT = path.join(SUPA, "migrations");
const CHECK = process.argv.includes("--check");

// Ordem de aplicação. Cada entrada vira uma migração; a versão é fixa
// (data fictícia + sequência) para nunca mudar depois de publicada.
const ORDEM = ["01_base_v4.sql", "v5", "v6", "v7", "v8", "v9", "v10", "v11"];

function arquivos() {
  const lista = [];
  for (const item of ORDEM) {
    const p = path.join(SUPA, item);
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) {
      fs.readdirSync(p).filter(f => f.endsWith(".sql")).sort().forEach(f => lista.push({ grupo: item, arquivo: path.join(item, f) }));
    } else {
      lista.push({ grupo: "v4", arquivo: item });
    }
  }
  return lista;
}

function nomeMigracao(i, { grupo, arquivo }) {
  const seq = String(i + 1).padStart(4, "0");
  const base = path.basename(arquivo, ".sql").replace(/^\d+_/, "").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return `20260101${seq}00_${grupo}_${base}.sql`;
}

const esperado = new Map();
arquivos().forEach((a, i) => {
  const corpo = fs.readFileSync(path.join(SUPA, a.arquivo), "utf8");
  esperado.set(nomeMigracao(i, a), `-- Gerado por scripts/gerar-migracoes.js a partir de supabase/${a.arquivo}.\n-- Não edite aqui: edite o arquivo de origem e rode \`npm run migracoes\`.\n\n${corpo}`);
});

const atuais = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter(f => f.endsWith(".sql")) : [];
const problemas = [];
for (const [nome, corpo] of esperado) {
  const p = path.join(OUT, nome);
  if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== corpo) problemas.push(nome);
}
// Só mexe nas migrações geradas por este script (prefixo 20260101);
// migrações criadas à mão (ex.: `supabase migration new`) ficam intactas.
const sobrando = atuais.filter(f => f.startsWith("20260101") && !esperado.has(f));

if (CHECK) {
  if (problemas.length || sobrando.length) {
    console.error("supabase/migrations desatualizada (rode npm run migracoes):", [...problemas, ...sobrando.map(f => `${f} (sobrando)`)].join(", "));
    process.exit(1);
  }
  console.log(`supabase/migrations em dia (${esperado.size} migrações).`);
} else {
  fs.mkdirSync(OUT, { recursive: true });
  sobrando.forEach(f => fs.unlinkSync(path.join(OUT, f)));
  for (const [nome, corpo] of esperado) fs.writeFileSync(path.join(OUT, nome), corpo);
  console.log(`${esperado.size} migrações em supabase/migrations (${problemas.length} atualizada(s), ${sobrando.length} removida(s)).`);
}
