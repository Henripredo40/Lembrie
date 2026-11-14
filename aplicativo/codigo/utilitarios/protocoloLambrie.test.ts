import { describe, expect, test } from '@jest/globals';
import { criarPacotesComandoLambrie, criarPacotesResumoLambrie } from './protocoloLambrie';

function decodificar(pacotes: string[]) {
  const bytes = pacotes.map(pacote => Buffer.from(pacote, 'base64'));
  return Buffer.concat(bytes).toString('utf8');
}

describe('protocolo do chaveiro Lembriê', () => {
  test('codifica comando e divide mensagens em pacotes base64', () => {
    const pacotes = criarPacotesComandoLambrie('locate', 8);
    expect(pacotes.length).toBeGreaterThan(1);
    expect(pacotes.every(pacote => pacote.length % 4 === 0)).toBe(true);
    expect(decodificar(pacotes)).toBe('{"command":"locate"}\n');
  });

  test('inclui destino e itens com acentos e usa texto padrão quando vazio', () => {
    expect(decodificar(criarPacotesResumoLambrie({ destination: 'Café', items: ['Chaves', 'Óculos'], updatedAt: 1 })))
      .toBe('{"destination":"Café","items":"Chaves, Óculos"}\n');
    expect(decodificar(criarPacotesResumoLambrie({ destination: '', items: [], updatedAt: 1 })))
      .toBe('{"destination":"Saida","items":"Todos os essenciais conferidos"}\n');
  });
});
