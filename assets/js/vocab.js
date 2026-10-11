/* REPETECO — vocabulário controlado usado em formulários, filtros e rótulos.
   Os valores (chaves) são os gravados no banco; os rótulos são exibidos. */
(function () {
  const R = (window.R = window.R || {});
  const list = obj => Object.entries(obj).map(([value, label]) => ({ value, label }));

  // Tipos de peça em grupos: o grupo define que tipo de tamanho se aplica.
  const tipoGrupos = [
    { label: "Roupas", medida: "roupa", tipos: {
      vestido: "Vestidos", saia: "Saias", calca: "Calças", shorts: "Shorts", camisa: "Camisas",
      camiseta: "Camisetas", blusa: "Blusas", tricot: "Tricô e malhas", jaqueta: "Jaquetas",
      casaco: "Casacos", blazer: "Blazers", macacao: "Macacões", moda_praia: "Moda praia", infantil: "Roupa infantil"
    } },
    { label: "Calçados", medida: "calcado", tipos: {
      calcado: "Calçados (todos)", tenis: "Tênis", bota: "Botas", sandalia: "Sandálias", sapato: "Sapatos e mocassins"
    } },
    { label: "Acessórios", medida: "unico", tipos: {
      bolsa: "Bolsas", acessorio: "Acessórios", bijuteria: "Bijuterias", oculos: "Óculos", chapeu: "Chapéus e bonés", cinto: "Cintos"
    } },
    { label: "Casa e objetos", medida: "nenhuma", tipos: {
      casa: "Casa e decoração", loucas: "Louças e utensílios", movel: "Móveis", luminaria: "Luminárias",
      brinquedo: "Brinquedos", eletronico: "Eletrônicos retrô", colecionavel: "Colecionáveis"
    } },
    { label: "Cultura", medida: "nenhuma", tipos: {
      livro: "Livros", disco: "Discos e vinis", arte: "Arte e quadros", instrumento: "Instrumentos musicais"
    } },
    { label: "Outros", medida: "nenhuma", tipos: { outro: "Outros" } }
  ];
  const tipos = Object.assign({}, ...tipoGrupos.map(g => g.tipos));

  R.vocab = {
    tipoGrupos,
    tipos,
    tamanhos: ["PP", "P", "M", "G", "GG", "XG", "34", "36", "38", "40", "42", "44", "46", "48", "Único"],
    numeracoes: ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
    condicoes: { nova: "Nova com etiqueta", otimo: "Ótimo estado", bom: "Bom estado", marcas: "Com marcas de uso" },
    generos: { feminino: "Feminino", masculino: "Masculino", unissex: "Unissex", infantil: "Infantil" },
    // Estilos sugeridos; o brechó pode escrever qualquer outro.
    estilos: {
      vintage: "Vintage", "anos-70": "Anos 70", "anos-80": "Anos 80", "anos-90": "Anos 90", y2k: "Y2K",
      classico: "Clássico", streetwear: "Streetwear", alfaiataria: "Alfaiataria", boho: "Boho",
      festa: "Festa", casual: "Casual", esportivo: "Esportivo", minimalista: "Minimalista",
      grunge: "Grunge", romantico: "Romântico", workwear: "Workwear", gotico: "Gótico", "cottagecore": "Cottagecore"
    },
    categoriasBrecho: ["brechó", "moda vintage", "antiquário", "sebo", "vinil", "colecionáveis", "infantil", "luxo", "calçados", "casa e decoração"],
    modalidades: { fisica: "Loja física", online: "Só online", ambos: "Física e online" },
    editorial: {
      moda: "Moda", sustentabilidade: "Sustentabilidade", "consumo-consciente": "Consumo consciente",
      brechos: "Brechós", cultura: "Cultura", tendencias: "Tendências", "historia-da-moda": "História da moda", guias: "Guias"
    },
    formatosEvento: { presencial: "Presencial", online: "Online", hibrido: "Presencial e online" },
    parcerias: {
      expositor: "Quero expor meu brechó", apoio: "Apoio (espaço, estrutura)", patrocinio: "Patrocínio",
      divulgacao: "Divulgação / mídia", voluntariado: "Voluntariado", outro: "Outra forma"
    },
    precos: [
      { value: "50", label: "Até R$ 50" }, { value: "100", label: "Até R$ 100" },
      { value: "200", label: "Até R$ 200" }, { value: "400", label: "Até R$ 400" }
    ]
  };
  R.vocab.list = list;
  R.label = (group, value) => (R.vocab[group] && R.vocab[group][value]) || value || "";
  // Tipo de medida do tipo de peça: roupa, calcado, unico ou nenhuma.
  R.medidaDoTipo = tipo => (tipoGrupos.find(g => tipo in g.tipos) || { medida: "roupa" }).medida;
  // Estilo livre: guarda em minúsculas, sem espaços repetidos.
  R.normalizarEstilo = v => String(v || "").trim().replace(/\s+/g, " ").toLowerCase().slice(0, 40);
  R.labelEstilo = v => R.vocab.estilos[v] || (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");
  // Opções de <select> agrupadas por categoria de peça.
  R.tipoOptions = (current = "", empty = "Selecione") => `<option value="">${empty}</option>` + tipoGrupos.map(g =>
    `<optgroup label="${g.label}">${Object.entries(g.tipos).map(([v, l]) => `<option value="${v}"${v === current ? " selected" : ""}>${l}</option>`).join("")}</optgroup>`).join("");
})();
