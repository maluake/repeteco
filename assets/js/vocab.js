/* REPETECO — vocabulário controlado usado em formulários, filtros e rótulos.
   Os valores (chaves) são os gravados no banco; os rótulos são exibidos. */
(function () {
  const R = (window.R = window.R || {});
  const list = obj => Object.entries(obj).map(([value, label]) => ({ value, label }));

  R.vocab = {
    tipos: {
      vestido: "Vestidos", saia: "Saias", calca: "Calças", shorts: "Shorts",
      camisa: "Camisas", camiseta: "Camisetas", blusa: "Blusas", tricot: "Tricô e malhas",
      jaqueta: "Jaquetas", casaco: "Casacos", blazer: "Blazers", macacao: "Macacões",
      calcado: "Calçados", bolsa: "Bolsas", acessorio: "Acessórios", bijuteria: "Bijuterias",
      casa: "Casa e decoração", livro: "Livros", disco: "Discos e vinis", outro: "Outros"
    },
    tamanhos: ["PP", "P", "M", "G", "GG", "XG", "34", "36", "38", "40", "42", "44", "46", "48", "Único"],
    condicoes: { nova: "Nova com etiqueta", otimo: "Ótimo estado", bom: "Bom estado", marcas: "Com marcas de uso" },
    generos: { feminino: "Feminino", masculino: "Masculino", unissex: "Unissex", infantil: "Infantil" },
    estilos: {
      vintage: "Vintage", "anos-70": "Anos 70", "anos-80": "Anos 80", "anos-90": "Anos 90", y2k: "Y2K",
      classico: "Clássico", streetwear: "Streetwear", alfaiataria: "Alfaiataria", boho: "Boho",
      festa: "Festa", casual: "Casual", esportivo: "Esportivo"
    },
    categoriasBrecho: ["brechó", "moda vintage", "antiquário", "sebo", "vinil", "colecionáveis", "infantil", "luxo"],
    editorial: {
      moda: "Moda", sustentabilidade: "Sustentabilidade", "consumo-consciente": "Consumo consciente",
      brechos: "Brechós", cultura: "Cultura", tendencias: "Tendências", "historia-da-moda": "História da moda", guias: "Guias"
    },
    precos: [
      { value: "50", label: "Até R$ 50" }, { value: "100", label: "Até R$ 100" },
      { value: "200", label: "Até R$ 200" }, { value: "400", label: "Até R$ 400" }
    ]
  };
  R.vocab.list = list;
  R.label = (group, value) => (R.vocab[group] && R.vocab[group][value]) || value || "";
})();
