import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAVE = '@lembre/resumo-saida-bluetooth';
const CHAVE_MONITORAMENTO = '@lembre/perimetro-monitoramento';

export type ResumoSaidaBluetooth = { destination: string; items: string[]; deviceItems?: string[]; updatedAt: number; alert?: boolean };

type ArmazenamentoResumo = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

export function criarRepositorioResumo(armazenamento: ArmazenamentoResumo = AsyncStorage) {
  async function ler() {
    const conteúdo = await armazenamento.getItem(CHAVE);
    if (!conteúdo) return null;
    try {
      const resumo = JSON.parse(conteúdo);
      if (typeof resumo.destination !== 'string' || !Array.isArray(resumo.items)) return null;
      return resumo as ResumoSaidaBluetooth;
    } catch {
      return null;
    }
  }
  return {
    async salvar(resumo: ResumoSaidaBluetooth) {
      await armazenamento.setItem(CHAVE, JSON.stringify(resumo));
    },
    ler,
    async removerItemPorIndice(indice: number) {
      const resumo = await ler();
      const itensNaPlaca = [...(resumo?.deviceItems || resumo?.items || [])];
      if (!resumo || !Number.isInteger(indice) || indice < 0 || indice >= itensNaPlaca.length) return false;
      const nome = itensNaPlaca.splice(indice, 1)[0];
      resumo.deviceItems = itensNaPlaca;
      const índiceDoItem = resumo.items.indexOf(nome);
      if (índiceDoItem >= 0) resumo.items.splice(índiceDoItem, 1);
      resumo.updatedAt = Date.now();
      await armazenamento.setItem(CHAVE, JSON.stringify(resumo));
      const estadoPerimetro = await armazenamento.getItem(CHAVE_MONITORAMENTO);
      if (estadoPerimetro) {
        try {
          const monitoramento = JSON.parse(estadoPerimetro);
          if (Array.isArray(monitoramento.items)) {
            const indicePerimetro = monitoramento.items.indexOf(nome);
            if (indicePerimetro >= 0) monitoramento.items.splice(indicePerimetro, 1);
            await armazenamento.setItem(CHAVE_MONITORAMENTO, JSON.stringify(monitoramento));
          }
        } catch {}
      }
      return true;
    },
    async registrarItensEnviados(items: string[]) {
      const resumo = await ler();
      if (!resumo) return;
      await armazenamento.setItem(CHAVE, JSON.stringify({ ...resumo, deviceItems: items, updatedAt: Date.now() }));
    },
  };
}

const repositorio = criarRepositorioResumo();
export const salvarResumoSaidaBluetooth = repositorio.salvar;
export const lerResumoSaidaBluetooth = repositorio.ler;
export const removerItemDoResumoBluetooth = repositorio.removerItemPorIndice;
export const registrarItensEnviadosParaPlaca = repositorio.registrarItensEnviados;
