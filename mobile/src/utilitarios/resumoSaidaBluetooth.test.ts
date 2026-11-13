import { describe, expect, jest, test } from '@jest/globals';
import { criarRepositorioResumo } from './resumoSaidaBluetooth';

describe('armazenamento do resumo de saída Bluetooth', () => {
  test('salva e recupera resumo válido', async () => {
    let valor: string | null = null;
    const storage = {
      getItem: jest.fn(async () => valor),
      setItem: jest.fn(async (_chave: string, novoValor: string) => { valor = novoValor; }),
    };
    const repo = criarRepositorioResumo(storage as any);
    const resumo = { destination: 'Trabalho', items: ['Chaves'], updatedAt: 123 };
    await repo.salvar(resumo);
    await expect(repo.ler()).resolves.toEqual(resumo);
  });

  test('retorna vazio para dados ausentes, mal formados ou incompatíveis', async () => {
    let valor: string | null = null;
    const storage = { getItem: async () => valor, setItem: async () => {} };
    const repo = criarRepositorioResumo(storage as any);
    await expect(repo.ler()).resolves.toBeNull();
    valor = '{';
    await expect(repo.ler()).resolves.toBeNull();
    valor = JSON.stringify({ destination: 1, items: 'x' });
    await expect(repo.ler()).resolves.toBeNull();
  });
});
