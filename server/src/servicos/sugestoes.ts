function sugerirItensDestino(destination, objects = []) {
  const d = String(destination || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const rules: Array<[string, string[]]> = [
    [
      'academia',
      [
        'Garrafa de água',
        'Toalha',
        'Fone de ouvido'
      ]
    ],
    [
      'trabalho',
      [
        'Notebook',
        'Carregador',
        'Crachá'
      ]
    ],
    [
      'escola',
      [
        'Mochila',
        'Caderno ou material da aula',
        'Estojo com lápis e canetas',
        'Livros ou apostilas do dia',
        'Agenda ou planner',
        'Garrafa de água',
        'Lanche'
      ]
    ],
    [
      'colegio',
      [
        'Mochila',
        'Caderno ou material da aula',
        'Estojo com lápis e canetas',
        'Livros ou apostilas do dia',
        'Agenda ou planner',
        'Garrafa de água',
        'Lanche'
      ]
    ],
    [
      'faculdade',
      [
        'Caderno',
        'Notebook',
        'Carregador'
      ]
    ],
    [
      'viagem',
      [
        'Documento',
        'Carteira',
        'Carregador'
      ]
    ],
    [
      'praia',
      [
        'Protetor solar',
        'Toalha',
        'Garrafa de água',
        'Chapéu ou boné',
        'Roupa de banho',
        'Chinelo',
        'Óculos de sol'
      ]
    ],
    [
      'mercado',
      [
        'Carteira',
        'Sacola'
      ]
    ],
    [
      'medico',
      [
        'Documento',
        'Carteira',
        'Cartão do convênio'
      ]
    ]
  ];

  let base = [];

  for (const [k, v] of rules) {
    if (d.includes(k)) {
      base.push(...v);
    }
  }

  const registered = objects
    .filter(o => o.important)
    .map(o => o.name);

  return [
    ...new Set([
      ...registered,
      ...base
    ])
  ].slice(0, 12);
}

function sugestõesPorPerto(categorias = []) {
  const relacionadas = new Set(categorias);
  const mapa = [
    [['Educação'], ['Caderno', 'Caneta', 'Mochila', 'Notebook']],
    [['Saúde'], ['Documento', 'Cartão do convênio', 'Carteira', 'Chaves']],
    [['Mercados e lojas'], ['Carteira', 'Cartão', 'Sacola reutilizável', 'Celular']],
    [['Alimentação'], ['Carteira', 'Celular', 'Chaves']],
    [['Transporte'], ['Cartão de transporte', 'Carteira', 'Celular', 'Chaves']],
    [['Lazer e parques'], ['Garrafa de água', 'Boné', 'Celular', 'Chaves']],
    [['Esportes'], ['Garrafa de água', 'Toalha', 'Fone de ouvido']],
    [['Hospedagem'], ['Documento', 'Carteira', 'Celular', 'Carregador']],
    [['Cultura'], ['Celular', 'Carteira', 'Documento']],
  ];
  return [...new Set(mapa.filter(([nomes]) => nomes.some(nome => relacionadas.has(nome))).flatMap(([, itens]) => itens))];
}

function sugerirObjetosRelacionados(destination, objects, nearbyCategories = []) {
  const candidateNames = [...sugerirItensDestino(destination, []), ...sugestõesPorPerto(nearbyCategories)];
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  const normalizedCandidates = candidateNames.map(normalize);

  return objects
    .filter(object => {
      if (object.important) return true;
      const nome = normalize(object.name);
      const categoria = normalize(object.category);
      return normalizedCandidates.some(candidate =>
        (nome && (nome.includes(candidate) || candidate.includes(nome))) ||
        (categoria && categoria !== 'outros' && (candidate.includes(categoria) || categoria.includes(candidate)))
      );
    })
    .map(object => ({
      id: object.id,
      name: object.name,
      category: object.category || 'Outros',
      essential: Boolean(object.important),
      image_data: object.image_data || null,
    }));
}

module.exports = { sugerirItensDestino, sugestõesPorPerto, sugerirObjetosRelacionados };
