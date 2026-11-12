import { describe, expect, test } from '@jest/globals';
import { emailValido, codigoEmailValido, senhaTemTamanhoMinimo, senhasIguais } from './validacaoConta';
import { criarListaSaida, alternarItemConferido, criarDadosConferencia } from './listaDeSaida';
import { filtrarObjetos, normalizarTexto, objetoÉEssencial, obterDesenhoDoObjeto } from './objetos';

describe('regras de conta', () => {
  test('valida formato de e-mail, código de seis dígitos e confirmação de senha', () => {
    expect(emailValido('ana@exemplo.com')).toBe(true);
    expect(emailValido('ana@')).toBe(false);
    expect(codigoEmailValido('123456')).toBe(true);
    expect(codigoEmailValido('12345a')).toBe(false);
    expect(senhaTemTamanhoMinimo('segura1')).toBe(true);
    expect(senhaTemTamanhoMinimo('12345')).toBe(false);
    expect(senhasIguais('abc123', 'abc123')).toBe(true);
    expect(senhasIguais('abc123', 'abc124')).toBe(false);
  });
});

describe('objetos e lista de saída', () => {
  test('normaliza acentos e filtra objetos por texto e categoria', () => {
    const objetos = [
      { id: 1, name: 'Chaves de casa', category: 'Chaves', essential: true },
      { id: 2, name: 'Óculos escuros', category: 'Acessórios' },
    ];
    expect(normalizarTexto('ÓCULOS')).toBe('oculos');
    expect(filtrarObjetos(objetos, { busca: 'oculos' })).toHaveLength(1);
    expect(filtrarObjetos(objetos, { categoria: 'Chaves' })).toEqual([objetos[0]]);
    expect(objetoÉEssencial(objetos[0])).toBe(true);
    expect(obterDesenhoDoObjeto('Chave reserva').ícone).toBe('key-chain-variant');
  });

  test('monta lista sem duplicar sugestões e preserva apenas itens essenciais quando solicitado', () => {
    const objetos = [
      { id: 1, name: 'Chaves', category: 'Chaves', essential: true },
      { id: 2, name: 'Caderno', category: 'Escola', essential: false },
    ];
    const completa = criarListaSaida(objetos, ['chaves', 'Garrafa']);
    expect(completa.itens.map((item) => item.name)).toEqual(['Chaves', 'Caderno', 'Garrafa']);
    const essenciais = criarListaSaida(objetos, ['Caderno', 'Remédio'], true);
    expect(essenciais.itens.map((item) => item.name)).toEqual(['Chaves', 'Remédio']);
  });

  test('alterna conferência e envia somente ids dos itens cadastrados', () => {
    const lista = [
      { id: 7, name: 'Chaves', conferido: false, sugestao: false },
      { id: 'sugestao-0', name: 'Garrafa', conferido: false, sugestao: true },
    ];
    const atualizada = alternarItemConferido(lista, 7);
    expect(atualizada[0].conferido).toBe(true);
    expect(criarDadosConferencia('  Trabalho ', atualizada)).toEqual({ destination: 'Trabalho', checked_ids: [7] });
  });
});
