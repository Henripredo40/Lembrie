import type { FilaSemConexao } from '../utilitarios/filaSemConexao';

type DependenciasApi = {
  endereco: string;
  token?: string | null;
  filaSemConexao: FilaSemConexao;
  aoAtualizarPendentes?: (quantidade: number) => void;
  buscar?: typeof fetch;
};

export function criarClienteApi({ endereco, token, filaSemConexao, aoAtualizarPendentes, buscar = fetch }: DependenciasApi) {
  return async function chamarApi(caminho: string, opções: RequestInit = {}): Promise<any> {
    const método = String(opções.method || 'GET').toUpperCase();
    const corpo = typeof opções.body === 'string' ? (() => { try { return JSON.parse(opções.body); } catch { return {}; } })() : {};
    const caminhoResolvido = await filaSemConexao.resolverCaminho(caminho);
    let resposta: Response;
    try {
      resposta = await buscar(endereco + caminhoResolvido, {
        ...opções,
        headers: {
          ...(opções.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(opções.headers || {}),
        },
      });
    } catch {
      if (método === 'GET') {
        const salvo = await filaSemConexao.lerCache(caminho).catch(() => undefined);
        if (salvo !== undefined) return salvo;
      } else if (await filaSemConexao.podeEntrarNaFila(método, caminho, corpo)) {
        const enfileirada = await filaSemConexao.enfileirar(método, caminho, corpo);
        aoAtualizarPendentes?.(enfileirada.quantidade);
        return enfileirada.resposta;
      }
      throw new Error('Não consegui acessar o servidor. Verifique a internet e tente novamente.');
    }

    const texto = await resposta.text();
    let dados: any = {};
    try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { message: texto }; }
    if (!resposta.ok) {
      if (método === 'GET' && resposta.status >= 500) {
        const salvo = await filaSemConexao.lerCache(caminho).catch(() => undefined);
        if (salvo !== undefined) return salvo;
      }
      if (resposta.status >= 500 && método !== 'GET' && await filaSemConexao.podeEntrarNaFila(método, caminho, corpo)) {
        const enfileirada = await filaSemConexao.enfileirar(método, caminho, corpo);
        aoAtualizarPendentes?.(enfileirada.quantidade);
        return enfileirada.resposta;
      }
      throw Object.assign(new Error(dados.message || dados.error || 'Não foi possível concluir. Tente novamente.'), { status: resposta.status });
    }
    if (método === 'GET') {
      if (caminho === '/me' && dados?.id != null) await filaSemConexao.definirEscopo(String(dados.id));
      return filaSemConexao.guardarCache(caminho, dados);
    }
    await filaSemConexao.guardarAlteracaoConfirmada(método, caminho, corpo, dados);
    return dados;
  };
}
