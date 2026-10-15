/* =====================================================
   REPETECO — testes de navegador (Playwright + axe-core)
   Supabase mockado com o interpretador de filtros de
   tests/e2e/mock-supabase.js.
   Uso:  npm run serve   (em outro terminal)
         npm run test:e2e
   Variáveis: BASE_URL (padrão http://127.0.0.1:8090/),
              CHROMIUM_PATH (opcional), ONLY (filtra testes pelo nome)
   ===================================================== */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { install } = require("./mock-supabase");
const { fixtures } = require("./fixtures");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8090/";
const ROOT = path.resolve(__dirname, "../..");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const results = [];
let browser;

async function ctx({ email, width = 1366, height = 900, reducedMotion } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  const log = [];
  await install(context, { session: email ? fixtures.sessionFor(email) : null, log });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FAILED|status of 40[46]/.test(m.text())) errors.push(m.text()); });
  return { context, page, log, errors };
}

// ONLY="trecho" roda só os testes cujo nome contém o trecho.
async function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`  ✗ ${name}\n      ${e.message.split("\n").join("\n      ")}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const PUBLIC_PAGES = [
  "index.html", "feed.html", "busca.html", "brechos.html", "brecho.html?b=garimpo-da-vila",
  "peca.html?id=20000000-0000-0000-0000-000000000001", "editorial.html", "artigo.html?slug=como-garimpar-em-sao-paulo",
  "entrar.html", "nova-senha.html", "contato.html", "cadastro.html", "sobre.html", "como-funciona.html",
  "sustentabilidade.html", "acessibilidade.html", "termos.html", "privacidade.html", "404.html",
  "eventos.html", "evento.html?e=feira-repeteco-primavera", "brecho.html?b=baú-da-avo"
];
const PRIVATE_PAGES = [
  ["salvos.html", "user@x.com"], ["perfil.html", "user@x.com"], ["cadastro.html", "user@x.com"],
  ["dashboard/index.html#visao-admin", "admin@x.com"], ["dashboard/index.html#solicitacoes", "admin@x.com"],
  ["dashboard/index.html#brechos", "admin@x.com"], ["dashboard/index.html#usuarios", "admin@x.com"],
  ["dashboard/index.html#publicacoes", "admin@x.com"], ["dashboard/index.html#editorial", "admin@x.com"],
  ["dashboard/index.html#editorial/novo", "admin@x.com"], ["dashboard/index.html#mensagens", "admin@x.com"],
  ["dashboard/index.html#visao-dono", "dona@x.com"], ["dashboard/index.html#pecas", "dona@x.com"],
  ["dashboard/index.html#perfil", "dona@x.com"],
  ["dashboard/index.html#eventos", "admin@x.com"], ["dashboard/index.html#eventos/novo", "admin@x.com"],
  ["dashboard/index.html#parcerias", "admin@x.com"], ["dashboard/index.html#armazenamento", "admin@x.com"]
];

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });

  /* ---------- 1. links e navegação ---------- */
  console.log("\nNavegação e links");
  const allPages = [...PUBLIC_PAGES.map(p => [p, null]), ...PRIVATE_PAGES];
  for (const [p, email] of allPages) {
    await test(`links reais em ${p}${email ? ` (${email})` : ""}`, async () => {
      const { page, errors, context } = await ctx({ email });
      await page.goto(BASE + p);
      await settle(page);
      const links = await page.$$eval("a[href]", as => as.map(a => ({ href: a.getAttribute("href"), abs: a.href, role: a.getAttribute("role"), text: (a.innerText || a.getAttribute("aria-label") || "").trim() })));
      const bad = [];
      for (const l of links) {
        if ((l.href === "#" && l.role !== "button") || l.href.startsWith("javascript:") || l.href === "") bad.push(`link sem destino: "${l.text}"`);
        const u = new URL(l.abs);
        if (u.origin !== new URL(BASE).origin) continue;
        const file = decodeURIComponent(u.pathname.replace(new URL(BASE).pathname, "")) || "index.html";
        if (!fs.existsSync(path.join(ROOT, file))) bad.push(`aponta para arquivo inexistente: ${l.href}`);
      }
      const unnamed = await page.$$eval("a, button", els => els.filter(e => e.offsetParent !== null && !e.closest("[aria-hidden=true]") && !(e.innerText.trim() || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.querySelector("[aria-label],img[alt]:not([alt=''])"))).map(e => e.outerHTML.slice(0, 80)));
      unnamed.forEach(u => bad.push(`elemento clicável sem nome acessível: ${u}`));
      assert(!errors.length, `erros no console: ${errors.join(" | ")}`);
      assert(!bad.length, bad.join("\n"));
      await context.close();
    });
  }

  await test("rotas do painel no menu existem e abrem a seção certa", async () => {
    const { page, context } = await ctx({ email: "admin@x.com" });
    await page.goto(BASE + "dashboard/index.html");
    await settle(page);
    const routes = await page.$$eval("[data-route]", as => as.map(a => a.getAttribute("href")));
    assert(routes.length >= 7, `esperava ao menos 7 seções, achou ${routes.length}`);
    for (const r of routes) {
      await page.click(`[href="${r}"]`);
      await settle(page);
      const current = await page.getAttribute(`[href="${r}"]`, "aria-current");
      const h1 = await page.textContent("#view h1");
      assert(current === "page" && h1, `seção ${r} não abriu (h1="${h1}")`);
    }
    await context.close();
  });

  await test("páginas privadas redirecionam para o login com retorno", async () => {
    const { page, context } = await ctx();
    for (const p of ["salvos.html", "perfil.html", "dashboard/index.html"]) {
      await page.goto(BASE + p);
      await page.waitForURL(/entrar\.html/, { timeout: 5000 });
      assert(page.url().includes(`next=${encodeURIComponent(p)}`), `next ausente para ${p}: ${page.url()}`);
    }
    await context.close();
  });

  await test("usuária comum sem brechó não acessa o painel administrativo", async () => {
    const { page, log, context } = await ctx({ email: "user@x.com" });
    await page.goto(BASE + "dashboard/index.html#usuarios");
    await settle(page);
    const text = await page.textContent("#view");
    assert(/ainda não tem um painel/i.test(text), "deveria mostrar aviso de painel indisponível");
    assert(!log.some(l => l.path.includes("admin_listar_usuarios")), "não deveria chamar a função de admin");
    await context.close();
  });

  /* ---------- 2. responsividade ---------- */
  console.log("\nResponsividade (375, 768, 1024, 1440, 1920)");
  for (const width of [375, 768, 1024, 1440, 1920]) {
    await test(`sem rolagem horizontal em ${width}px`, async () => {
      const { page, context } = await ctx({ width });
      const offenders = [];
      for (const [p, email] of allPages) {
        if (email) {
          await context.addCookies([]);
        }
        const { page: pg, context: c } = email ? await ctx({ email, width }) : { page, context: null };
        await pg.goto(BASE + p);
        await settle(pg);
        // body tem overflow-x:hidden; desliga para medir o estouro real.
        const over = await pg.evaluate(() => { document.body.style.overflowX = "visible"; return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
        if (over > 1) offenders.push(`${p}: +${over}px`);
        const tiny = await pg.$$eval("a, button, input, select, textarea", els => els.filter(e => {
          const r = e.getBoundingClientRect();
          return e.offsetParent !== null && r.width > 0 && (r.height < 24 || r.width < 24) && !e.closest("label, .leaflet-control-attribution, .article-body, .prose, p, .breadcrumb, .auth-links, .facts, td, .shop-row-foot, .tile-caption, .story-body, .neighborhoods");
        }).map(e => `${e.tagName.toLowerCase()} "${(e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 30)}"`));
        if (tiny.length) offenders.push(`${p}: alvos < 24px → ${tiny.slice(0, 4).join(", ")}`);
        if (c) await c.close();
      }
      await context.close();
      assert(!offenders.length, offenders.join("\n"));
    });
  }

  /* ---------- 3. acessibilidade automática (axe) ---------- */
  console.log("\nAcessibilidade automática (axe-core, WCAG 2.1 A/AA)");
  for (const [p, email] of allPages) {
    await test(`axe sem violações em ${p}`, async () => {
      const { page, context } = await ctx({ email });
      await page.goto(BASE + p);
      await settle(page);
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"], resultTypes: ["violations"] }));
      const v = res.violations.map(x => `${x.id} (${x.impact}): ${x.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`);
      await context.close();
      assert(!v.length, v.join("\n"));
    });
  }
  await test("axe também passa em alto contraste e com texto em 160%", async () => {
    const { page, context } = await ctx();
    await page.addInitScript(() => localStorage.setItem("repeteco-a11y", JSON.stringify({ size: 5, contrast: true, libras: false })));
    const issues = [];
    for (const p of ["index.html", "feed.html", "busca.html", "brechos.html"]) {
      await page.goto(BASE + p);
      await settle(page);
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () => window.axe.run(document, { runOnly: ["wcag2aa"], resultTypes: ["violations"] }));
      res.violations.forEach(x => issues.push(`${p} ${x.id}: ${x.nodes.slice(0, 2).map(n => n.target.join(" ")).join(" | ")}`));
      const over = await page.evaluate(() => { document.body.style.overflowX = "visible"; return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
      if (over > 1) issues.push(`${p} estoura +${over}px com texto em 160%`);
    }
    await context.close();
    assert(!issues.length, issues.join("\n"));
  });

  /* ---------- 4. ferramentas de acessibilidade ---------- */
  console.log("\nFerramentas de acessibilidade");
  await test("primeiro Tab foca o link 'Pular para o conteúdo', que leva ao <main>", async () => {
    const { page, context } = await ctx();
    await page.goto(BASE + "feed.html");
    await settle(page);
    await page.keyboard.press("Tab");
    const t = await page.evaluate(() => document.activeElement.textContent.trim());
    assert(/pular para o conteúdo/i.test(t), `foco inicial em "${t}"`);
    await page.keyboard.press("Enter");
    const id = await page.evaluate(() => document.activeElement.id);
    assert(id === "conteudo", `foco após o salto: ${id}`);
    await context.close();
  });

  await test("painel: aumentar texto, alto contraste, cores seguras e persistência", async () => {
    const { page, context } = await ctx();
    await page.goto(BASE + "index.html");
    await settle(page);
    const before = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    await page.click(".site-footer [data-open-a11y]");
    await page.click('[data-size="1"]');
    await page.click('[data-size="1"]');
    await page.click('[data-toggle="contrast"]');
    await page.click('[data-toggle="safeColors"]');
    const after = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    assert(after > before * 1.2, `fonte não aumentou: ${before} → ${after}`);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert(bg === "rgb(255, 255, 255)", `alto contraste não mudou o fundo: ${bg}`);
    assert(await page.evaluate(() => document.documentElement.classList.contains("a11y-safe-colors")), "classe de cores seguras ausente");
    assert(await page.getAttribute('[data-toggle="contrast"]', "aria-pressed") === "true", "aria-pressed não atualizado");
    await page.keyboard.press("Escape");
    const focused = await page.evaluate(() => document.activeElement.hasAttribute("data-open-a11y"));
    assert(focused, "foco não voltou ao botão que abriu o painel");
    await page.goto(BASE + "feed.html");
    await settle(page);
    const persisted = await page.evaluate(() => document.documentElement.classList.contains("a11y-contrast") && getComputedStyle(document.documentElement).getPropertyValue("--a11y-scale").trim());
    assert(persisted === "1.25", `preferências não persistiram entre páginas: ${persisted}`);
    await context.close();
  });

  await test("reduzir movimento desliga transições", async () => {
    const { page, context } = await ctx();
    await page.goto(BASE + "feed.html");
    await settle(page);
    await page.click(".site-footer [data-open-a11y]");
    await page.click('[data-toggle="motion"]');
    const d = await page.evaluate(() => getComputedStyle(document.querySelector(".btn")).transitionDuration);
    assert(parseFloat(d) < 0.01, `transição ainda ativa: ${d}`);
    await context.close();
  });

  await test("menu mobile abre, prende o foco visual e fecha com Esc", async () => {
    const { page, context } = await ctx({ width: 375 });
    await page.goto(BASE + "index.html");
    await settle(page);
    await page.click("#menuToggle");
    assert(await page.isVisible("#mainNav .nav-link >> nth=1"), "links do menu não visíveis");
    assert(await page.getAttribute("#menuToggle", "aria-expanded") === "true", "aria-expanded não atualizado");
    await page.keyboard.press("Escape");
    assert(!(await page.isVisible("#mainNav .nav-link >> nth=1")), "menu não fechou com Esc");
    await context.close();
  });

  /* ---------- 5. fluxos com o banco ---------- */
  console.log("\nFluxos (requisições reais ao Supabase, mockado)");
  await test("login: erro em português e redirecionamento para 'next'", async () => {
    const { page, context } = await ctx();
    await page.goto(BASE + "entrar.html?next=salvos.html");
    await settle(page);
    await page.fill("#loginEmail", "user@x.com");
    await page.fill("#loginPass", "senha-errada");
    await page.click("#loginBtn");
    await page.waitForSelector("#loginStatus.is-error");
    assert(/incorretos/i.test(await page.textContent("#loginStatus")), "mensagem de erro inesperada");
    await page.fill("#loginPass", "certa");
    await page.click("#loginBtn");
    await page.waitForURL(/salvos\.html/);
    await context.close();
  });

  await test("cadastro de conta valida campos e mostra confirmação de e-mail", async () => {
    const { page, log, context } = await ctx();
    await page.goto(BASE + "entrar.html?modo=cadastro");
    await settle(page);
    await page.click("#signupBtn");
    assert(await page.getAttribute("#suNome", "aria-invalid") === "true", "nome vazio não marcado como inválido");
    assert(await page.evaluate(() => document.activeElement.id) === "suNome", "foco não foi ao primeiro erro");
    await page.fill("#suNome", "Nova Pessoa");
    await page.fill("#suEmail", "nova@x.com");
    await page.fill("#suPass", "12345678");
    await page.check("#suTerms");
    await page.click("#signupBtn");
    await page.waitForSelector("#viewConfirm:not([hidden])");
    const req = log.find(l => l.path.endsWith("/auth/v1/signup"));
    assert(req && JSON.parse(req.body).data.nome === "Nova Pessoa", "nome não enviado nos metadados (usado pelo trigger de perfil)");
    await context.close();
  });

  await test("curtir e salvar chamam a função do banco, refletem aria-pressed e desfazem", async () => {
    const { page, log, context } = await ctx({ email: "user@x.com" });
    await page.goto(BASE + "feed.html");
    await settle(page);
    const first = fixtures.tables.feed_publicacoes[2].id;
    const like = `[data-act="like"][data-id="${first}"]`;
    await page.click(like);
    await page.waitForTimeout(250);
    const call = log.find(l => l.method === "POST" && l.path.endsWith("/rpc/alternar_interacao"));
    const body = call && JSON.parse(call.body);
    assert(body && body.p_tipo === "curtida" && body.p_publicacao_id === first && body.p_brecho_id === null, `chamada incorreta: ${call && call.body}`);
    assert(await page.getAttribute(like, "aria-pressed") === "true", "aria-pressed não ficou true");
    await page.click(like);
    await page.waitForTimeout(250);
    assert(await page.getAttribute(like, "aria-pressed") === "false", "segunda chamada deveria descurtir");
    const already = fixtures.tables.feed_publicacoes[0].id;
    assert(await page.getAttribute(`[data-act="like"][data-id="${already}"]`, "aria-pressed") === "true", "curtida existente não carregada de minhas_interacoes");
    await page.click(`[data-act="save"][data-id="${first}"]`);
    await page.waitForTimeout(250);
    const save = log.filter(l => l.path.endsWith("/rpc/alternar_interacao")).pop();
    assert(JSON.parse(save.body).p_tipo === "salvo", "salvar não chamou a função");
    await page.click(`[data-act="save"][data-id="${first}"]`);
    await page.waitForTimeout(250);
    assert(!log.some(l => l.method === "POST" && /\/rest\/v1\/(curtidas|salvos)$/.test(l.path)), "não deveria gravar direto nas tabelas");
    await context.close();
  });

  await test("erro ao curtir mostra a mensagem real e desfaz o estado", async () => {
    const { page, context } = await ctx({ email: "user@x.com" });
    await context.route("**/rest/v1/rpc/alternar_interacao", route => route.fulfill({ status: 400, json: { code: "XX000", message: "falha simulada no banco" } }));
    await page.goto(BASE + "feed.html");
    await settle(page);
    const id = fixtures.tables.feed_publicacoes[3].id;
    await page.click(`[data-act="like"][data-id="${id}"]`);
    await page.waitForTimeout(300);
    const toast = await page.textContent("#toastRegion");
    assert(/falha simulada no banco/.test(toast), `toast sem o erro real: ${toast}`);
    assert(await page.getAttribute(`[data-act="like"][data-id="${id}"]`, "aria-pressed") === "false", "estado deveria voltar");
    await context.close();
  });

  await test("curtir sem login leva ao login e não grava nada", async () => {
    const { page, log, context } = await ctx();
    await page.goto(BASE + "feed.html");
    await settle(page);
    await page.click('[data-act="like"] >> nth=0');
    await page.waitForURL(/entrar\.html\?next=feed\.html/, { timeout: 4000 });
    assert(!log.some(l => l.method === "POST" && l.path.endsWith("/curtidas")), "não deveria gravar sem login");
    await context.close();
  });

  await test("busca: filtros alteram a consulta, chips removem e limpam", async () => {
    const { page, log, context } = await ctx();
    await page.goto(BASE + "busca.html");
    await settle(page);
    await page.check('input[name="bairro"][value="Pinheiros"]');
    await settle(page);
    await page.locator('details[data-group="fTipo"] summary').click();
    await page.check('input[name="tipo"][value="vestido"]');
    await settle(page);
    await page.check('input[name="preco_max"][value="100"]');
    await settle(page);
    const last = log.filter(l => l.path.endsWith("/feed_publicacoes") && l.search.includes("count") === false).pop();
    const q = log.filter(l => l.path.endsWith("/feed_publicacoes")).pop().search;
    assert(q.includes("bairro=in.(Pinheiros)") && q.includes("tipo=in.(vestido)") && q.includes("preco=lte.100"), `consulta sem os filtros: ${q}`);
    assert(page.url().includes("bairro=Pinheiros") && page.url().includes("tipo=vestido"), "URL não reflete os filtros");
    const count = await page.textContent("#resultsCount");
    const expected = fixtures.tables.feed_publicacoes.filter(p => p.bairro === "Pinheiros" && p.tipo === "vestido" && p.preco <= 100).length;
    assert(count.startsWith(String(expected)), `contagem "${count}" ≠ ${expected}`);
    assert((await page.$$("#activeFilters .chip")).length === 3, "deveria haver 3 chips");
    await page.click('#activeFilters [data-remove="tipo"]');
    await settle(page);
    const q2 = log.filter(l => l.path.endsWith("/feed_publicacoes")).pop().search;
    assert(!q2.includes("tipo=") && q2.includes("bairro=in.(Pinheiros)"), `remoção individual falhou: ${q2}`);
    await page.click("#clearAll");
    await settle(page);
    const q3 = log.filter(l => l.path.endsWith("/feed_publicacoes")).pop().search;
    assert(!q3.includes("bairro=") && !q3.includes("preco="), `limpar tudo falhou: ${q3}`);
    void last;
    await context.close();
  });

  await test("busca de brechós com filtros de peça usa subconsulta real", async () => {
    const { page, log, context } = await ctx();
    await page.goto(BASE + "busca.html?tipo_busca=brechos&bairro=Pinheiros&tipo=vestido&preco_max=100");
    await settle(page);
    const sub = log.find(l => l.path.endsWith("/feed_publicacoes") && l.search.includes("select=brecho_id"));
    const main = log.filter(l => l.path.endsWith("/brechos_publicos") && l.search.includes("id=in.")).pop();
    assert(sub && sub.search.includes("tipo=in.(vestido)") && sub.search.includes("preco=lte.100"), "subconsulta de peças ausente");
    assert(main && main.search.includes("bairro=in.(Pinheiros)"), "consulta de brechós sem bairro");
    assert((await page.textContent("#resultsCount")).startsWith("1 "), "deveria encontrar 1 brechó");
    await context.close();
  });

  await test("perfil: editar nome/bio grava em profiles e atualiza o cabeçalho", async () => {
    const { page, log, context } = await ctx({ email: "user@x.com" });
    await page.goto(BASE + "perfil.html");
    await settle(page);
    await page.fill("#pNome", "Clara S.");
    await page.fill("#pBio", "Garimpo jeans e tricô.");
    await page.click("#profileSave");
    await page.waitForSelector("#profileStatus:not(:empty)");
    const patch = log.find(l => l.method === "PATCH" && l.path.endsWith("/profiles"));
    assert(patch && JSON.parse(patch.body).nome === "Clara S." && patch.search.includes(`id=eq.${fixtures.USERS["user@x.com"].id}`), "PATCH de perfil incorreto");
    assert(!JSON.parse(patch.body).role, "o frontend não deve enviar role");
    await context.close();
  });

  await test("perfil: foto é comprimida, enviada ao Storage na pasta do usuário e salva", async () => {
    const { page, log, context } = await ctx({ email: "user@x.com" });
    await page.goto(BASE + "perfil.html");
    await settle(page);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8Dwn4GBgYGJAQoAAP//AwB7Dwr0PmK9xQAAAABJRU5ErkJggg==", "base64");
    await page.setInputFiles("#avatarFile", { name: "foto.png", mimeType: "image/png", buffer: png });
    await page.click(".cropper [data-ok]");
    assert(await page.isVisible("#avatarPreview img"), "prévia não apareceu");
    await page.click("#profileSave");
    await page.waitForSelector("#profileStatus:not(:empty)");
    await page.waitForTimeout(300);
    const up = log.find(l => l.method === "POST" && l.path.startsWith("/storage/v1/object/avatars/"));
    assert(up && up.path.includes(`/avatars/${fixtures.USERS["user@x.com"].id}/`), `upload fora da pasta do usuário: ${up && up.path}`);
    const patch = log.find(l => l.method === "PATCH" && l.path.endsWith("/profiles"));
    assert(patch && JSON.parse(patch.body).avatar_url.includes("/avatars/"), "avatar_url não salvo");
    await context.close();
  });

  await test("contato grava mensagem na tabela contatos", async () => {
    const { page, log, context } = await ctx();
    await page.goto(BASE + "contato.html?assunto=acessibilidade");
    await settle(page);
    assert(await page.inputValue("#ctAssunto") === "acessibilidade", "assunto pré-selecionado não aplicado");
    await page.fill("#ctNome", "Ana");
    await page.fill("#ctEmail", "ana@x.com");
    await page.fill("#ctMensagem", "O mapa não abre no meu leitor de tela.");
    await page.click("#contactBtn");
    await page.waitForSelector("#contactStatus:not(:empty)");
    assert(log.some(l => l.method === "POST" && l.path.endsWith("/contatos") && JSON.parse(l.body).assunto === "acessibilidade"), "POST de contato ausente");
    await context.close();
  });

  await test("dono publica peça com várias fotos recortadas, miniaturas e promoção", async () => {
    const { page, log, context } = await ctx({ email: "dona@x.com" });
    await page.goto(BASE + "dashboard/index.html#pecas");
    await settle(page);
    await page.click("[data-new] >> nth=0");
    await page.click('[data-intent="publicado"]');
    assert(await page.getAttribute("#pcFotos", "aria-invalid") === "true", "deveria exigir foto");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8Dwn4GBgYGJAQoAAP//AwB7Dwr0PmK9xQAAAABJRU5ErkJggg==", "base64");
    await page.setInputFiles("#pcFotos", [{ name: "a.png", mimeType: "image/png", buffer: png }, { name: "b.png", mimeType: "image/png", buffer: png }]);
    await page.click(".cropper [data-aspect='1']");
    await page.click(".cropper [data-ok]");
    await page.click(".cropper [data-ok]");
    await page.waitForFunction(() => document.querySelectorAll("#fotoList .photo-item").length === 2);
    await page.fill("#alt-0", "Casaco visto de frente");
    await page.fill("#pcTitulo", "Bota de couro");
    await page.selectOption("#pcTipo", "bota");
    assert(await page.textContent("#pcTamLabel") === "Numeração", "tipo calçado deveria pedir numeração");
    await page.selectOption("#pcTam", "38");
    await page.fill("#pcPreco", "90");
    await page.check("#pcPromo");
    await page.fill("#pcOrig", "150");
    await page.fill("#pcEstilo", "  Anos   90 ");
    await page.click('[data-intent="publicado"]');
    await page.waitForTimeout(800);
    const ups = log.filter(l => l.method === "POST" && l.path.includes("/storage/v1/object/brechos/"));
    assert(ups.length === 4, `esperava 2 fotos + 2 miniaturas, houve ${ups.length}`);
    const ins = log.find(l => l.method === "POST" && l.path.endsWith("/publicacoes"));
    const body = ins && JSON.parse(ins.body);
    assert(body && body.brecho_id === "10000000-0000-0000-0000-000000000001" && body.status === "publicado", `insert incorreto: ${ins && ins.body}`);
    assert(body.imagens.length === 2 && body.imagens[0].thumb_url && body.imagens[0].alt === "Casaco visto de frente", "galeria não gravada");
    assert(body.imagem_url === body.imagens[0].url && body.thumb_url === body.imagens[0].thumb_url, "capa deveria ser a 1ª foto");
    assert(body.tamanho === "38" && body.preco === 90 && body.preco_original === 150 && body.estilo === "anos 90", `campos: ${ins.body}`);
    await context.close();
  });

  await test("dono edita endereço: geocodifica (Nominatim) e salva coordenadas", async () => {
    const { page, log, context } = await ctx({ email: "dona@x.com" });
    await page.goto(BASE + "dashboard/index.html#perfil");
    await settle(page);
    await page.click("#sGeo");
    await page.waitForFunction(() => /Encontrado/.test(document.querySelector("#sGeoStatus").textContent));
    await page.click("#sSave");
    await page.waitForTimeout(400);
    const patch = log.find(l => l.method === "PATCH" && l.path.endsWith("/brechos"));
    const body = patch && JSON.parse(patch.body);
    assert(body && body.latitude === -23.5614 && body.longitude === -46.6916 && !("status" in body) && !("user_id" in body), `PATCH incorreto: ${patch && patch.body}`);
    await context.close();
  });

  await test("admin aprova solicitação (PATCH status=approved após confirmação)", async () => {
    const { page, log, context } = await ctx({ email: "admin@x.com" });
    await page.goto(BASE + "dashboard/index.html#solicitacoes");
    await settle(page);
    await page.click('[data-status="approved"]');
    await page.click('dialog [value="yes"]');
    await page.waitForTimeout(300);
    const patch = log.find(l => l.method === "PATCH" && l.path.endsWith("/brechos"));
    assert(patch && JSON.parse(patch.body).status === "approved" && patch.search.includes("10000000-0000-0000-0000-000000000009"), "aprovação não enviada");
    await context.close();
  });

  await test("admin cria e publica matéria com pré-visualização", async () => {
    const { page, log, context } = await ctx({ email: "admin@x.com" });
    await page.goto(BASE + "dashboard/index.html#editorial/novo");
    await settle(page);
    await page.fill("#aTitulo", "Guia de brechós da Zona Oeste");
    await page.fill("#aConteudo", "Primeiro parágrafo com **destaque**.\n\n## Pinheiros\n\nTexto sobre o bairro.");
    await page.waitForTimeout(200);
    assert(await page.isVisible("#pvBody h2"), "pré-visualização não renderizou o intertítulo");
    await page.selectOption("#aCat", "guias");
    await page.click('[data-intent="publicado"]');
    await page.waitForTimeout(400);
    const ins = log.find(l => l.method === "POST" && l.path.endsWith("/artigos"));
    const body = ins && JSON.parse(ins.body);
    assert(body && body.status === "publicado" && body.categoria === "guias" && body.publicado_em, `insert incorreto: ${ins && ins.body}`);
    await context.close();
  });

  await test("editorial público lista só publicados e filtra por categoria", async () => {
    const { page, log, context } = await ctx();
    await page.goto(BASE + "editorial.html?categoria=guias");
    await settle(page);
    const q = log.filter(l => l.path.endsWith("/artigos")).pop().search;
    assert(q.includes("status=eq.publicado") && q.includes("categoria=eq.guias"), `consulta: ${q}`);
    assert((await page.$$(".story")).length === 1, "deveria listar 1 matéria");
    await context.close();
  });

  await test("texto do editorial é escapado (sem HTML injetado)", async () => {
    const { page, context } = await ctx();
    await page.goto(BASE + "index.html");
    await settle(page);
    const html = await page.evaluate(() => window.R.render.articleHtml('<img src=x onerror=alert(1)> [x](javascript:alert(1))'));
    assert(!html.includes("<img") && !html.includes("javascript:"), `HTML inseguro: ${html}`);
    await context.close();
  });

  /* ---------- v6: mapa, promoções, galeria, online, eventos ---------- */
  await test("mapa fica por baixo do cabeçalho fixo ao rolar", async () => {
    const { page, context } = await ctx({ width: 1024, height: 700 });
    await page.goto(BASE + "brechos.html");
    await settle(page);
    const box = await page.locator("#mapCanvas").boundingBox();
    await page.evaluate(y => window.scrollTo(0, y), box.y - 20);
    await page.waitForTimeout(200);
    const hit = await page.evaluate(() => {
      const h = document.querySelector("#site-header").getBoundingClientRect();
      const el = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2);
      return !!el.closest("#site-header");
    });
    assert(hit, "o mapa está desenhado por cima do cabeçalho");
    await context.close();
  });

  await test("feed: aba promoções consulta em_promocao e mostra preço riscado", async () => {
    const { page, log, context } = await ctx();
    await page.goto(BASE + "feed.html");
    await settle(page);
    await page.click('[data-lista="promocoes"]');
    await settle(page);
    const q = log.filter(l => l.path.endsWith("/feed_publicacoes")).pop().search;
    assert(q.includes("em_promocao=eq.true"), `consulta: ${q}`);
    assert(await page.locator(".promo-flag").count() === 5, "deveria haver 5 peças com selo de promoção");
    await context.close();
  });

  await test("peça com várias fotos: galeria troca imagem por miniatura e teclado", async () => {
    const { page, context } = await ctx();
    await page.goto(BASE + "peca.html?id=20000000-0000-0000-0000-000000000001");
    await settle(page);
    assert(await page.locator(".gallery-thumbs button").count() === 3, "deveria ter 3 miniaturas");
    await page.click(".gallery-thumbs button >> nth=2");
    const visible = () => page.getAttribute(".gallery-main figure:not([hidden]) img", "src");
    assert(/peca-1-3\.jpg/.test(await visible()), "não trocou para a 3ª foto");
    assert(await page.getAttribute(".gallery-thumbs button >> nth=2", "aria-pressed") === "true", "miniatura não marcada");
    await page.click(".gallery-nav.next");
    assert(/peca-1\.jpg/.test(await visible()), "próxima deveria voltar à 1ª");
    await page.focus(".gallery-main");
    await page.keyboard.press("ArrowLeft");
    assert(/peca-1-3\.jpg/.test(await visible()), "seta para a esquerda deveria ir à última");
    await context.close();
  });

  await test("busca: numeração de calçado filtra por tipo de calçado + número", async () => {
    const { page, log, context } = await ctx();
    await page.goto(BASE + "busca.html?num=38");
    await settle(page);
    const q = decodeURIComponent(log.filter(l => l.path.endsWith("/feed_publicacoes")).pop().search);
    assert(/tamanho=in\.\(38\)/.test(q) && q.includes("tipo=in.(") && q.includes("bota"), `consulta: ${q}`);
    await context.close();
  });

  await test("brechó online: sem mapa, com selo e link da loja", async () => {
    const { page, context } = await ctx();
    await page.goto(BASE + "brecho.html?b=baú-da-avo");
    await settle(page);
    assert(await page.locator("#shopMap").count() === 0, "brechó online não deveria ter mapa");
    assert(/só online/.test(await page.textContent(".shop-head")), "selo online ausente");
    assert(await page.locator('a[href="https://baudaavo.com.br/loja"]').count() === 1, "link da loja ausente");
    await page.goto(BASE + "brechos.html");
    await settle(page);
    await page.click('[data-bairro="online"]');
    await settle(page);
    assert(await page.locator(".shop-card").count() === 2, "aba online deveria listar 2 brechós");
    await context.close();
  });

  await test("eventos: agenda separa próximos e passados; rascunho não aparece", async () => {
    const { page, context } = await ctx();
    await page.goto(BASE + "eventos.html");
    await settle(page);
    const up = await page.textContent("#upcomingList");
    assert(up.includes("Feira Repeteco de Primavera") && up.includes("garimpo consciente") && !up.includes("planejamento"), `próximos: ${up}`);
    assert((await page.textContent("#pastList")).includes("Bazar de inverno"), "passado ausente");
    assert(await page.getAttribute('.main-nav a[href$="eventos.html"]', "aria-current") === "page", "aba eventos não marcada no menu");
    await context.close();
  });

  await test("evento: formulário de parceria grava em evento_parcerias", async () => {
    const { page, log, context } = await ctx({ email: "dona@x.com" });
    await page.goto(BASE + "evento.html?e=feira-repeteco-primavera");
    await settle(page);
    await page.click("#parBtn");
    await page.fill("#parNome", "");
    await page.click("#parBtn");
    assert(await page.getAttribute("#parNome", "aria-invalid") === "true", "deveria validar nome");
    await page.fill("#parNome", "Garimpo da Vila");
    await page.selectOption("#parTipo", "expositor");
    await page.fill("#parMsg", "Levamos duas araras.");
    await page.click("#parBtn");
    await page.waitForFunction(() => /Recebemos/.test(document.querySelector("#parStatus").textContent));
    const post = log.find(l => l.method === "POST" && l.path.endsWith("/evento_parcerias"));
    const body = post && JSON.parse(post.body);
    assert(body && body.evento_id === "40000000-0000-0000-0000-000000000001" && body.tipo === "expositor" && body.brecho_id === "10000000-0000-0000-0000-000000000001" && body.user_id === "00000000-0000-0000-0000-00000000000b" && !("status" in body), `POST: ${post && post.body}`);
    await page.goto(BASE + "evento.html?e=live-garimpo-consciente");
    await settle(page);
    assert(await page.locator("#partnerForm").count() === 0, "evento sem parcerias não deveria ter formulário");
    await context.close();
  });

  await test("admin cria evento online e muda andamento de parceria", async () => {
    const { page, log, context } = await ctx({ email: "admin@x.com" });
    await page.goto(BASE + "dashboard/index.html#eventos/novo");
    await settle(page);
    await page.fill("#eTitulo", "Oficina de costura");
    await page.fill("#eInicio", "2030-05-10T14:00");
    await page.selectOption("#eFormato", "online");
    assert(await page.isHidden("#eLocalWrap"), "local deveria sumir para evento online");
    await page.click('[data-intent="publicado"]');
    assert(await page.getAttribute("#eLink", "aria-invalid") === "true", "online sem link não deveria publicar");
    await page.fill("#eLink", "meet.example.com/oficina");
    await page.click('[data-intent="publicado"]');
    await page.waitForTimeout(500);
    const ins = log.find(l => l.method === "POST" && l.path.endsWith("/eventos"));
    const body = ins && JSON.parse(ins.body);
    assert(body && body.status === "publicado" && body.formato === "online" && body.link === "https://meet.example.com/oficina" && body.local_nome === null && body.data_inicio.startsWith("2030-05-10"), `POST: ${ins && ins.body}`);
    await page.goto(BASE + "dashboard/index.html#parcerias");
    await settle(page);
    await page.selectOption("[data-parceria] >> nth=0", "em_conversa");
    await page.waitForTimeout(300);
    const patch = log.find(l => l.method === "PATCH" && l.path.endsWith("/evento_parcerias"));
    assert(patch && JSON.parse(patch.body).status === "em_conversa", "PATCH de andamento ausente");
    await context.close();
  });

  /* ---------- v7: funções, CEP, armazenamento, compressão ---------- */
  await test("admin muda a função de uma pessoa pela função do banco", async () => {
    const { page, log, context } = await ctx({ email: "admin@x.com" });
    await page.goto(BASE + "dashboard/index.html#usuarios");
    await settle(page);
    const id = fixtures.USERS["user@x.com"].id;
    await page.selectOption(`#role-${id}`, "dono");
    await page.click('dialog [value="yes"]');
    await page.waitForTimeout(400);
    const call = log.find(l => l.path.endsWith("/rpc/admin_definir_funcao"));
    assert(call && JSON.parse(call.body).p_role === "dono" && JSON.parse(call.body).p_user_id === id, "função do banco não chamada");
    assert(!log.some(l => l.method === "PATCH" && l.path.endsWith("/profiles")), "não deveria alterar a tabela direto");
    assert(await page.inputValue(`#role-${id}`) === "dono", "seleção deveria ficar em dono");
    assert(/atualizada/.test(await page.textContent("#toastRegion")), "sem confirmação");
    await page.selectOption(`#role-${id}`, "usuario");
    await page.click('dialog [value="yes"]');
    await page.waitForTimeout(300);
    await context.close();
  });

  await test("erro ao mudar função mostra o motivo e desfaz a seleção", async () => {
    const { page, context } = await ctx({ email: "admin@x.com" });
    await context.route("**/rest/v1/rpc/admin_definir_funcao", route => route.fulfill({ status: 400, json: { code: "23514", message: "new row violates check constraint \"profiles_role_antiga\"" } }));
    await page.goto(BASE + "dashboard/index.html#usuarios");
    await settle(page);
    const id = fixtures.USERS["user@x.com"].id;
    await page.selectOption(`#role-${id}`, "dono");
    await page.click('dialog [value="yes"]');
    await page.waitForTimeout(300);
    assert(/profiles_role_antiga/.test(await page.textContent("#toastRegion")), "o motivo técnico deveria aparecer");
    assert(await page.inputValue(`#role-${id}`) === "usuario", "seleção deveria voltar");
    await context.close();
  });

  await test("dono digita o CEP: rua, bairro e cidade preenchidos, mapa localizado e CEP salvo", async () => {
    const { page, log, context } = await ctx({ email: "dona@x.com" });
    await page.goto(BASE + "dashboard/index.html#perfil");
    await settle(page);
    await page.fill("#sEndereco", "");
    await page.fill("#sBairro", "");
    await page.fill("#sCep", "99999999");
    await page.waitForTimeout(300);
    assert(await page.getAttribute("#sCep", "aria-invalid") === "true", "CEP inexistente deveria mostrar erro");
    await page.fill("#sCep", "05422030");
    await page.waitForFunction(() => /Encontrado/.test(document.querySelector("#sGeoStatus").textContent));
    assert(await page.inputValue("#sCep") === "05422-030", "máscara do CEP");
    assert(await page.inputValue("#sEndereco") === "Rua dos Pinheiros, " && await page.inputValue("#sBairro") === "Pinheiros" && await page.inputValue("#sCidade") === "São Paulo", "endereço não preenchido");
    assert(await page.evaluate(() => document.activeElement.id) === "sEndereco", "foco deveria ir para o número");
    await page.type("#sEndereco", "500");
    await page.click("#sSave");
    await page.waitForTimeout(400);
    const body = JSON.parse(log.find(l => l.method === "PATCH" && l.path.endsWith("/brechos")).body);
    assert(body.cep === "05422030" && body.endereco === "Rua dos Pinheiros, 500" && body.latitude, `PATCH: ${JSON.stringify(body)}`);
    await context.close();
  });

  await test("cadastro de brechó preenche o endereço pelo CEP e envia o CEP", async () => {
    const { page, log, context } = await ctx({ email: "user@x.com" });
    await page.goto(BASE + "cadastro.html");
    await settle(page);
    await page.fill("#lojaCep", "05422-030");
    await page.waitForFunction(() => document.querySelector("#lojaBairro").value === "Pinheiros");
    await page.type("#lojaEndereco", "10");
    await page.fill("#respWhats", "11999990000");
    await page.fill("#lojaNome", "Brechó do CEP");
    await page.check('input[name="categorias"] >> nth=0');
    await page.click("#storeSubmit");
    await page.waitForTimeout(400);
    const ins = log.find(l => l.method === "POST" && l.path.endsWith("/brechos"));
    const body = ins && JSON.parse(ins.body);
    assert(body && body.cep === "05422030" && body.endereco === "Rua dos Pinheiros, 10" && body.cidade === "São Paulo", `POST: ${ins && ins.body}`);
    await context.close();
  });

  await test("armazenamento: mostra o espaço e apaga só arquivos sem uso com mais de 1 dia", async () => {
    const { page, log, context } = await ctx({ email: "admin@x.com" });
    await page.goto(BASE + "dashboard/index.html#armazenamento");
    await settle(page);
    assert(/2,8 MB/.test(await page.textContent(".stats")), "total deveria somar 2,8 MB");
    await page.click("#stClean");
    await page.click('dialog [value="yes"]');
    await page.waitForTimeout(500);
    const dels = log.filter(l => l.method === "DELETE" && l.path.includes("/storage/v1/object/"));
    const apagados = dels.flatMap(d => JSON.parse(d.body).prefixes);
    assert(apagados.length === 2 && apagados.some(p => p.endsWith("sobra.webp")) && apagados.some(p => p.endsWith("velha.webp")), `apagou: ${apagados}`);
    assert(!apagados.some(p => /enviando|antiga-grande|capa/.test(p)), "apagou arquivo em uso ou recente");
    await context.close();
  });

  await test("compressão garante o teto de bytes mesmo em foto pesada", async () => {
    const { page, context } = await ctx({ email: "dona@x.com" });
    await page.goto(BASE + "index.html");
    await settle(page);
    await page.addScriptTag({ url: BASE + "assets/js/media.js" });
    const r = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 3000; c.height = 4000;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i++) img.data[i] = Math.random() * 255; // ruído: pior caso
      ctx.putImageData(img, 0, 0);
      const out = await window.R.media.prepare(c, { thumb: true });
      return { main: out.main.size, thumb: out.thumb.size, P: window.R.media.PRESETS };
    });
    assert(r.main <= r.P.peca.maxBytes && r.thumb <= r.P.thumb.maxBytes, `tamanhos: ${r.main} / ${r.thumb}`);
    await context.close();
  });

  /* ---------- resumo ---------- */
  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
  process.exit(failed.length ? 1 : 0);
})();
