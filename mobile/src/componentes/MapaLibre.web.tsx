import { createElement, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// O Expo/Metro não empacota automaticamente o worker ESM que o MapLibre 6
// procura ao lado do módulo. Sirva o arquivo da pasta public com MIME JavaScript.
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl(new URL('/maplibre-gl-worker.mjs', window.location.href).toString());
}

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
  const [erroMapa, definirErroMapa] = useState(false);
  const [tentativa, definirTentativa] = useState(0);
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
    let estiloCarregado = false;
    instancia.once('load', () => {
      estiloCarregado = true;
      definirErroMapa(false);
      requestAnimationFrame(() => instancia.resize());
    });
    instancia.on('error', () => {
      if (!estiloCarregado) definirErroMapa(true);
    });
    instancia.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    instancia.on('moveend', () => {
      const centro = instancia.getCenter();
      escolher.current(centro.lat, centro.lng);
    });
    mapa.current = instancia;
    const redimensionar = () => instancia.resize();
    window.addEventListener('resize', redimensionar);
    const observador = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(redimensionar)
      : null;
    if (elemento.current && observador) observador.observe(elemento.current);
    requestAnimationFrame(redimensionar);
    return () => {
      window.removeEventListener('resize', redimensionar);
      observador?.disconnect();
      instancia.remove();
      mapa.current = null;
    };
  }, [tentativa]);

  useEffect(() => {
    const centro = mapa.current?.getCenter();
    if (centro && (Math.abs(centro.lat - latitude) > 0.00001 || Math.abs(centro.lng - longitude) > 0.00001)) {
      mapa.current?.easeTo({ center: [longitude, latitude], duration: 300 });
    }
  }, [latitude, longitude]);

  return (
    <View style={[estilos.mapa, { height: altura }]}>
      {createElement('div', { ref: elemento, style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' } })}
      {erroMapa ? <View style={estilos.erroMapa}><Text style={estilos.textoErro}>Não foi possível carregar os mapas. Confira sua conexão e tente novamente.</Text><Pressable accessibilityRole="button" onPress={() => { definirErroMapa(false); definirTentativa(valor => valor + 1); }} style={estilos.botaoTentar}><Text style={estilos.textoBotaoTentar}>Tentar novamente</Text></Pressable></View> : null}
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
  erroMapa: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(248,245,242,0.96)' },
  textoErro: { color: '#344054', fontWeight: '700', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  botaoTentar: { backgroundColor: '#16796D', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  textoBotaoTentar: { color: '#FFFFFF', fontWeight: '800' },
});
