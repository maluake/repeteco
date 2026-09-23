/* =====================================================
   REPETECO — app.js
   Site público + autenticação + favoritos/salvos
   ===================================================== */

let currentUser = null;
let perfilAtual = null;
let brechos = [];
let currentFilter = "all";
let currentModalId = null;
const likedSet = new Set();
const savedSet = new Set();
let toastTimer = null;
let appInicializado = false;

function sb() {
  return window.supabaseClient || null;
}

function mostrarToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}
window.showToast = mostrarToast;
window.mostrarToast = mostrarToast;

function uiDeslogado() {
  const nav = document.getElementById("navActions");
  if (nav) nav.classList.remove("logged");
  const login = document.getElementById("btnLogin");
  const signup = document.getElementById("btnSignup");
  if (login) login.style.display = "inline-flex";
  if (signup) signup.style.display = "inline-flex";
  const avatar = document.getElementById("avatarBtn");
  if (avatar) { avatar.textContent = "?"; avatar.style.display = "none"; }
  ["profileName", "profileEmail"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = id === "profileName" ? "usuário" : "—";
  });
  const navAnalises = document.getElementById("navAnalises");
  if (navAnalises) navAnalises.style.display = "none";
  const profileEdit = document.getElementById("profileEditLink");
  if (profileEdit) profileEdit.style.display = "none";
}

function uiLogado(nome, email, role) {
  const nav = document.getElementById("navActions");
  if (nav) { nav.classList.add("logged"); nav.style.display = "flex"; }
  const login = document.getElementById("btnLogin");
  const signup = document.getElementById("btnSignup");
  if (login) login.style.display = "none";
  if (signup) signup.style.display = "none";
  const n = nome || "Usuário";
  const avatar = document.getElementById("avatarBtn");
  if (avatar) { avatar.textContent = n.charAt(0).toUpperCase(); avatar.style.display = "flex"; }
  const pn = document.getElementById("profileName");
  const pe = document.getElementById("profileEmail");
  if (pn) pn.textContent = n;
  if (pe) pe.textContent = email || "";
  const navAnalises = document.getElementById("navAnalises");
  if (navAnalises) navAnalises.style.display = (role === "admin" || role === "dono") ? "block" : "none";
  const profileEdit = document.getElementById("profileEditLink");
  if (profileEdit) profileEdit.style.display = "block";
}

async function carregarPerfil(user) {
  if (!user || !sb()) { perfilAtual = null; uiDeslogado(); return null; }
  try {
    const { data, error } = await sb().from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    perfilAtual = data || { id: user.id, nome: user.user_metadata?.nome || user.email?.split("@")[0], role: "usuario" };

    // Se o admin já aprovou um brechó deste usuário, o acesso ao painel
    // de dono continua funcionando mesmo que a atualização da role no
    // perfil tenha falhado ou ainda não tenha sido sincronizada.
    if (perfilAtual.role !== "admin" && perfilAtual.role !== "dono") {
      const { data: brechoAprovado, error: brechoError } = await sb()
        .from("brechos")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .limit(1);

      if (!brechoError && brechoAprovado?.length) {
        perfilAtual = { ...perfilAtual, role: "dono" };
      }
    }

    const nome = perfilAtual.nome || user.user_metadata?.nome || user.email?.split("@")[0] || "Usuário";
    const role = perfilAtual.role || perfilAtual.tipo || "usuario";
    uiLogado(nome, user.email, role);
    await carregarInteracoes();
    return perfilAtual;
  } catch (e) {
    console.error("[Repeteco] carregarPerfil:", e);
    perfilAtual = { id: user.id, nome: user.email?.split("@")[0] || "Usuário", role: "usuario" };
    uiLogado(perfilAtual.nome, user.email, "usuario");
    return perfilAtual;
  }
}

async function carregarUsuario() {
  if (!sb()) return null;
  const { data, error } = await sb().auth.getUser();
  if (error || !data?.user) { currentUser = null; perfilAtual = null; uiDeslogado(); return null; }
  currentUser = data.user;
  await carregarPerfil(data.user);
  return currentUser;
}

async function doLogin() {
  const email = document.getElementById("loginEmail")?.value.trim();
  const senha = document.getElementById("loginPass")?.value;
  if (!email || !senha) return mostrarToast("preencha e-mail e senha");
  const { data, error } = await sb().auth.signInWithPassword({ email, password: senha });
  if (error) return mostrarToast(error.message === "Invalid login credentials" ? "e-mail ou senha incorretos" : error.message);
  currentUser = data.user;
  await carregarPerfil(data.user);
  closeAuth();
  mostrarToast("bem-vinda(o)! 💚");
}

async function criarPerfilSeNecessario(user, nome) {
  const { data: existente } = await sb().from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existente) {
    const { error } = await sb().from("profiles").insert({ id: user.id, nome, role: "usuario" });
    if (error) console.warn("[Repeteco] perfil ainda não pôde ser criado:", error.message);
  }
}

async function doSignup() {
  const nome = document.getElementById("signupName")?.value.trim();
  const email = document.getElementById("signupEmail")?.value.trim();
  const senha = document.getElementById("signupPass")?.value;
  if (!nome || !email || !senha) return mostrarToast("preencha todos os campos");
  if (senha.length < 6) return mostrarToast("senha deve ter ao menos 6 caracteres");

  const { data, error } = await sb().auth.signUp({ email, password: senha, options: { data: { nome, name: nome } } });
  if (error) return mostrarToast(error.message || "não foi possível criar conta");
  if (data.user && data.session) {
    await criarPerfilSeNecessario(data.user, nome);
    currentUser = data.user;
    await carregarPerfil(data.user);
    closeAuth();
    mostrarToast("conta criada! 💚");
  } else {
    mostrarToast("conta criada! confirme seu e-mail 📧");
    closeAuth();
  }
}

async function doLogout() {
  if (sb()) await sb().auth.signOut();
  currentUser = null;
  perfilAtual = null;
  likedSet.clear();
  savedSet.clear();
  closeProfile();
  uiDeslogado();
  renderFeed(currentFilter);
  mostrarToast("até logo! 👋");
}

function openAuth(tab = "login") {
  document.getElementById("authModal")?.classList.add("open");
  switchAuth(tab);
}
function closeAuth() { document.getElementById("authModal")?.classList.remove("open"); }
function closeAuthOnBg(e) { if (e.target === document.getElementById("authModal")) closeAuth(); }
function switchAuth(tab) {
  const login = document.getElementById("formLogin");
  const signup = document.getElementById("formSignup");
  login?.classList.toggle("active", tab === "login");
  signup?.classList.toggle("active", tab === "signup");
  document.getElementById("authTabLogin")?.classList.toggle("active", tab === "login");
  document.getElementById("authTabSignup")?.classList.toggle("active", tab === "signup");
}
function toggleProfile() {
  if (!currentUser) return openAuth("login");
  document.getElementById("profileDropdown")?.classList.toggle("open");
}
function closeProfile() { document.getElementById("profileDropdown")?.classList.remove("open"); }
document.addEventListener("click", e => {
  const pd = document.getElementById("profileDropdown");
  const av = document.getElementById("avatarBtn");
  if (pd?.classList.contains("open") && !pd.contains(e.target) && !av?.contains(e.target)) pd.classList.remove("open");
});

function abrirPerfilCliente() {
  if (!currentUser) return openAuth("login");
  const modal = document.getElementById("clientProfileModal");
  if (!modal) return;
  const name = document.getElementById("clientProfileName");
  const city = document.getElementById("clientProfileCity");
  const bio = document.getElementById("clientProfileBio");
  const email = document.getElementById("clientProfileEmail");
  if (name) name.value = perfilAtual?.nome || currentUser.user_metadata?.nome || currentUser.email?.split("@")[0] || "";
  if (city) city.value = perfilAtual?.cidade || "";
  if (bio) bio.value = perfilAtual?.bio || "";
  if (email) email.value = currentUser.email || "";
  document.getElementById("clientProfileMessage")?.replaceChildren();
  closeProfile();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => name?.focus(), 50);
}
function fecharPerfilCliente() {
  const modal = document.getElementById("clientProfileModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
async function salvarPerfilCliente(event) {
  event.preventDefault();
  if (!currentUser || !sb()) return;
  const nome = document.getElementById("clientProfileName")?.value.trim();
  const cidade = document.getElementById("clientProfileCity")?.value.trim() || null;
  const bio = document.getElementById("clientProfileBio")?.value.trim() || null;
  const msg = document.getElementById("clientProfileMessage");
  if (!nome) { if (msg) msg.textContent = "informe seu nome."; return; }
  try {
    const { error } = await sb().from("profiles").update({ nome, cidade, bio }).eq("id", currentUser.id);
    if (error) throw error;
    perfilAtual = { ...(perfilAtual || {}), nome, cidade, bio };
    uiLogado(nome, currentUser.email, perfilAtual.role || "usuario");
    if (msg) msg.textContent = "perfil atualizado ✓";
    mostrarToast("seu perfil foi atualizado! 💚");
    setTimeout(fecharPerfilCliente, 600);
  } catch (e) {
    console.error("[Repeteco] perfil:", e);
    if (msg) msg.textContent = "não foi possível salvar.";
    mostrarToast(e.message || "não foi possível atualizar o perfil");
  }
}

async function abrirDashboard() {
  if (!currentUser) return openAuth("login");
  const role = perfilAtual?.role || perfilAtual?.tipo;
  if (role === "admin" || role === "dono") return window.location.href = "dashboard/index.html";

  // Fallback seguro: a aprovação do brechó também autoriza o painel do
  // proprietário. Isso evita depender exclusivamente da sincronização
  // da coluna profiles.role.
  const { data, error } = await sb()
    .from("brechos")
    .select("id")
    .eq("user_id", currentUser.id)
    .eq("status", "approved")
    .limit(1);

  if (!error && data?.length) {
    perfilAtual = { ...(perfilAtual || {}), role: "dono" };
    return window.location.href = "dashboard/index.html";
  }

  mostrarToast("você ainda não possui um painel disponível");
}

async function carregarBrechos() {
  if (!sb()) return;
  let result = await sb().from("brechos").select("*").eq("status", "approved").order("created_at", { ascending: false });
  if (result.error) result = await sb().from("brechos").select("*").eq("status", "approved").order("criado_em", { ascending: false });
  if (result.error) { console.error("[Repeteco] brechós:", result.error); return; }
  brechos = result.data || [];
  renderHomeBrechos();
  renderFeed(currentFilter);
  renderMapFeed();
}

const CORES = ["#8ECFCA", "#A8D8B0", "#B8C4E8", "#E8C4A0", "#C4B8E8", "#A0C8E0", "#F0D0A0"];
const EMOJIS = ["👗", "🧥", "👘", "🕰️", "♻️", "👟", "💍", "🧵", "👛", "🎵", "🧸"];
function fmt(b, i = 0) {
  return {
    id: b.id,
    name: b.nome || "Brechó",
    loc: [b.bairro, b.cidade].filter(Boolean).join(" · "),
    desc: b.descricao || "Espaço cadastrado no Repeteco.",
    tags: Array.isArray(b.categorias) ? b.categorias : (b.estilo ? [b.estilo] : ["brechó"]),
    color: b.cor || CORES[i % CORES.length],
    emoji: b.emoji || EMOJIS[i % EMOJIS.length],
    imagem: b.foto_capa || b.imagem || null
  };
}

function renderFeed(filter = "all") {
  currentFilter = filter;
  const container = document.getElementById("feedContent");
  if (!container) return;
  let items = brechos.map((b, i) => fmt(b, i));
  if (filter === "saved") items = items.filter(b => savedSet.has(String(b.id)));
  if (filter === "liked") items = items.filter(b => likedSet.has(String(b.id)));
  if (!items.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:12px">${filter === "saved" ? "🔖" : "❤️"}</div><p style="font-weight:600">${filter === "saved" ? "nenhum brechó salvo ainda" : "nenhum brechó encontrado"}</p><p style="font-size:12px;margin-top:6px">explore o Repeteco para encontrar novos espaços.</p></div>`;
    return;
  }
  const card = (b, index) => {
    const liked = likedSet.has(String(b.id)), saved = savedSet.has(String(b.id));
    const heights = ["h1", "h2", "h3", "h2", "h4", "h1"];
    const height = heights[index % heights.length];
    const img = b.imagem
      ? `<img src="${escapeAttr(b.imagem)}" alt="${escapeAttr(b.name)}" class="feed-card-image">`
      : `<span class="feed-card-emoji">${b.emoji}</span>`;
    return `<article class="masonry-item" onclick="openModal('${escapeAttr(b.id)}')">
      <div class="item-img ${height}" style="background:${b.color}">${img}</div>
      <span class="item-badge">${escapeHtml(b.tags[0] || "brechó")}</span>
      <div class="item-actions" onclick="event.stopPropagation()">
        <button type="button" class="action-btn${liked ? " liked" : ""}" aria-label="Curtir" onclick="toggleLike('${escapeAttr(b.id)}',this)">${liked ? "♥" : "♡"}</button>
        <button type="button" class="action-btn${saved ? " saved" : ""}" aria-label="Salvar" onclick="toggleSave('${escapeAttr(b.id)}',this)">${saved ? "★" : "☆"}</button>
      </div>
      <div class="item-meta">
        <div class="brecho">${escapeHtml(b.name)}</div>
        <div class="desc">${escapeHtml(b.loc || "São Paulo")}</div>
      </div>
    </article>`;
  };
  container.innerHTML = `<div class="masonry">${items.map(card).join("")}</div>`;
}

function switchFeed(filter, btn) {
  document.querySelectorAll(".saved-btn").forEach(b => b.classList.remove("active"));
  btn?.classList.add("active");
  renderFeed(filter);
}

async function carregarInteracoes() {
  likedSet.clear(); savedSet.clear();
  if (!currentUser || !sb()) return;
  const [likes, saves] = await Promise.all([
    sb().from("curtidas").select("brecho_id").eq("user_id", currentUser.id),
    sb().from("salvos").select("brecho_id").eq("user_id", currentUser.id)
  ]);
  if (!likes.error) (likes.data || []).forEach(x => likedSet.add(String(x.brecho_id)));
  else console.warn("[Repeteco] curtidas:", likes.error.message);
  if (!saves.error) (saves.data || []).forEach(x => savedSet.add(String(x.brecho_id)));
  else console.warn("[Repeteco] salvos:", saves.error.message);
}

async function toggleLike(id, btn) {
  if (!currentUser) return openAuth("login");
  id = String(id);
  const exists = likedSet.has(id);
  if (exists) {
    const { error } = await sb().from("curtidas").delete().eq("user_id", currentUser.id).eq("brecho_id", id);
    if (error) return mostrarToast("não foi possível remover a curtida");
    likedSet.delete(id);
    mostrarToast("removido dos curtidos");
  } else {
    const { error } = await sb().from("curtidas").insert({ user_id: currentUser.id, brecho_id: id });
    if (error) return mostrarToast("não foi possível curtir este brechó");
    likedSet.add(id);
    mostrarToast("brechó curtido! ❤️");
  }
  if (btn) { btn.textContent = likedSet.has(id) ? "♥" : "♡"; btn.classList.toggle("liked", likedSet.has(id)); }
}

async function toggleSave(id, btn) {
  if (!currentUser) return openAuth("login");
  id = String(id);
  const exists = savedSet.has(id);
  if (exists) {
    const { error } = await sb().from("salvos").delete().eq("user_id", currentUser.id).eq("brecho_id", id);
    if (error) return mostrarToast("não foi possível remover dos salvos");
    savedSet.delete(id);
    mostrarToast("removido dos salvos");
  } else {
    const { error } = await sb().from("salvos").insert({ user_id: currentUser.id, brecho_id: id });
    if (error) return mostrarToast("não foi possível salvar este brechó");
    savedSet.add(id);
    mostrarToast("brechó salvo! 🔖");
  }
  if (btn) { btn.textContent = savedSet.has(id) ? "★" : "☆"; btn.classList.toggle("saved", savedSet.has(id)); }
}

async function trackBrechoEvent(brechoId, tipo) {
  if (!brechoId || !sb()) return;
  try {
    await sb().from("brecho_eventos").insert({
      brecho_id: brechoId,
      user_id: currentUser?.id || null,
      tipo
    });
  } catch (e) {
    // Analytics nunca deve impedir o uso do site.
    console.debug("[Repeteco] analytics indisponível:", e?.message || e);
  }
}

function openModal(id) {
  const brecho = brechos.find(b => String(b.id) === String(id));
  if (!brecho) return;
  const b = fmt(brecho, brechos.indexOf(brecho));
  currentModalId = b.id;
  trackBrechoEvent(b.id, "view");
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl("modalTitle", b.name); setEl("modalLoc", "📍 " + b.loc); setEl("modalDesc", b.desc);
  const tagsEl = document.getElementById("modalTags");
  if (tagsEl) tagsEl.innerHTML = b.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const imgEl = document.getElementById("modalImg");
  if (imgEl) { imgEl.style.background = b.color; imgEl.innerHTML = b.imagem ? `<img src="${escapeAttr(b.imagem)}" alt="${escapeAttr(b.name)}" style="width:100%;height:100%;object-fit:cover">` : `<span id="modalEmoji" style="font-size:48px">${b.emoji}</span>`; }
  document.getElementById("cardModal")?.classList.add("open");
}
function closeModal() { document.getElementById("cardModal")?.classList.remove("open"); }
function closeModalOnBg(e) { if (e.target === document.getElementById("cardModal")) closeModal(); }
async function likeFromModal() { if (!currentUser) { closeModal(); return openAuth("login"); } await toggleLike(currentModalId); renderFeed(currentFilter); }
async function saveFromModal() { if (!currentUser) { closeModal(); return openAuth("login"); } await toggleSave(currentModalId); renderFeed(currentFilter); }

function registrarCliqueMapa(id) { trackBrechoEvent(id, "map_click"); }

function renderMapFeed() {
  const grid = document.getElementById("mapFeedGrid");
  if (!grid) return;
  const items = brechos.slice(0, 6).map((b, i) => fmt(b, i));
  grid.innerHTML = items.map(b => `<div class="feed-card-map" onclick="registrarCliqueMapa('${escapeAttr(b.id)}');openModal('${escapeAttr(b.id)}')"><div class="card-img" style="background:${b.color};display:flex;align-items:center;justify-content:center;font-size:28px">${b.imagem ? `<img src="${escapeAttr(b.imagem)}" alt="" style="width:100%;height:100%;object-fit:cover">` : b.emoji}</div><div class="card-info"><div class="brecho-name">${escapeHtml(b.name)}</div><div class="brecho-loc">📍 ${escapeHtml(b.loc)}</div></div></div>`).join("");
}
function filterMap(bairro) { showPage("map"); const inp = document.getElementById("mapSearch"); if (inp) { inp.value = bairro; handleMapSearch(); } }
function renderHomeBrechos() {
  const c = document.getElementById("carousel1");
  if (!c) return;
  c.innerHTML = brechos.slice(0, 6).map((b, i) => { const d = fmt(b, i); return `<div class="carousel-card" style="background:${d.color}" onclick="openModal('${escapeAttr(d.id)}')"><div class="card-tag">${escapeHtml(d.tags[0] || "destaque")}</div><div class="card-label">${escapeHtml(d.name)} · ${escapeHtml(d.loc)}</div></div>`; }).join("");
}
function scrollCarousel(id, dir) { document.getElementById(id)?.scrollBy({ left: dir * 300, behavior: "smooth" }); }
function handleSearch() {
  const q = document.getElementById("homeSearch")?.value.trim().toLowerCase();
  if (!q) return;
  showPage("feed");
  const results = brechos.map((b, i) => fmt(b, i)).filter(b => b.name.toLowerCase().includes(q) || b.loc.toLowerCase().includes(q) || b.tags.join(" ").toLowerCase().includes(q));
  const container = document.getElementById("feedContent");
  if (!container) return;
  if (!results.length) { container.innerHTML = `<div style="text-align:center;padding:60px">nenhum brechó encontrado para <strong>"${escapeHtml(q)}"</strong></div>`; return; }
  const original = brechos;
  brechos = results.map(r => ({ ...r, nome: r.name, descricao: r.desc, categorias: r.tags }));
  renderFeed("all");
  brechos = original;
}
function handleMapSearch() {
  const q = document.getElementById("mapSearch")?.value.trim().toLowerCase();
  const grid = document.getElementById("mapFeedGrid");
  if (!grid) return;
  if (!q) return renderMapFeed();
  const res = brechos.filter(b => { const d = fmt(b); return d.name.toLowerCase().includes(q) || d.loc.toLowerCase().includes(q); });
  grid.innerHTML = res.length ? res.map((b, i) => { const d = fmt(b, i); return `<div class="feed-card-map" onclick="openModal('${escapeAttr(d.id)}')"><div class="card-img" style="background:${d.color};display:flex;align-items:center;justify-content:center;font-size:28px">${d.imagem ? `<img src="${escapeAttr(d.imagem)}" alt="" style="width:100%;height:100%;object-fit:cover">` : d.emoji}</div><div class="card-info"><div class="brecho-name">${escapeHtml(d.name)}</div><div class="brecho-loc">📍 ${escapeHtml(d.loc)}</div></div></div>`; }).join("") : `<div style="padding:30px;text-align:center;width:100%">nenhum brechó encontrado.</div>`;
}
function showPage(page) {
  document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
  document.getElementById("page-" + page)?.classList.add("active");
  document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
  const active = [...document.querySelectorAll(".nav-tab")].find(b => (b.textContent || "").trim().toLowerCase() === (page === "home" ? "início" : page));
  active?.classList.add("active");
  if (page === "feed") renderFeed(currentFilter);
  if (page === "map") { renderMapFeed(); setTimeout(() => window.iniciarMapaGoogle?.(brechos), 0); }
  window.scrollTo(0, 0);
}
function openContact() { window.location.href = "cadastro.html"; }
function escapeHtml(v) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function escapeAttr(v) { return escapeHtml(v); }

function iniciarListenerAuth() {
  if (!sb()) return;
  sb().auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) await carregarPerfil(currentUser);
    else { perfilAtual = null; likedSet.clear(); savedSet.clear(); uiDeslogado(); renderFeed(currentFilter); }
  });
}

async function initApp() {
  if (appInicializado) return;
  appInicializado = true;
  if (!sb()) return;
  iniciarListenerAuth();
  await carregarUsuario();
  await carregarBrechos();
}

document.addEventListener("DOMContentLoaded", initApp);

function abrirAnalises() {
  return abrirDashboard();
}

Object.assign(window, {
  openAuth, closeAuth, closeAuthOnBg, switchAuth, doLogin, doSignup, doLogout,
  toggleProfile, closeProfile, showPage, switchFeed, toggleLike, toggleSave,
  openModal, closeModal, closeModalOnBg, likeFromModal, saveFromModal,
  handleSearch, handleMapSearch, filterMap, scrollCarousel, openContact, abrirDashboard, abrirAnalises, abrirPerfilCliente, fecharPerfilCliente, salvarPerfilCliente
});
