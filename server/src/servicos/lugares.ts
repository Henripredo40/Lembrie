const ufPorEstado: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapá: 'AP', amazonas: 'AM', bahia: 'BA', ceará: 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', goiás: 'GO', maranhão: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', pará: 'PA',
  paraíba: 'PB', paraná: 'PR', pernambuco: 'PE', piauí: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondônia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'são paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

function formatarResultadoLugar(item, cepPreferido = '') {
  const endereço = item.address || {};
  const códigoEstado = String(endereço['ISO3166-2-lvl4'] || '').split('-').pop().toUpperCase();
  const uf = /^[A-Z]{2}$/.test(códigoEstado)
    ? códigoEstado
    : ufPorEstado[String(endereço.state || '').toLocaleLowerCase('pt-BR')] || '';
  return {
    id: String(item.place_id || `coord:${item.lat},${item.lon}`),
    nome: item.name || item.display_name.split(',')[0],
    endereço: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    cep: cepPreferido || endereço.postcode || '',
    logradouro: endereço.road || endereço.pedestrian || endereço.residential || '',
    bairro: endereço.suburb || endereço.neighbourhood || endereço.city_district || '',
    cidade: endereço.city || endereço.town || endereço.village || endereço.municipality || '',
    uf,
    número: endereço.house_number || '',
    tipo: item.type || item.category || '',
  };
}

function pontuarCorrespondenciaBusca(item, consulta) {
  const normalizar = valor => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\b(qd|q)\b/g, 'quadra')
    .replace(/\b(bl)\b/g, 'bloco')
    .replace(/\b(cj)\b/g, 'conjunto')
    .replace(/\b(st)\b/g, 'setor')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const textoConsulta = normalizar(consulta);
  const endereço = item.address || {};
  const textoResultado = normalizar(`${item.name || ''} ${item.display_name || ''} ${endereço['ISO3166-2-lvl4'] || ''} ${endereço.postcode || ''}`);
  const termos = textoConsulta.split(' ').filter(termo => termo.length > 1 && !['brasil', 'brazil', 'distrito', 'federal'].includes(termo));
  const encontrados = termos.filter(termo => textoResultado.includes(termo)).length;
  return {
    exata: textoResultado.includes(textoConsulta),
    cobertura: termos.length ? encontrados / termos.length : 0,
    importancia: Number(item.importance) || 0,
  };
}

module.exports = { formatarResultadoLugar, pontuarCorrespondenciaBusca };
