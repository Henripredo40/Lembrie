import { StyleSheet } from 'react-native';
import { cores } from '../tema';

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 18, paddingBottom: 28, gap: 11, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sobretitulo: { color: cores.primario, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  titulo: { color: cores.texto, fontSize: 26, fontWeight: '900', marginTop: -9 },
  subtitulo: { color: cores.textoSuave, fontSize: 13, lineHeight: 19, marginTop: -7 },
  perfil: { minHeight: 77, padding: 14, borderRadius: 18, backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.linha, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: cores.primarioClaro, alignItems: 'center', justifyContent: 'center' },
  letra: { color: cores.primario, fontSize: 20, fontWeight: '900' },
  dadosPerfil: { flex: 1 },
  nome: { color: cores.texto, fontSize: 14, fontWeight: '900' },
  email: { color: cores.textoSuave, fontSize: 13, marginTop: 4 },
  botaoPerfil: { minHeight: 44, paddingHorizontal: 11, borderRadius: 13, backgroundColor: cores.primarioClaro, flexDirection: 'row', alignItems: 'center', gap: 8 },
  textoBotaoPerfil: { flex: 1, color: cores.primario, fontSize: 13, fontWeight: '800' },
  linhaPreferencia: { minHeight: 78, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 17, backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.linha, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconePreferencia: { width: 36, height: 36, borderRadius: 12, backgroundColor: cores.primarioClaro, alignItems: 'center', justifyContent: 'center' },
  textosPreferencia: { flex: 1 },
  tituloPreferencia: { color: cores.texto, fontSize: 13, fontWeight: '800' },
  textoPreferencia: { color: cores.textoSuave, fontSize: 13, lineHeight: 19, marginTop: 4 },
  botaoSair: { minHeight: 53, paddingHorizontal: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: cores.vermelhoClaro },
  textoSair: { color: cores.vermelho, fontSize: 13, fontWeight: '800' },
  rodape: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingTop: 7 },
  textoRodape: { color: cores.textoSuave, fontSize: 13 },
  espacador: { height: 24 },
});

export default estilos;
