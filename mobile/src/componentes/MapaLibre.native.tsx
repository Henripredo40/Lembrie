import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';

type Propriedades = {
  latitude: number;
  longitude: number;
  aoEscolher: (latitude: number, longitude: number) => void;
};

const estiloDoMapa = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

export default function MapaLibre({ latitude, longitude, aoEscolher }: Propriedades) {
  const janela = useWindowDimensions();
  const camera = useRef<CameraRef>(null);
  const altura = Math.min(390, Math.max(310, Math.round(Math.min(janela.height * 0.42, janela.width * 0.88))));

  useEffect(() => {
    camera.current?.easeTo({ center: [longitude, latitude], duration: 350 });
  }, [latitude, longitude]);

  return (
    <View style={[estilos.mapa, { height: altura }]}>
      <Map
        mapStyle={estiloDoMapa}
        style={StyleSheet.absoluteFill}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        compass
        scaleBar
        onRegionDidChange={evento => {
          if (!evento.nativeEvent.userInteraction) return;
          const [lon, lat] = evento.nativeEvent.center;
          aoEscolher(lat, lon);
        }}
      >
        <Camera ref={camera} initialViewState={{ center: [longitude, latitude], zoom: 14 }} />
      </Map>
      <View pointerEvents="none" style={estilos.marcador}>
        <Ionicons name="location" size={38} color="#D92D20" />
      </View>
      <View pointerEvents="none" style={estilos.dica}><Text style={estilos.textoDica}>Mova o mapa para posicionar o pino</Text></View>
    </View>
  );
}

const estilos = StyleSheet.create({
  mapa: { width: '100%', backgroundColor: '#E8EEF4', borderRadius: 18, overflow: 'hidden' },
  marcador: { position: 'absolute', left: '50%', top: '50%', marginLeft: -19, marginTop: -36 },
  dica: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', paddingVertical: 7 },
  textoDica: { color: '#344054', fontWeight: '700', fontSize: 13 },
});
