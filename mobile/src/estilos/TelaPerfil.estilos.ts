import { StyleSheet } from 'react-native';
import { cores } from '../tema';

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 18, paddingBottom: 28, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sobretitulo: { color: cores.primario, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  titulo: { color: cores.texto, fontSize: 26, fontWeight: '900', marginTop: -9 },
  subtitulo: { color: cores.textoSuave, fontSize: 13, lineHeight: 19, marginTop: -7 },
  textoCarregando: { color: cores.textoSuave, fontSize: 13, textAlign: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.primarioClaro, alignSelf: 'center', marginVertical: 4 },
  letra: { color: cores.primario, fontSize: 25, fontWeight: '900' },
  cartao: { padding: 16, borderRadius: 19, backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.linha },
  cartaoSeguranca: { padding: 16, borderRadius: 19, backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.linha, gap: 12 },
  cabecalhoSeguranca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconeSeguranca: { width: 39, height: 39, borderRadius: 13, backgroundColor: cores.primarioClaro, alignItems: 'center', justifyContent: 'center' },
  textoSeguranca: { flex: 1 },
  tituloSeguranca: { color: cores.texto, fontSize: 14, fontWeight: '900' },
  subtituloSeguranca: { color: cores.textoSuave, fontSize: 12, lineHeight: 18 },
  linhaSeguranca: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 2 },
  rotuloSeguranca: { flex: 1, color: cores.textoSuave, fontSize: 13 },
  valorSeguranca: { flex: 1, color: cores.texto, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  notaSeguranca: { color: cores.textoSuave, fontSize: 11, lineHeight: 16, borderTopWidth: 1, borderTopColor: cores.linha, paddingTop: 10 },
  cartaoSenha: { padding: 16, borderRadius: 19, backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.linha, gap: 4 },
  cabecalhoSenha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  iconeSenha: { width: 39, height: 39, borderRadius: 13, backgroundColor: cores.primarioClaro, alignItems: 'center', justifyContent: 'center' },
  textoSenha: { flex: 1 },
  tituloSenha: { color: cores.texto, fontSize: 14, fontWeight: '900' },
  subtituloSenha: { color: cores.textoSuave, fontSize: 13, marginTop: 3 },
  alternarSenha: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4, marginTop: -8, marginBottom: 2 },
  textoAlternarSenha: { color: cores.primario, fontSize: 13, fontWeight: '700' },
  linkRecuperacao: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  textoRecuperacao: { color: cores.primario, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  ajudaRecuperacao: { color: cores.textoSuave, fontSize: 13, lineHeight: 18, marginTop: -7, marginBottom: 7 },
  ajudaVerificacaoEmail: { color: cores.textoSuave, fontSize: 13, lineHeight: 18, marginTop: -8, marginBottom: 5 },
  espacador: { height: 18 },
});

export default estilos;
