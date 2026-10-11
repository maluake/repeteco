/* Dados de teste (somente para o mock dos testes automatizados). */
const day = n => new Date(Date.now() - n * 86400000).toISOString();

const USERS = {
  "user@x.com": { id: "00000000-0000-0000-0000-00000000000c", nome: "Clara Souza", role: "usuario" },
  "dona@x.com": { id: "00000000-0000-0000-0000-00000000000b", nome: "Rita Lima", role: "dono" },
  "admin@x.com": { id: "00000000-0000-0000-0000-00000000000a", nome: "Equipe Repeteco", role: "admin" }
};

function jwt(payload) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.assinatura`;
}

function sessionFor(email) {
  const u = USERS[email] || USERS["user@x.com"];
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = { id: u.id, aud: "authenticated", role: "authenticated", email, user_metadata: { nome: u.nome }, app_metadata: {}, created_at: day(30) };
  return {
    access_token: jwt({ sub: u.id, email, role: "authenticated", exp, aud: "authenticated" }),
    refresh_token: "refresh", token_type: "bearer", expires_in: 86400, expires_at: exp, user
  };
}

const B1 = "10000000-0000-0000-0000-000000000001";
const B2 = "10000000-0000-0000-0000-000000000002";
const B3 = "10000000-0000-0000-0000-000000000003";

const brechosPublicos = [
  { id: B1, slug: "garimpo-da-vila", nome: "Garimpo da Vila", descricao: "Brechó de bairro com curadoria de peças dos anos 70 a 90, alfaiataria e jeans.", cidade: "São Paulo", bairro: "Pinheiros", endereco: "Rua dos Pinheiros, 500", latitude: -23.5614, longitude: -46.6916, categorias: ["brechó", "moda vintage"], whatsapp: "11999990000", instagram: "garimpodavila", site: null, horario: "Ter a sáb, 11h às 19h", foto_capa: "https://img.test/capa-vila.jpg", logo_url: null, modalidade: "fisica", loja_online_url: null, created_at: day(40), total_publicacoes: 6, total_curtidas: 3 },
  { id: B2, slug: "baú-da-avo", nome: "Baú da Avó", descricao: "Antiguidades, louças e roupas de festa.", cidade: "São Paulo", bairro: "Bela Vista", endereco: null, latitude: null, longitude: null, categorias: ["antiquário"], whatsapp: null, instagram: "baudaavo", site: "https://baudaavo.com.br", horario: null, foto_capa: null, logo_url: null, modalidade: "online", loja_online_url: "https://baudaavo.com.br/loja", created_at: day(20), total_publicacoes: 2, total_curtidas: 0 },
  { id: B3, slug: "sebo-liberdade", nome: "Sebo Liberdade", descricao: "Livros, discos e revistas.", cidade: "São Paulo", bairro: "Liberdade", endereco: "Rua Galvão Bueno, 100", latitude: -23.5587, longitude: -46.6339, categorias: ["sebo", "vinil"], whatsapp: null, instagram: null, site: null, horario: null, foto_capa: "https://img.test/sebo.jpg", logo_url: null, modalidade: "ambos", loja_online_url: null, created_at: day(5), total_publicacoes: 0, total_curtidas: 1 }
];

const tipos = ["vestido", "jaqueta", "calca", "saia", "bolsa", "vestido", "camisa", "calcado"];
const feed = Array.from({ length: 30 }, (_, i) => {
  const shop = i % 5 === 4 ? brechosPublicos[1] : brechosPublicos[0];
  return {
    id: `20000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
    brecho_id: shop.id,
    titulo: ["Vestido midi floral", "Jaqueta jeans oversized", "Calça de alfaiataria", "Saia plissada", "Bolsa de couro", "Vestido de festa", "Camisa de seda", "Bota cano alto"][i % 8] + ` ${i + 1}`,
    descricao: "Peça em ótimo estado, lavada e revisada.",
    imagem_url: `https://img.test/peca-${i + 1}.jpg`,
    alt_text: null,
    tipo: tipos[i % 8],
    tamanho: ["P", "M", "G", "38", "Único"][i % 5],
    preco: [45, 80, 120, 60, 210, 150, 95, 260][i % 8],
    condicao: ["otimo", "bom", "nova", "marcas"][i % 4],
    estilo: ["vintage", "anos-90", "casual", "festa"][i % 4],
    genero: ["feminino", "unissex", "masculino"][i % 3],
    disponivel: i % 7 !== 6,
    created_at: day(i),
    brecho_nome: shop.nome, brecho_slug: shop.slug, bairro: shop.bairro, cidade: shop.cidade,
    brecho_logo: null, brecho_whatsapp: shop.whatsapp, brecho_instagram: shop.instagram,
    total_curtidas: i % 4,
    // a cada 3 peças, uma galeria com 3 fotos; a cada 6, uma promoção
    thumb_url: `https://img.test/peca-${i + 1}-thumb.jpg`,
    imagens: i % 3 === 0
      ? [1, 2, 3].map(n => ({ url: `https://img.test/peca-${i + 1}${n > 1 ? `-${n}` : ""}.jpg`, thumb_url: `https://img.test/peca-${i + 1}${n > 1 ? `-${n}` : ""}-thumb.jpg`, alt: n === 1 ? null : `Detalhe ${n}` }))
      : [{ url: `https://img.test/peca-${i + 1}.jpg`, thumb_url: `https://img.test/peca-${i + 1}-thumb.jpg`, alt: null }],
    preco_original: i % 6 === 1 ? [45, 80, 120, 60, 210, 150, 95, 260][i % 8] * 2 : null,
    em_promocao: i % 6 === 1,
    brecho_modalidade: shop.modalidade, brecho_loja_online: shop.loja_online_url
  };
});

const eventos = [
  { id: "40000000-0000-0000-0000-000000000001", slug: "feira-repeteco-primavera", titulo: "Feira Repeteco de Primavera", resumo: "Brechós da cidade reunidos num sábado de garimpo, troca e música.", descricao: "Uma tarde com brechós selecionados, oficina de customização e troca de peças.\n\n## Programação\n\n- 11h abertura\n- 15h oficina", data_inicio: new Date(Date.now() + 12 * 86400000).toISOString(), data_fim: new Date(Date.now() + 12 * 86400000 + 8 * 3600000).toISOString(), formato: "presencial", local_nome: "Praça Benedito Calixto", endereco: "Praça Benedito Calixto, s/n", bairro: "Pinheiros", cidade: "São Paulo", link: null, capa_url: "https://img.test/evento-1.jpg", capa_alt: "Araras de roupas numa praça", aceita_parcerias: true, status: "publicado", created_at: day(5), updated_at: day(5) },
  { id: "40000000-0000-0000-0000-000000000002", slug: "live-garimpo-consciente", titulo: "Live: garimpo consciente", resumo: "Conversa online sobre consumo e cuidado com as peças.", descricao: "Transmissão ao vivo.", data_inicio: new Date(Date.now() + 30 * 86400000).toISOString(), data_fim: null, formato: "online", local_nome: null, endereco: null, bairro: null, cidade: null, link: "https://youtube.com/@repeteco", capa_url: null, capa_alt: null, aceita_parcerias: false, status: "publicado", created_at: day(2), updated_at: day(2) },
  { id: "40000000-0000-0000-0000-000000000003", slug: "bazar-de-inverno", titulo: "Bazar de inverno", resumo: "Edição passada.", descricao: "Já aconteceu.", data_inicio: day(40), data_fim: null, formato: "presencial", local_nome: "Galpão Liberdade", endereco: null, bairro: "Liberdade", cidade: "São Paulo", link: null, capa_url: null, capa_alt: null, aceita_parcerias: false, status: "publicado", created_at: day(60), updated_at: day(60) },
  { id: "40000000-0000-0000-0000-000000000004", slug: "rascunho-evento", titulo: "Evento em planejamento", resumo: null, descricao: null, data_inicio: new Date(Date.now() + 60 * 86400000).toISOString(), data_fim: null, formato: "hibrido", local_nome: null, endereco: null, bairro: null, cidade: null, link: null, capa_url: null, capa_alt: null, aceita_parcerias: true, status: "rascunho", created_at: day(1), updated_at: day(1) }
];

const artigos = [
  { id: "30000000-0000-0000-0000-000000000001", slug: "como-garimpar-em-sao-paulo", titulo: "Como garimpar em São Paulo sem sair com sacolas cheias", subtitulo: "Um roteiro de bairro em bairro para quem quer comprar menos e melhor.", conteudo: "Garimpar é uma prática de atenção.\n\n## Antes de sair\n\nFaça uma lista do que falta no seu armário.\n\n> A peça certa é a que você vai usar muitas vezes.\n\n- Leve sacola própria\n- Confira costuras e zíperes\n\nLeia também o [guia de bairros](https://repeteco.test/editorial).", capa_url: "https://img.test/editorial-1.jpg", capa_alt: "Arara de roupas em um brechó", categoria: "guias", autor_nome: "Equipe Repeteco", status: "publicado", publicado_em: day(3), created_at: day(4), updated_at: day(3) },
  { id: "30000000-0000-0000-0000-000000000002", slug: "o-ciclo-de-vida-de-uma-jaqueta", titulo: "O ciclo de vida de uma jaqueta jeans", subtitulo: "Quanto água e energia uma peça carrega — e por que fazê-la circular importa.", conteudo: "Texto.", capa_url: "https://img.test/editorial-2.jpg", capa_alt: "Jaqueta jeans pendurada", categoria: "sustentabilidade", autor_nome: "Equipe Repeteco", status: "publicado", publicado_em: day(10), created_at: day(11), updated_at: day(10) },
  { id: "30000000-0000-0000-0000-000000000003", slug: "rascunho-interno", titulo: "Rascunho interno", subtitulo: null, conteudo: "Em construção.", capa_url: null, categoria: "cultura", autor_nome: "Equipe Repeteco", status: "rascunho", publicado_em: null, created_at: day(1), updated_at: day(1) }
];

const profiles = Object.entries(USERS).map(([email, u], i) => ({ id: u.id, nome: u.nome, role: u.role, cidade: "São Paulo", bio: null, avatar_url: null, created_at: day(30 - i) }));

const fixtures = {
  sessionFor,
  USERS,
  tables: {
    brechos_publicos: brechosPublicos,
    feed_publicacoes: feed,
    publicacoes: feed.slice(0, 6).map(p => ({ ...p, status: "publicado" })).concat([{ ...feed[6], id: "20000000-0000-0000-0000-0000000000ff", titulo: "Rascunho de casaco", status: "rascunho" }]),
    brechos: [
      { ...brechosPublicos[0], user_id: USERS["dona@x.com"].id, status: "approved", nome_responsavel: "Rita Lima", email_responsavel: "dona@x.com" },
      { id: "10000000-0000-0000-0000-000000000009", slug: "novo-brecho", nome: "Novo Brechó", descricao: "Cadastro aguardando análise.", cidade: "São Paulo", bairro: "Moema", categorias: ["brechó"], status: "pending", user_id: "99999999-0000-0000-0000-000000000000", nome_responsavel: "Ana", email_responsavel: "ana@x.com", whatsapp: "11988887777", created_at: day(1) }
    ],
    profiles,
    curtidas: [{ id: 1, user_id: USERS["user@x.com"].id, publicacao_id: feed[0].id, brecho_id: null, created_at: day(1) }],
    salvos: [
      { id: 1, user_id: USERS["user@x.com"].id, publicacao_id: feed[1].id, brecho_id: null, created_at: day(1) },
      { id: 2, user_id: USERS["user@x.com"].id, publicacao_id: null, brecho_id: B1, created_at: day(2) }
    ],
    artigos,
    contatos: [{ id: 1, nome: "Ana", email: "ana@x.com", assunto: "brecho", mensagem: "Como faço para cadastrar meu brechó?", lido: false, created_at: day(1) }],
    brecho_eventos: [],
    eventos,
    evento_parcerias: [{ id: "50000000-0000-0000-0000-000000000001", evento_id: eventos[0].id, user_id: null, brecho_id: null, nome: "Loja Amiga", email: "contato@lojaamiga.com", telefone: null, tipo: "expositor", mensagem: "Queremos montar uma banca.", status: "nova", created_at: day(1) }]
  },
  rpc: {
    // Simula as funções da v6 sobre as tabelas curtidas/salvos do fixture.
    minhas_interacoes: session => {
      if (!session) throw new Error("Entre na sua conta para curtir ou salvar.");
      const uid = session.user.id;
      const map = (tipo, rows) => rows.filter(r => r.user_id === uid).map(r => ({ tipo, publicacao_id: r.publicacao_id, brecho_id: r.brecho_id }));
      return [...map("curtida", fixtures.tables.curtidas), ...map("salvo", fixtures.tables.salvos)];
    },
    alternar_interacao: (session, body) => {
      if (!session) throw new Error("Entre na sua conta para curtir ou salvar.");
      const rows = fixtures.tables[body.p_tipo === "curtida" ? "curtidas" : "salvos"];
      const uid = session.user.id;
      const i = rows.findIndex(r => r.user_id === uid && (body.p_publicacao_id ? r.publicacao_id === body.p_publicacao_id : r.brecho_id === body.p_brecho_id));
      if (i >= 0) { rows.splice(i, 1); return false; }
      rows.push({ id: rows.length + 100, user_id: uid, publicacao_id: body.p_publicacao_id, brecho_id: body.p_brecho_id, created_at: new Date().toISOString() });
      return true;
    },
    estatisticas_brecho: {
      visitas_30d: 42, cliques_mapa_30d: 7, cliques_contato_30d: 3, curtidas_brecho: 3, salvos_brecho: 2,
      curtidas_publicacoes: 9, salvos_publicacoes: 4, publicacoes: 6, rascunhos: 1,
      visitas_por_dia: Array.from({ length: 14 }, (_, i) => ({ dia: day(13 - i).slice(0, 10), total: [1, 3, 0, 2, 5, 4, 2, 6, 3, 1, 4, 5, 3, 3][i] })),
      top_publicacoes: feed.slice(0, 3).map((p, i) => ({ id: p.id, titulo: p.titulo, imagem_url: p.imagem_url, curtidas: 4 - i, salvos: 2 - (i % 2) }))
    },
    admin_resumo: {
      usuarios: 3, donos: 1, admins: 1, brechos_aprovados: 3, brechos_pendentes: 1, brechos_recusados: 0, brechos_sem_localizacao: 1,
      publicacoes: 30, brechos_online: 2, promocoes: 5, eventos_proximos: 2, parcerias_novas: 1, artigos_publicados: 2, artigos_rascunho: 1, curtidas: 12, salvos: 7, visitas_30d: 120, mensagens_nao_lidas: 1,
      semanas: Array.from({ length: 12 }, (_, i) => ({ semana: day((11 - i) * 7).slice(0, 10), usuarios: i % 3, brechos: i % 2, publicacoes: i, interacoes: i * 2 }))
    },
    admin_listar_usuarios: Object.entries(USERS).map(([email, u]) => ({ id: u.id, nome: u.nome, email, role: u.role, cidade: "São Paulo", avatar_url: null, created_at: day(30), last_sign_in_at: day(1) }))
  }
};

module.exports = { fixtures };
