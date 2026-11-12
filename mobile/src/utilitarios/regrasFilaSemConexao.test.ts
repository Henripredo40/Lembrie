import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { aplicarAlteracoesPendentes, podeEntrarNaFila, podeSalvarPerfilSemConexao, type AlteracaoPendente } from './regrasFilaSemConexao';

describe('fila offline', () => {
  it('aceita alterações de dados e recusa autenticação e ações sensíveis', () => {
    assert.equal(podeEntrarNaFila('POST', '/objects'), true);
    assert.equal(podeEntrarNaFila('PATCH', '/settings'), true);
    assert.equal(podeEntrarNaFila('POST', '/auth/login'), false);
    assert.equal(podeEntrarNaFila('POST', '/routine/location'), false);
    assert.equal(podeSalvarPerfilSemConexao({ name: 'Nome novo', email: 'ana@example.com' }, { email: 'ana@example.com' }), true);
    assert.equal(podeSalvarPerfilSemConexao({ name: 'Nome', email: 'novo@example.com' }, { email: 'ana@example.com' }), false);
  });

  it('aplica criação, edição e remoção pendentes à lista local', () => {
    const fila: AlteracaoPendente[] = [
      { id: 'a', localId: 'local:item', method: 'POST', path: '/objects', body: { name: 'Chaves', essential: true }, createdAt: '2026-11-09T12:00:00Z' },
      { id: 'b', method: 'PATCH', path: '/objects/local:item', body: { name: 'Chaves de casa' }, createdAt: '2026-11-09T12:01:00Z' },
      { id: 'c', method: 'POST', path: '/events', body: { type: 'lista_saida', message: 'Lista montada' }, createdAt: '2026-11-09T12:02:00Z' },
    ];
    const objetos = aplicarAlteracoesPendentes('/objects', [], fila);
    assert.equal(objetos.length, 1);
    assert.equal(objetos[0].name, 'Chaves de casa');
    assert.equal(objetos[0].essential, true);
    const eventos = aplicarAlteracoesPendentes('/events', [], fila);
    assert.equal(eventos[0].message, 'Lista montada');
  });
});
