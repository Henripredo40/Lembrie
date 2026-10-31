import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type NomeIcone = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const categoriasDeObjeto: Array<{ nome: string; ícone: NomeIcone }> = [
  { nome: 'Chaves', ícone: 'key-chain-variant' },
  { nome: 'Mochila', ícone: 'bag-personal' },
  { nome: 'Bolsa', ícone: 'bag-personal' },
  { nome: 'Carteira', ícone: 'wallet' },
  { nome: 'Celular', ícone: 'cellphone' },
  { nome: 'Fone de ouvido', ícone: 'headphones' },
  { nome: 'Notebook', ícone: 'laptop' },
  { nome: 'Garrafa', ícone: 'bottle-soda' },
  { nome: 'Caderno', ícone: 'notebook' },
  { nome: 'Documento', ícone: 'card-account-details' },
  { nome: 'Guarda-chuva', ícone: 'umbrella' },
  { nome: 'Relógio', ícone: 'watch' },
  { nome: 'Remédio', ícone: 'pill' },
  { nome: 'Óculos', ícone: 'glasses' },
  { nome: 'Outros', ícone: 'package-variant' },
];

const desenhos = [
  { termos: ['chave', 'chaves', 'key'], ícone: 'key-chain-variant', fundo: '#E7F4F1', cor: '#16796D' },
  { termos: ['mochila', 'backpack'], ícone: 'bag-personal', fundo: '#EAF5FF', cor: '#2872B8' },
  { termos: ['bolsa', 'sacola'], ícone: 'bag-personal', fundo: '#FFF0F5', cor: '#B84776' },
  { termos: ['carteira', 'wallet'], ícone: 'wallet', fundo: '#FFF3E3', cor: '#A85B11' },
  { termos: ['celular', 'telefone', 'phone'], ícone: 'cellphone', fundo: '#EAF2FF', cor: '#3767C8' },
  { termos: ['fone', 'headphone', 'audio'], ícone: 'headphones', fundo: '#F2EDFF', cor: '#7353BD' },
  { termos: ['notebook', 'laptop', 'computador'], ícone: 'laptop', fundo: '#E9F7F4', cor: '#188071' },
  { termos: ['garrafa', 'agua', 'água'], ícone: 'bottle-soda', fundo: '#E7F7F9', cor: '#15828B' },
  { termos: ['caderno', 'livro', 'apostila'], ícone: 'notebook', fundo: '#FFF0E9', cor: '#B75E35' },
  { termos: ['documento', 'identidade', 'rg', 'cnh', 'passaporte', 'cracha', 'crachá'], ícone: 'card-account-details', fundo: '#EAF4FF', cor: '#2F6DAB' },
  { termos: ['guarda-chuva', 'guarda chuva', 'umbrella'], ícone: 'umbrella', fundo: '#EEF0FF', cor: '#555FC2' },
  { termos: ['relogio', 'relógio', 'watch'], ícone: 'watch', fundo: '#F0F1F5', cor: '#4E5564' },
  { termos: ['remedio', 'remédio', 'medicamento'], ícone: 'pill', fundo: '#FFF0F1', cor: '#C1465A' },
  { termos: ['oculos', 'óculos', 'lente'], ícone: 'glasses', fundo: '#EFF2F6', cor: '#49566B' },
  { termos: ['carregador', 'cabo', 'usb'], ícone: 'power-plug', fundo: '#FFF4E6', cor: '#B36815' },
  { termos: ['camera', 'câmera', 'foto'], ícone: 'camera', fundo: '#F1EDFF', cor: '#684FB5' },
];

export function normalizarTexto(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function obterDesenhoDoObjeto(nome = '', categoria = '') {
  const nomeNormalizado = normalizarTexto(nome);
  const categoriaNormalizada = normalizarTexto(categoria);
  const procurar = (texto) => desenhos.find((desenho) =>
    desenho.termos.some((termo) => texto.includes(normalizarTexto(termo)))
  );
  const encontrado = procurar(nomeNormalizado) || procurar(categoriaNormalizada);

  return encontrado || {
    ícone: 'package-variant',
    fundo: '#F0F2F6',
    cor: '#586174',
  };
}

export function objetoÉEssencial(objeto) {
  return objeto?.essential === true || objeto?.important === true || Number(objeto?.essential ?? objeto?.important) === 1;
}

export function objetoTemChaveiro(objeto) {
  return Boolean(objeto?.ble_uuid || objeto?.device_id);
}

export function chaveiroEstáConectado(objeto) {
  return objeto?.connected === true || Number(objeto?.connected) === 1;
}
