import { StyleSheet } from 'react-native';
import { cores } from '../tema';

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 18, paddingBottom: 28, gap: 11, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sobretitulo: { color: cores.primario, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  titulo: { color: cores.texto, fontSize: 26, fontWeight: '900', marginTop: -9 },
  subtitulo: { color: cores.textoSuave, fontSize: 13, lineHeight: 19, marginTop: -7 },
  lista: { paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.branco },
  evento: { minHeight: 75, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#F0F1F5' },
  icone: { width: 38, height: 38, borderRadius: 13, backgroundColor: cores.primarioClaro, alignItems: 'center', justifyContent: 'center' },
  detalhe: { flex: 1 },
  mensagem: { color: cores.texto, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  data: { color: cores.textoSuave, fontSize: 13, marginTop: 4 },
  espacador: { height: 24 },
});

export default estilos;
