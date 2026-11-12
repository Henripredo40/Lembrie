import { createElement, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Propriedades = {
  latitude: number;
  longitude: number;
  aoEscolher: (latitude: number, longitude: number) => void;
};

const estiloDoMapa = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

export default function MapaLibre({ latitude, longitude, aoEscolher }: Propriedades) {
  const janela = useWindowDimensions();
  const elemento = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<MapLibreMap | null>(null);
  const escolher = useRef(aoEscolher);
  const altura = Math.min(390, Math.max(310, Math.round(Math.min(janela.height * 0.42, janela.width * 0.88))));
  escolher.current = aoEscolher;

  useEffect(() => {
    if (!elemento.current) return;
    const instancia = new maplibregl.Map({
      container: elemento.current,
      style: estiloDoMapa,
      center: [longitude, latitude],
      zoom: 14,
      attributionControl: { compact: true },
    });
    instancia.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    instancia.on('moveend', () => {
      const centro = instancia.getCenter();
      escolher.current(centro.lat, centro.lng);
    });
    mapa.current = instancia;
    return () => {
      instancia.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    const centro = mapa.current?.getCenter();
    if (centro && (Math.abs(centro.lat - latitude) > 0.00001 || Math.abs(centro.lng - longitude) > 0.00001)) {
      mapa.current?.easeTo({ center: [longitude, latitude], duration: 300 });
    }
  }, [latitude, longitude]);

  return (
    <View style={[estilos.mapa, { height: altura }]}>
      {createElement('div', { ref: elemento, style: { position: 'absolute', inset: 0 } })}
      <View pointerEvents="none" style={estilos.marcador}>
        <Ionicons name="location" size={38} color="#D92D20" />
      </View>
      <View pointerEvents="none" style={estilos.dica}><Text style={estilos.textoDica}>Arraste ou amplie o mapa para posicionar o pino</Text></View>
    </View>
  );
}

const estilos = StyleSheet.create({
  mapa: { width: '100%', backgroundColor: '#E8EEF4', borderRadius: 18, overflow: 'hidden', position: 'relative' },
  marcador: { position: 'absolute', left: '50%', top: '50%', marginLeft: -19, marginTop: -36 },
  dica: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', paddingVertical: 7 },
  textoDica: { color: '#344054', fontWeight: '700', fontSize: 13 },
});
