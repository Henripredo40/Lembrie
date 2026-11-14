import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { aplicarAlteracoesPendentes, rotasComCacheLocal as caminhosEmCache, podeEntrarNaFila, podeSalvarPerfilSemConexao, type AlteracaoPendente } from './regrasFilaSemConexao';

type Armazenamento = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
export class FilaSemConexao {
  private escopo: string | null = null;

  constructor(
    private armazenamento: Armazenamento = AsyncStorage,
    private buscar: typeof fetch = fetch,
  ) {}

  async carregarEscopo() {
    this.escopo = await this.armazenamento.getItem('lembre:escopo-offline');
    return this.escopo;
  }

  async definirEscopo(identificador: string) {
    this.escopo = identificador;
    await this.armazenamento.setItem('lembre:escopo-offline', identificador);
  }

  private chave(tipo: 'cache' | 'fila', valor: string) {
    return this.escopo ? `lembre:${tipo}:${this.escopo}:${valor}` : null;
  }

  async resolverCaminho(path: string) {
    const chave = this.chave('cache', 'ids-locais');
    if (!chave) return path;
    try {
      const ids = JSON.parse(await this.armazenamento.getItem(chave) || '{}');
      return Object.entries(ids).reduce((resultado, [local, remoto]) => resultado.replace(local, String(remoto)), path);
    } catch { return path; }
  }

  private async lerFila(): Promise<AlteracaoPendente[]> {
    const chave = this.chave('fila', 'api');
    if (!chave) return [];
    try { return JSON.parse(await this.armazenamento.getItem(chave) || '[]'); } catch { return []; }
  }

  async quantidadePendente() { return (await this.lerFila()).length; }

  async podeEntrarNaFila(method: string, path: string, body: any) {
    if (!podeEntrarNaFila(method, path)) return false;
    if (method !== 'PATCH' || path !== '/me') return true;
    const perfil = await this.armazenamento.getItem(this.chave('cache', '/me')!);
    if (!perfil) return false;
    try {
      return podeSalvarPerfilSemConexao(body, JSON.parse(perfil));
    } catch { return false; }
  }

  async lerCache(path: string) {
    if (!this.escopo || !caminhosEmCache.has(path)) return undefined;
    try {
      const valor = await this.armazenamento.getItem(this.chave('cache', path)!);
      return valor == null ? undefined : aplicarAlteracoesPendentes(path, JSON.parse(valor), await this.lerFila());
    } catch { return undefined; }
  }

  async guardarCache(path: string, dados: any) {
    const chave = this.chave('cache', path);
    if (chave && caminhosEmCache.has(path)) await this.armazenamento.setItem(chave, JSON.stringify(dados)).catch(() => {});
    return aplicarAlteracoesPendentes(path, dados, await this.lerFila());
  }

  async guardarAlteracaoConfirmada(method: string, path: string, body: any, resposta: any) {
    const rota = path.split('?')[0];
    const coleções: Record<string, string> = {
      '/objects': '/objects', '/events': '/events', '/settings': '/settings', '/me': '/me',
      '/exit-profiles': '/exit-profiles', '/routine/plans': '/routine/plans',
    };
    const coleção = rota.startsWith('/objects/') ? '/objects' : coleções[rota];
    const chave = coleção && this.chave('cache', coleção);
    if (!chave) return;
    const salvo = await this.armazenamento.getItem(chave);
    if (salvo == null) return;
    const operação: AlteracaoPendente = {
      id: Crypto.randomUUID(), localId: resposta?.id == null ? `local:${Crypto.randomUUID()}` : String(resposta.id),
      method, path, body, createdAt: new Date().toISOString(),
    };
    try {
      const atualizado = aplicarAlteracoesPendentes(coleção, JSON.parse(salvo), [operação]);
      await this.armazenamento.setItem(chave, JSON.stringify(atualizado));
    } catch {}
  }

  async enfileirar(method: string, path: string, body: any) {
    if (!this.escopo || !await this.podeEntrarNaFila(method, path, body)) throw new Error('Esta ação precisa de conexão com o servidor.');
    const id = Crypto.randomUUID();
    const localId = method === 'POST' ? `local:${Crypto.randomUUID()}` : undefined;
    const operacao = { id, localId, method, path, body, createdAt: new Date().toISOString() };
    const fila = await this.lerFila();
    fila.push(operacao);
    await this.gravarFila(fila);
    const resposta = this.respostaOffline(operacao);
    if (path === '/me' && method === 'PATCH') {
      const perfil = await this.armazenamento.getItem(this.chave('cache', '/me')!);
      if (perfil) resposta.user = { ...JSON.parse(perfil), ...body };
    }
    return { operacao, resposta, quantidade: fila.length };
  }

  private async gravarFila(fila: AlteracaoPendente[]) {
    const chave = this.chave('fila', 'api');
    if (chave) await this.armazenamento.setItem(chave, JSON.stringify(fila));
  }

  private respostaOffline(operacao: AlteracaoPendente) {
    if (operacao.path === '/objects' && operacao.method === 'POST') {
      const corpo = operacao.body || {};
      return { id: operacao.localId, name: corpo.name, category: corpo.category || 'Outros', important: Boolean(corpo.important ?? corpo.essential), essential: Boolean(corpo.important ?? corpo.essential), image_data: corpo.image_data || null, connected: false, ble_uuid: null };
    }
    if (operacao.path === '/me' && operacao.method === 'PATCH') {
      return { ok: true, email_verified: false, user: { ...operacao.body } };
    }
    return { ok: true, id: operacao.localId, pendente: true };
  }

  async sincronizar(token: string, enderecoApi: string) {
    let fila = await this.lerFila();
    let sincronizadas = 0;
    for (const operacao of [...fila]) {
      try {
        const resposta = await this.buscar(enderecoApi + operacao.path, {
          method: operacao.method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Offline-Operation-Id': operacao.id },
          body: JSON.stringify(operacao.body),
        });
        if (!resposta.ok) return { sincronizadas, pendentes: fila.length, erro: `O servidor recusou uma alteração pendente (HTTP ${resposta.status}).` };
        const texto = await resposta.text();
        const dados = texto ? JSON.parse(texto) : {};
        if (operacao.localId && dados.id != null) {
          const localId = operacao.localId;
          if (operacao.path === '/objects') {
            const chaveIds = this.chave('cache', 'ids-locais')!;
            const ids = JSON.parse(await this.armazenamento.getItem(chaveIds) || '{}');
            ids[localId] = dados.id;
            await this.armazenamento.setItem(chaveIds, JSON.stringify(ids));
          }
          fila = fila.map(item => ({ ...item, path: item.path.replace(localId, String(dados.id)), localId: item.id === operacao.id ? String(dados.id) : item.localId }));
          await this.gravarFila(fila);
        }
        await this.guardarAlteracaoConfirmada(operacao.method, operacao.path, operacao.body, dados);
        fila = fila.filter(item => item.id !== operacao.id);
        await this.gravarFila(fila);
        sincronizadas += 1;
      } catch {
        return { sincronizadas, pendentes: fila.length, erro: 'A conexão caiu durante a sincronização.' };
      }
    }
    return { sincronizadas, pendentes: fila.length, erro: '' };
  }
}
