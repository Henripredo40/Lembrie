import { StyleSheet } from 'react-native';
import { cores, raios } from '../tema';

const estilos = StyleSheet.create({
  cartao: { minHeight: 96, padding: 14, borderRadius: raios.cartao, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.linha, flexDirection: 'row', alignItems: 'center', gap: 13 },
  cartaoCompacto: { minHeight: 82, padding: 12, borderRadius: 18 },
  conteudo: { flex: 1, minWidth: 0 },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nome: { flexShrink: 1, color: cores.texto, fontSize: 15, fontWeight: '800' },
  categoria: { color: cores.textoSuave, fontSize: 13, marginTop: 3 },
  selo: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, backgroundColor: cores.primarioClaro },
  textoSelo: { color: cores.primario, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  linhaEstado: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  pontoDetectado: { backgroundColor: cores.verde },
  pontoAguardando: { backgroundColor: '#E59A37' },
  pontoNeutro: { backgroundColor: '#98A2B3' },
  estado: { flexShrink: 1, fontSize: 13, fontWeight: '700' },
  estadoDetectado: { color: cores.verde },
  estadoAguardando: { color: cores.laranja },
  estadoNeutro: { color: cores.textoSuave },
  acoes: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  acao: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F7F8FA' },
});

export default estilos;
