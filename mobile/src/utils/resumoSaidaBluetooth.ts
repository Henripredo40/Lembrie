import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAVE = '@lembre/resumo-saida-bluetooth';

export type ResumoSaidaBluetooth = { destination: string; items: string[]; updatedAt: number };

type ArmazenamentoResumo = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

export function criarRepositorioResumo(armazenamento: ArmazenamentoResumo = AsyncStorage) {
  return {
    async salvar(resumo: ResumoSaidaBluetooth) {
      await armazenamento.setItem(CHAVE, JSON.stringify(resumo));
    },
    async ler(): Promise<ResumoSaidaBluetooth | null> {
      const conteúdo = await armazenamento.getItem(CHAVE);
      if (!conteúdo) return null;
      try {
        const resumo = JSON.parse(conteúdo);
        if (typeof resumo.destination !== 'string' || !Array.isArray(resumo.items)) return null;
        return resumo;
      } catch {
        return null;
      }
    },
  };
}

const repositorio = criarRepositorioResumo();
export const salvarResumoSaidaBluetooth = repositorio.salvar;
export const lerResumoSaidaBluetooth = repositorio.ler;
