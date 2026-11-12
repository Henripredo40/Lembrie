export type OperacaoOffline = { id: string; localId?: string; method: string; path: string; body: any; createdAt: string };

export const caminhosComCacheOffline = new Set(['/objects', '/events', '/me', '/settings', '/exit-profiles', '/routine/plans']);

export function podeEnfileirar(method: string, path: string) {
  const rota = path.split('?')[0];
  return (method === 'POST' && ['/objects', '/events', '/exit-profiles', '/routine/plans'].includes(rota)) ||
    (method === 'PATCH' && (rota === '/settings' || rota === '/me' || /^\/objects\/[^/]+$/.test(rota))) ||
    (method === 'DELETE' && /^\/objects\/[^/]+$/.test(rota));
}

export function podeSalvarPerfilOffline(alteracao: any, perfil: any) {
  return Boolean(perfil?.email) &&
    String(perfil.email).toLowerCase() === String(alteracao?.email || '').toLowerCase() &&
    !alteracao?.email_verification_code;
}

export function aplicarOperacoesPendentes(path: string, dados: any, operacoes: OperacaoOffline[]) {
  const rota = path.split('?')[0];
  let resultado = Array.isArray(dados) ? [...dados] : dados && typeof dados === 'object' ? { ...dados } : dados;
  for (const operacao of operacoes) {
    const rotaOperacao = operacao.path.split('?')[0];
    const corpo = operacao.body || {};
    if (rota === '/objects' && Array.isArray(resultado)) {
      const id = rotaOperacao.split('/')[2] || operacao.localId;
      if (operacao.method === 'POST' && rotaOperacao === '/objects') {
        if (!resultado.some(item => String(item.id) === String(operacao.localId))) resultado.unshift({ id: operacao.localId, name: corpo.name, category: corpo.category || 'Outros', important: Boolean(corpo.important ?? corpo.essential), essential: Boolean(corpo.important ?? corpo.essential), image_data: corpo.image_data || null, connected: false, ble_uuid: null });
      } else if (operacao.method === 'DELETE') resultado = resultado.filter(item => String(item.id) !== String(id));
      else if (operacao.method === 'PATCH') resultado = resultado.map(item => String(item.id) === String(id) ? { ...item, ...corpo, important: corpo.important ?? corpo.essential ?? item.important, essential: corpo.essential ?? corpo.important ?? item.essential } : item);
    } else if (rota === '/events' && Array.isArray(resultado) && operacao.method === 'POST' && rotaOperacao === '/events') {
      if (!resultado.some(item => String(item.id) === String(operacao.localId))) resultado.unshift({ id: operacao.localId, ...corpo, created_at: operacao.createdAt });
    } else if (rota === '/settings' && resultado && typeof resultado === 'object' && operacao.method === 'PATCH') {
      resultado = { ...resultado, ...corpo };
    } else if (rota === '/me' && resultado && typeof resultado === 'object' && operacao.method === 'PATCH') {
      resultado = { ...resultado, ...corpo };
    } else if (rota === '/exit-profiles' && Array.isArray(resultado) && operacao.method === 'POST' && rotaOperacao === '/exit-profiles') {
      if (!resultado.some(item => String(item.id) === String(operacao.localId))) resultado.unshift({ id: operacao.localId, destination: corpo.destination, checklist_json: corpo.checklist, created_at: operacao.createdAt });
    } else if (rota === '/routine/plans' && Array.isArray(resultado) && operacao.method === 'POST' && rotaOperacao === '/routine/plans') {
      if (!resultado.some(item => String(item.id) === String(operacao.localId))) resultado.unshift({ id: operacao.localId, destination: corpo.destination, planned_at: operacao.createdAt });
    } else if (rota === '/routine/plans' && operacao.method === 'PATCH' && rotaOperacao === '/settings' && corpo.routine_enabled === false) {
      resultado = [];
    }
  }
  return resultado;
}
