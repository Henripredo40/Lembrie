import { describe, expect, jest, test } from '@jest/globals';
import { FilaSemConexao } from './filaSemConexao';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-de-teste' }));

function criarArmazenamento() {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: jest.fn(async (chave: string) => dados.get(chave) ?? null),
    setItem: jest.fn(async (chave: string, valor: string) => { dados.set(chave, valor); }),
  };
}

describe('fila persistente sem conexão', () => {
  test('restaura escopo, guarda cache e substitui ids locais por ids do servidor', async () => {
    const armazenamento = criarArmazenamento();
    armazenamento.dados.set('lembre:escopo-offline', 'ana');
    const buscar = jest.fn(async () => ({ ok: true, status: 200, text: async () => '{"id":42}' } as Response));
    const fila = new FilaSemConexao(armazenamento as any, buscar as any);
    await expect(fila.carregarEscopo()).resolves.toBe('ana');
    await fila.guardarCache('/objects', []);
    const enfileirada = await fila.enfileirar('POST', '/objects', { name: 'Chaves', essential: true });
    expect(enfileirada.resposta).toMatchObject({ name: 'Chaves', essential: true, connected: false });
    await expect(fila.quantidadePendente()).resolves.toBe(1);

    await expect(fila.sincronizar('token', 'https://api.test')).resolves.toMatchObject({ sincronizadas: 1, pendentes: 0, erro: '' });
    expect(buscar).toHaveBeenCalledWith('https://api.test/objects', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer token', 'X-Offline-Operation-Id': expect.any(String) }),
    }));
    expect(await fila.resolverCaminho('/objects/local:missing')).toBe('/objects/local:missing');
    expect(await fila.lerCache('/objects')).toEqual([]);
  });

  test('rejeita escrita sem escopo e não enfileira rotas sensíveis', async () => {
    const fila = new FilaSemConexao(criarArmazenamento() as any);
    await expect(fila.enfileirar('POST', '/objects', { name: 'Carteira' })).rejects.toThrow(/precisa de conexão/);
    await fila.definirEscopo('ana');
    await expect(fila.podeEntrarNaFila('POST', '/auth/login', {})).resolves.toBe(false);
    await expect(fila.podeEntrarNaFila('PATCH', '/me', { email: 'novo@exemplo.com' })).resolves.toBe(false);
  });

  test('permite salvar perfil offline sem trocar e-mail e atualiza resposta local', async () => {
    const armazenamento = criarArmazenamento();
    const fila = new FilaSemConexao(armazenamento as any);
    await fila.definirEscopo('ana');
    armazenamento.dados.set('lembre:cache:ana:/me', JSON.stringify({ name: 'Ana', email: 'ana@exemplo.com' }));
    await expect(fila.podeEntrarNaFila('PATCH', '/me', { name: 'Ana Silva', email: 'ANA@EXEMPLO.COM' })).resolves.toBe(true);
    await expect(fila.podeEntrarNaFila('PATCH', '/me', { email: 'nova@exemplo.com' })).resolves.toBe(false);
    const resultado = await fila.enfileirar('PATCH', '/me', { name: 'Ana Silva', email: 'ana@exemplo.com' });
    expect(resultado.resposta.user).toMatchObject({ name: 'Ana Silva', email: 'ana@exemplo.com' });
  });

  test('mantém itens pendentes se servidor rejeitar e informa queda de rede', async () => {
    const armazenamento = criarArmazenamento();
    const buscar = jest.fn(async () => ({ ok: false, status: 409, text: async () => '' } as Response));
    const fila = new FilaSemConexao(armazenamento as any, buscar as any);
    await fila.definirEscopo('ana');
    await fila.enfileirar('POST', '/events', { type: 'locate' });
    await expect(fila.sincronizar('token', 'https://api.test')).resolves.toMatchObject({ sincronizadas: 0, pendentes: 1, erro: expect.stringContaining('HTTP 409') });

    buscar.mockRejectedValueOnce(new Error('offline'));
    await expect(fila.sincronizar('token', 'https://api.test')).resolves.toMatchObject({ sincronizadas: 0, pendentes: 1, erro: expect.stringContaining('conexão caiu') });
  });
});
