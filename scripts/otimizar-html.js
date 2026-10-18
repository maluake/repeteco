#!/usr/bin/env node
/* =====================================================
   REPETECO — prepara o HTML para publicação (sem build):
   1. acrescenta ?v=<hash do conteúdo> a cada CSS/JS local, para o
      navegador e a CDN guardarem os arquivos por 1 ano e mesmo
      assim receberem a versão nova assim que o arquivo mudar;
   2. garante preconnect ao Supabase e preload das fontes no <head>.
   Uso: node scripts/otimizar-html.js         (reescreve os HTML)
        node scripts/otimizar-html.js --check (falha se algo estiver desatualizado)
   ===================================================== */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const CHECK = process.argv.includes("--check");
const SUPABASE = /supabaseUrl:\s*"([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, "assets/js/config.js"), "utf8"))[1];
const FONTS = ["dm-sans-latin-400-normal.woff2", "lilita-one-latin-400-normal.woff2"];
const MARK = "<!-- desempenho -->";

const hashes = new Map();
function hashOf(file) {
  if (!hashes.has(file)) hashes.set(file, crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 10));
  return hashes.get(file);
}

const htmlFiles = [
  ...fs.readdirSync(ROOT).filter(f => f.endsWith(".html")).map(f => path.join(ROOT, f)),
  ...fs.readdirSync(path.join(ROOT, "dashboard")).filter(f => f.endsWith(".html")).map(f => path.join(ROOT, "dashboard", f))
];

let stale = [];
for (const file of htmlFiles) {
  const dir = path.dirname(file);
  const pre = path.relative(dir, ROOT).split(path.sep).filter(Boolean).map(() => "../").join("");
  const before = fs.readFileSync(file, "utf8");
  let html = before.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(")/g, (all, a, ref, b) => {
    if (/^(https?:)?\/\//.test(ref)) return all;
    const target = path.resolve(dir, ref);
    if (!fs.existsSync(target)) return all;
    return `${a}${ref}?v=${hashOf(target)}${b}`;
  });
  const head = [
    MARK,
    `  <link rel="preconnect" href="${SUPABASE}" crossorigin>`,
    ...FONTS.map(f => `  <link rel="preload" href="${pre}assets/fonts/${f}" as="font" type="font/woff2" crossorigin>`)
  ].join("\n");
  html = html.includes(MARK)
    ? html.replace(new RegExp(`${MARK}[\\s\\S]*?crossorigin>\\n(?!  <link rel="preload")`), `${head}\n`)
    : html.replace(/(<meta name="viewport"[^>]*>\n)/, `$1  ${head}\n`);
  if (html !== before) {
    stale.push(path.relative(ROOT, file));
    if (!CHECK) fs.writeFileSync(file, html);
  }
}
if (CHECK && stale.length) {
  console.error(`HTML desatualizado (rode node scripts/otimizar-html.js): ${stale.join(", ")}`);
  process.exit(1);
}
console.log(CHECK ? "HTML em dia." : `${stale.length} arquivo(s) atualizado(s).`);
