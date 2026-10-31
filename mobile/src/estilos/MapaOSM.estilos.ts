import { StyleSheet } from 'react-native';

const estilos = StyleSheet.create({
  mapa: { height: 265, width: '100%', backgroundColor: '#E8EEF4', borderRadius: 18, overflow: 'hidden', position: 'relative' },
  tile: { position: 'absolute', width: 256, height: 256 },
  areaSelecionável: { ...StyleSheet.absoluteFillObject },
  marcadorMapa: { position: 'absolute', left: '50%', top: '50%', marginLeft: -17, marginTop: -30 },
  dicaMapa: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', paddingVertical: 7 },
  textoDicaMapa: { color: '#344054', fontWeight: '700', fontSize: 13 },
  mapaWeb: { height: 265, borderRadius: 18, backgroundColor: '#E8EEF4', alignItems: 'center', justifyContent: 'center', gap: 10 },
  textoMapa: { color: '#475467', fontSize: 13 },
  linkMapa: { color: '#16796D', fontWeight: '800', fontSize: 13 },
});

export default estilos;
