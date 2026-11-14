import { StyleSheet } from 'react-native';
import { cores } from '../tema';

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 18, paddingBottom: 16, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sobretitulo: { color: cores.primario, fontSize: 13, fontWeight: '900', letterSpacing: 1.1 },
  titulo: { color: cores.texto, fontSize: 25, fontWeight: '900' },
  subtitulo: { color: cores.textoSuave, fontSize: 13, lineHeight: 18, marginTop: -6 },
  perguntas: { gap: 7, marginVertical: 3 },
  pergunta: { minHeight: 44, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.branco, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  textoPergunta: { flex: 1, color: cores.texto, fontSize: 13, fontWeight: '700' },
  conversa: { gap: 10, paddingTop: 6 },
  bolha: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17 },
  bolhaAssistente: { alignSelf: 'flex-start', backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.linha, borderBottomLeftRadius: 5 },
  bolhaPessoa: { alignSelf: 'flex-end', backgroundColor: cores.primario, borderBottomRightRadius: 5 },
  textoBolha: { color: cores.texto, fontSize: 13, lineHeight: 19 },
  textoBolhaPessoa: { color: cores.branco },
  carregando: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  textoCarregando: { color: cores.textoSuave, fontSize: 13 },
  compositor: { maxWidth: 720, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 9, padding: 12, backgroundColor: cores.branco, borderTopWidth: 1, borderTopColor: cores.linha },
  campo: { flex: 1, minHeight: 45, maxHeight: 110, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 15, backgroundColor: cores.fundo, color: cores.texto, fontSize: 13, textAlignVertical: 'center' },
  enviar: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.primario },
  enviarDesativado: { opacity: 0.45 },
});

export default estilos;
