import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

const { suggestions, sugestõesPorPerto, registeredSuggestions } = require('./sugestoes');
const { formatarResultadoLugar, pontuarCorrespondenciaBusca } = require('./lugares');

describe('serviços de sugestões', () => {
  it('sugere itens escolares sem duplicatas', () => {
    const resultado = suggestions('Escola', []);
    assert.ok(resultado.includes('Mochila'));
    assert.equal(new Set(resultado).size, resultado.length);
  });

  it('inclui itens essenciais cadastrados primeiro', () => {
    const resultado = suggestions('praia', [{ name: 'Remédio', important: true }]);
    assert.equal(resultado[0], 'Remédio');
  });

  it('relaciona categorias próximas a itens úteis', () => {
    assert.ok(sugestõesPorPerto(['Educação']).includes('Caderno'));
  });

  it('filtra objetos cadastrados por importância e sugestão', () => {
    const resultado = registeredSuggestions('trabalho', [
      { id: 1, name: 'Notebook', category: 'Eletrônicos' },
      { id: 2, name: 'Passaporte', category: 'Documentos', important: true },
      { id: 3, name: 'Vaso', category: 'Casa' },
    ]);
    assert.deepEqual(resultado.map((item: { id: number }) => item.id), [1, 2]);
  });
});

describe('serviços de lugares', () => {
  it('formata endereço e identifica a UF brasileira', () => {
    const lugar = formatarResultadoLugar({
      place_id: 10,
      name: 'Escola',
      display_name: 'Escola, São Paulo, Brasil',
      lat: '-23.5',
      lon: '-46.6',
      address: { state: 'São Paulo', road: 'Rua Central', postcode: '01000-000' },
    });
    assert.equal(lugar.uf, 'SP');
    assert.equal(lugar.logradouro, 'Rua Central');
    assert.equal(lugar.latitude, -23.5);
  });

  it('pontua consultas por correspondência textual', () => {
    const resultado = pontuarCorrespondenciaBusca({
      name: 'Escola Municipal',
      display_name: 'Escola Municipal, Rua A, São Paulo, Brasil',
      address: { postcode: '01000-000' },
      importance: 0.8,
    }, 'Escola Municipal');
    assert.equal(resultado.exata, true);
    assert.equal(resultado.cobertura, 1);
  });
});
