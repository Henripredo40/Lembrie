import { StyleSheet } from 'react-native';
import { cores } from '../tema';

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 20, paddingBottom: 32, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sobretitulo: { color: cores.primario, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  titulo: { color: cores.texto, fontSize: 26, fontWeight: '900', marginTop: -8 },
  subtitulo: { color: cores.textoSuave, fontSize: 13, lineHeight: 19, marginTop: -6 },
  cartaoUltimoLogin: { minHeight: 92, padding: 17, borderRadius: 20, backgroundColor: '#EAF5F1', borderWidth: 1, borderColor: '#C7E3DA', flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconeUltimoLogin: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#D7ECE5', alignItems: 'center', justifyContent: 'center' },
  textoUltimoLogin: { flex: 1, gap: 5 },
  rotulo: { color: cores.primario, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  data: { color: cores.texto, fontSize: 15, lineHeight: 21, fontWeight: '900' },
  estado: { padding: 16, borderRadius: 16, backgroundColor: cores.branco, flexDirection: 'row', alignItems: 'center', gap: 10 },
  textoEstado: { color: cores.textoSuave, fontSize: 13 },
  avisoErro: { minHeight: 48, padding: 13, borderRadius: 15, backgroundColor: '#FFF3E8', flexDirection: 'row', alignItems: 'center', gap: 9 },
  textoErro: { flex: 1, color: cores.laranja, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  cartaoDetalhes: { padding: 17, borderRadius: 20, backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.linha, gap: 14 },
  tituloSecao: { color: cores.texto, fontSize: 15, fontWeight: '900', marginBottom: 2 },
  linhaAcesso: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconeLinha: { width: 36, height: 36, borderRadius: 12, backgroundColor: cores.primarioClaro, alignItems: 'center', justifyContent: 'center' },
  textoLinha: { flex: 1, gap: 2 },
  rotuloLinha: { color: cores.textoSuave, fontSize: 12 },
  valorLinha: { color: cores.texto, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  cartaoVazio: { padding: 21, borderRadius: 20, backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.linha, alignItems: 'center', gap: 8 },
  tituloVazio: { color: cores.texto, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  textoVazio: { color: cores.textoSuave, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  notaPrivacidade: { padding: 14, borderRadius: 16, backgroundColor: '#F0F8F5', flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  textoPrivacidade: { flex: 1, color: cores.textoSuave, fontSize: 12, lineHeight: 18 },
  espacador: { height: 16 },
});

export default estilos;
