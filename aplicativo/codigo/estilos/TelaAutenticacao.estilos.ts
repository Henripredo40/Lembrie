import { StyleSheet } from 'react-native';
import { cores, raios } from '../tema';

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, flexShrink: 1, minWidth: 0, width: '100%', maxWidth: 524, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingTop: 32, paddingBottom: 35 },
  marca: { width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', marginBottom: 23 },
  iconeMarca: { width: 74, height: 74, borderRadius: 25, backgroundColor: cores.primario, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  nomeMarca: { color: cores.primario, fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  titulo: { marginTop: 13, color: cores.texto, fontSize: 27, fontWeight: '900', textAlign: 'center', lineHeight: 33 },
  subtitulo: { marginTop: 8, maxWidth: 340, color: cores.textoSuave, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  cartao: { flexShrink: 1, minWidth: 0, width: '100%', maxWidth: 480, alignSelf: 'center', padding: 20, borderRadius: raios.cartao, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.linha },
  tituloForm: { color: cores.texto, fontSize: 19, fontWeight: '900', marginBottom: 5 },
  textoAjuda: { color: cores.textoSuave, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  abas: { flexDirection: 'row', padding: 4, backgroundColor: cores.fundo, borderRadius: 15, marginBottom: 22 },
  aba: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  abaAtiva: { backgroundColor: cores.branco, overflow: 'hidden' },
  textoAba: { color: cores.textoSuave, fontSize: 14, fontWeight: '700' },
  textoAbaAtiva: { color: cores.primario, fontWeight: '900' },
  botaoSenha: { minHeight: 44, marginTop: -10, marginBottom: 8, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6 },
  textoBotaoSenha: { color: cores.primario, fontSize: 13, fontWeight: '700' },
  esqueceu: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', marginTop: -5 },
  linkSecundario: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  textoLink: { color: cores.primario, fontSize: 13, fontWeight: '800' },
  caixaErro: { padding: 12, borderRadius: 12, backgroundColor: cores.vermelhoClaro, marginBottom: 14 },
  textoErro: { color: cores.vermelho, fontSize: 13, lineHeight: 19 },
  caixaAviso: { padding: 11, borderRadius: 12, backgroundColor: cores.verdeClaro, marginBottom: 12 },
  textoAviso: { color: cores.verde, fontSize: 13, lineHeight: 18 },
  rodape: { marginTop: 16, color: cores.textoSuave, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});

export default estilos;
