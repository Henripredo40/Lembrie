import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { aplicarOperacoesPendentes, podeEnfileirar, podeSalvarPerfilOffline, type OperacaoOffline } from './filaOfflineLogica';

describe('fila offline', () => {
  it('aceita alterações de dados e recusa autenticação e ações sensíveis', () => {
    assert.equal(podeEnfileirar('POST', '/objects'), true);
    assert.equal(podeEnfileirar('PATCH', '/settings'), true);
    assert.equal(podeEnfileirar('POST', '/auth/login'), false);
    assert.equal(podeEnfileirar('POST', '/routine/location'), false);
    assert.equal(podeSalvarPerfilOffline({ name: 'Nome novo', email: 'ana@example.com' }, { email: 'ana@example.com' }), true);
    assert.equal(podeSalvarPerfilOffline({ name: 'Nome', email: 'novo@example.com' }, { email: 'ana@example.com' }), false);
  });

  it('aplica criação, edição e remoção pendentes à lista local', () => {
    const fila: OperacaoOffline[] = [
      { id: 'a', localId: 'local:item', method: 'POST', path: '/objects', body: { name: 'Chaves', essential: true }, createdAt: '2026-11-09T12:00:00Z' },
      { id: 'b', method: 'PATCH', path: '/objects/local:item', body: { name: 'Chaves de casa' }, createdAt: '2026-11-09T12:01:00Z' },
      { id: 'c', method: 'POST', path: '/events', body: { type: 'lista_saida', message: 'Lista montada' }, createdAt: '2026-11-09T12:02:00Z' },
    ];
    const objetos = aplicarOperacoesPendentes('/objects', [], fila);
    assert.equal(objetos.length, 1);
    assert.equal(objetos[0].name, 'Chaves de casa');
    assert.equal(objetos[0].essential, true);
    const eventos = aplicarOperacoesPendentes('/events', [], fila);
    assert.equal(eventos[0].message, 'Lista montada');
  });
});
