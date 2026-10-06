/* =====================================================
   REPETECO — testes de navegador (Playwright + axe-core)
   Supabase mockado com o interpretador de filtros de
   tests/e2e/mock-supabase.js.
   Uso:  npm run serve   (em outro terminal)
         npm run test:e2e
   Variáveis: BASE_URL (padrão http://127.0.0.1:8090/),
              CHROMIUM_PATH (opcional)
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

async function test(name, fn) {
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
  "sustentabilidade.html", "acessibilidade.html", "termos.html", "privacidade.html", "404.html"
];
const PRIVATE_PAGES = [
  ["salvos.html", "user@x.com"], ["perfil.html", "user@x.com"], ["cadastro.html", "user@x.com"],
  ["dashboard/index.html#visao-admin", "admin@x.com"], ["dashboard/index.html#solicitacoes", "admin@x.com"],
  ["dashboard/index.html#brechos", "admin@x.com"], ["dashboard/index.html#usuarios", "admin@x.com"],
  ["dashboard/index.html#publicacoes", "admin@x.com"], ["dashboard/index.html#editorial", "admin@x.com"],
  ["dashboard/index.html#editorial/novo", "admin@x.com"], ["dashboard/index.html#mensagens", "admin@x.com"],
  ["dashboard/index.html#visao-dono", "dona@x.com"], ["dashboard/index.html#pecas", "dona@x.com"],
  ["dashboard/index.html#perfil", "dona@x.com"]
];

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

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

  await test("curtir e salvar gravam no banco, refletem aria-pressed e desfazem", async () => {
    const { page, log, context } = await ctx({ email: "user@x.com" });
    await page.goto(BASE + "feed.html");
    await settle(page);
    const first = fixtures.tables.feed_publicacoes[2].id;
    const like = `[data-act="like"][data-id="${first}"]`;
    await page.click(like);
    await page.waitForTimeout(200);
    const post = log.find(l => l.method === "POST" && l.path.endsWith("/curtidas"));
    assert(post && JSON.parse(post.body).publicacao_id === first && JSON.parse(post.body).user_id === fixtures.USERS["user@x.com"].id, "POST de curtida incorreto");
    assert(await page.getAttribute(like, "aria-pressed") === "true", "aria-pressed não ficou true");
    await page.click(like);
    await page.waitForTimeout(200);
    assert(log.some(l => l.method === "DELETE" && l.path.endsWith("/curtidas") && l.search.includes(first)), "DELETE da curtida não enviado");
    const already = fixtures.tables.feed_publicacoes[0].id;
    assert(await page.getAttribute(`[data-act="like"][data-id="${already}"]`, "aria-pressed") === "true", "curtida existente não carregada do banco");
    await page.click(`[data-act="save"][data-id="${first}"]`);
    await page.waitForTimeout(200);
    assert(log.some(l => l.method === "POST" && l.path.endsWith("/salvos")), "POST de salvo não enviado");
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

  await test("dono publica peça: foto no Storage + insert vinculado ao brechó", async () => {
    const { page, log, context } = await ctx({ email: "dona@x.com" });
    await page.goto(BASE + "dashboard/index.html#pecas");
    await settle(page);
    await page.click("[data-new] >> nth=0");
    await page.click('[data-intent="publicado"]');
    assert(await page.getAttribute("#pcFoto", "aria-invalid") === "true", "deveria exigir foto");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8Dwn4GBgYGJAQoAAP//AwB7Dwr0PmK9xQAAAABJRU5ErkJggg==", "base64");
    await page.setInputFiles("#pcFoto", { name: "peca.png", mimeType: "image/png", buffer: png });
    await page.fill("#pcTitulo", "Casaco de lã");
    await page.fill("#pcPreco", "120");
    await page.selectOption("#pcTipo", "casaco");
    await page.click('[data-intent="publicado"]');
    await page.waitForTimeout(600);
    const up = log.find(l => l.method === "POST" && l.path.includes("/storage/v1/object/brechos/"));
    const ins = log.find(l => l.method === "POST" && l.path.endsWith("/publicacoes"));
    assert(up, "upload da foto não aconteceu");
    const body = ins && JSON.parse(ins.body);
    assert(body && body.brecho_id === "10000000-0000-0000-0000-000000000001" && body.status === "publicado" && body.preco === 120 && body.imagem_url, `insert incorreto: ${ins && ins.body}`);
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

  /* ---------- resumo ---------- */
  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
  process.exit(failed.length ? 1 : 0);
})();
