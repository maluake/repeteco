/* Captura de tela de uma página com o Supabase mockado.
   Uso: node tests/e2e/shot.js <pagina> <largura> <saida.png> [email-logado] [fullPage=1] */
const { chromium } = require("playwright");
const { install } = require("./mock-supabase");
const { fixtures } = require("./fixtures");

(async () => {
  const [page = "index.html", width = "1366", out = "shot.png", email, full = "1"] = process.argv.slice(2);
  const base = process.env.BASE_URL || "http://127.0.0.1:8090/";
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 1 });
  const log = [];
  await install(context, { session: email ? fixtures.sessionFor(email) : null, log });
  const p = await context.newPage();
  const errors = [];
  p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  p.on("pageerror", e => errors.push(String(e)));
  await p.goto(base + page, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.screenshot({ path: out, fullPage: full === "1" });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(JSON.stringify({ page, width, overflow, errors, requests: log.filter(l => l.path.includes("/rest/")).map(l => `${l.method} ${l.path}${l.search}`) }, null, 1));
  await browser.close();
})();
