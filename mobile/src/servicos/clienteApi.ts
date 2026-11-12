import type { FilaOffline } from '../utils/filaOffline';

type DependenciasApi = {
  endereco: string;
  token?: string | null;
  filaOffline: FilaOffline;
  aoAtualizarPendentes?: (quantidade: number) => void;
  buscar?: typeof fetch;
};

export function criarClienteApi({ endereco, token, filaOffline, aoAtualizarPendentes, buscar = fetch }: DependenciasApi) {
  return async function chamarApi(caminho: string, opções: RequestInit = {}): Promise<any> {
    const método = String(opções.method || 'GET').toUpperCase();
    const corpo = typeof opções.body === 'string' ? (() => { try { return JSON.parse(opções.body); } catch { return {}; } })() : {};
    const caminhoResolvido = await filaOffline.resolverCaminho(caminho);
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
        const salvo = await filaOffline.lerCache(caminho).catch(() => undefined);
        if (salvo !== undefined) return salvo;
      } else if (await filaOffline.podeEnfileirar(método, caminho, corpo)) {
        const enfileirada = await filaOffline.enfileirar(método, caminho, corpo);
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
        const salvo = await filaOffline.lerCache(caminho).catch(() => undefined);
        if (salvo !== undefined) return salvo;
      }
      if (resposta.status >= 500 && método !== 'GET' && await filaOffline.podeEnfileirar(método, caminho, corpo)) {
        const enfileirada = await filaOffline.enfileirar(método, caminho, corpo);
        aoAtualizarPendentes?.(enfileirada.quantidade);
        return enfileirada.resposta;
      }
      throw Object.assign(new Error(dados.message || dados.error || 'Não foi possível concluir. Tente novamente.'), { status: resposta.status });
    }
    if (método === 'GET') {
      if (caminho === '/me' && dados?.id != null) await filaOffline.definirEscopo(String(dados.id));
      return filaOffline.guardarCache(caminho, dados);
    }
    await filaOffline.guardarAlteracaoConfirmada(método, caminho, corpo, dados);
    return dados;
  };
}
