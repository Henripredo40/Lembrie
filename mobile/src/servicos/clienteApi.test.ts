import { describe, expect, jest, test } from '@jest/globals';
import { criarClienteApi } from './clienteApi';

function filaDeTeste(overrides = {}) {
  return {
    resolverCaminho: jest.fn(async (path: string) => path),
    lerCache: jest.fn(async () => undefined as any),
    guardarCache: jest.fn(async (_path: string, data: unknown) => data),
    guardarAlteracaoConfirmada: jest.fn(async () => {}),
    podeEntrarNaFila: jest.fn(async () => false),
    enfileirar: jest.fn(async () => ({ quantidade: 1, resposta: { queued: true } })),
    definirEscopo: jest.fn(async () => {}),
    ...overrides,
  };
}

describe('cliente HTTP do app', () => {
  test('envia token e guarda a resposta GET no cache', async () => {
    const fila = filaDeTeste();
    const buscar = jest.fn(async (_url: string, _init: RequestInit) => ({ ok: true, status: 200, text: async () => '[{"id":2}]' } as Response));
    const api = criarClienteApi({ endereco: 'https://api.test', token: 'abc', filaSemConexao: fila as any, buscar: buscar as any });

    const resposta = await api('/objects');

    expect(resposta).toEqual([{ id: 2 }]);
    expect(buscar).toHaveBeenCalledWith('https://api.test/objects', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer abc' }) }));
    expect(fila.guardarCache).toHaveBeenCalledWith('/objects', [{ id: 2 }]);
  });

  test('usa o cache se a conexão de um GET cair', async () => {
    const fila = filaDeTeste({ lerCache: jest.fn(async () => [{ id: 9, name: 'Carteira' }]) });
    const buscar = jest.fn(async () => { throw new Error('offline'); });
    const api = criarClienteApi({ endereco: 'https://api.test', filaSemConexao: fila as any, buscar: buscar as any });

    await expect(api('/objects')).resolves.toEqual([{ id: 9, name: 'Carteira' }]);
    expect(fila.lerCache).toHaveBeenCalledWith('/objects');
  });

  test('enfileira uma alteração permitida quando a rede cai', async () => {
    const fila = filaDeTeste({ podeEntrarNaFila: jest.fn(async () => true) });
    const buscar = jest.fn(async () => { throw new Error('offline'); });
    const atualizarPendentes = jest.fn();
    const api = criarClienteApi({ endereco: 'https://api.test', filaSemConexao: fila as any, aoAtualizarPendentes: atualizarPendentes, buscar: buscar as any });

    await expect(api('/objects', { method: 'POST', body: JSON.stringify({ name: 'Chaves' }) })).resolves.toEqual({ queued: true });
    expect(fila.enfileirar).toHaveBeenCalledWith('POST', '/objects', { name: 'Chaves' });
    expect(atualizarPendentes).toHaveBeenCalledWith(1);
  });

  test('preserva código e mensagem de erro HTTP', async () => {
    const fila = filaDeTeste();
    const buscar = jest.fn(async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'Token inválido' }) } as Response));
    const api = criarClienteApi({ endereco: 'https://api.test', filaSemConexao: fila as any, buscar: buscar as any });

    await expect(api('/me')).rejects.toMatchObject({ status: 401, message: 'Token inválido' });
  });
});
