import { StyleSheet } from 'react-native';
import { cores, raios } from '../tema';

const estilos = StyleSheet.create({
  botao: {
    minHeight: 52,
    borderRadius: raios.campo,
    paddingHorizontal: 18,
    backgroundColor: cores.primario,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  botaoSecundario: {
    backgroundColor: cores.primarioClaro,
    borderWidth: 1,
    borderColor: '#C8E2DB',
  },
  botaoDesativado: { opacity: 0.58 },
  botaoFocado: { borderWidth: 3, borderColor: '#91C9BD' },
  botaoPressionado: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  textoBotao: { color: cores.branco, fontSize: 15, fontWeight: '800' },
  textoBotaoSecundario: { color: cores.primario },
  grupoCampo: { marginBottom: 15 },
  rotulo: { color: cores.texto, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  campo: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raios.campo,
    paddingHorizontal: 14,
    color: cores.texto,
    backgroundColor: '#FBFCFE',
    fontSize: 15,
  },
  campoComErro: { borderColor: cores.vermelho },
  campoFocado: { borderColor: cores.primario, borderWidth: 2 },
  textoErro: { color: cores.vermelho, fontSize: 13, marginTop: 5 },
  tituloSecao: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  textoSecao: { color: cores.textoSuave, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  acaoSecao: { color: cores.primario, fontSize: 13, fontWeight: '800' },
  estadoVazio: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.linha, borderRadius: raios.cartao, padding: 24, alignItems: 'center' },
  iconeVazio: { width: 60, height: 60, borderRadius: 20, backgroundColor: cores.primarioClaro, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tituloVazio: { color: cores.texto, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  textoVazio: { color: cores.textoSuave, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  botaoVazio: { alignSelf: 'stretch', marginTop: 17 },
  aviso: { borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  textoAviso: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});

export default estilos;
