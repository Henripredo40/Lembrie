import { normalizarTexto, objetoÉEssencial } from './objetos';

export function criarListaSaida(objetos, sugestões = [], somenteEssenciais = false) {
  const base = somenteEssenciais ? objetos.filter(objetoÉEssencial) : objetos;
  const registrados = new Set(objetos.map((objeto) => normalizarTexto(objeto.name)));
  const itens = base.map((objeto) => ({
    id: objeto.id,
    name: objeto.name,
    category: objeto.category,
    image_data: objeto.image_data,
    essential: objetoÉEssencial(objeto),
    sugestao: false,
    conferido: false,
    mostrarNaPlaca: false,
  }));
  const novasSugestoes = sugestões
    .filter((nome) => !registrados.has(normalizarTexto(nome)))
    .map((nome, índice) => ({
      id: 'sugestao-' + índice,
      name: nome,
      category: 'Sugestão',
      essential: false,
      sugestao: true,
      conferido: false,
      mostrarNaPlaca: false,
    }));
  return { itens: [...itens, ...novasSugestoes], sugestões: novasSugestoes };
}

export function alternarItemConferido(lista, id) {
  return lista.map((item) => item.id === id ? { ...item, conferido: !item.conferido } : item);
}

export function criarDadosConferencia(destino, lista) {
  return {
    destination: destino.trim(),
    checked_ids: lista
      .filter((item) => item.conferido && !item.sugestao)
      .map((item) => Number(item.id))
      .filter(Number.isFinite),
  };
}

export function lerChecklistPerfil(perfil, somenteEssenciais = false) {
  let itens;
  try {
    itens = typeof perfil.checklist_json === 'string'
      ? JSON.parse(perfil.checklist_json)
      : perfil.checklist_json || [];
  } catch {
    itens = [];
  }
  if (!Array.isArray(itens)) return [];
  return itens
    .filter((item) => !somenteEssenciais || objetoÉEssencial(item))
    .map((item, índice) => ({ ...item, id: item.id || 'perfil-' + índice, conferido: false, mostrarNaPlaca: item.mostrarNaPlaca === true }));
}

export function criarResumoSaida(destino, lista) {
  return {
    destination: destino.trim(),
    items: lista.filter((item) => item.mostrarNaPlaca === true).map((item) => item.name),
    updatedAt: Date.now(),
  };
}
