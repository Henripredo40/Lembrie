import React, { useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import estilos from '../estilos/MapaOSM.estilos';

const ZOOM = 15;
const TILE = 256;
const MAX_TILE = 2 ** ZOOM;

function pixelX(longitude: number) {
  return ((longitude + 180) / 360) * MAX_TILE * TILE;
}

function pixelY(latitude: number) {
  const latitudeLimitada = Math.max(-85.0511, Math.min(85.0511, latitude));
  const radianos = latitudeLimitada * Math.PI / 180;
  return ((1 - Math.asinh(Math.tan(radianos)) / Math.PI) / 2) * MAX_TILE * TILE;
}

function coordenadas(x: number, y: number) {
  const tamanhoMundo = MAX_TILE * TILE;
  const xNormalizado = ((x % tamanhoMundo) + tamanhoMundo) % tamanhoMundo;
  const yLimitado = Math.max(0, Math.min(tamanhoMundo, y));
  return {
    longitude: xNormalizado / tamanhoMundo * 360 - 180,
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * yLimitado / tamanhoMundo))) * 180 / Math.PI,
  };
}

type Props = {
  latitude: number;
  longitude: number;
  onChoose: (latitude: number, longitude: number) => void;
};

export default function MapaOSMBase({ latitude, longitude, onChoose }: Props) {
  const janela = useWindowDimensions();
  const alturaMapa = Math.min(390, Math.max(310, Math.round(Math.min(janela.height * 0.42, janela.width * 0.88))));
  const [dimensões, definirDimensões] = useState({ width: 360, height: alturaMapa });
  const deslocamento = useRef(new Animated.ValueXY()).current;
  const centroX = pixelX(longitude);
  const centroY = pixelY(latitude);
  const centroAtual = useRef({ x: centroX, y: centroY });
  const escolherAtual = useRef(onChoose);
  centroAtual.current = { x: centroX, y: centroY };
  escolherAtual.current = onChoose;
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesto) => Math.abs(gesto.dx) > 10 && Math.abs(gesto.dx) > Math.abs(gesto.dy) * 1.2,
    onPanResponderTerminationRequest: () => true,
    onPanResponderMove: Animated.event([null, { dx: deslocamento.x, dy: deslocamento.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_event, gesto) => {
      const ponto = coordenadas(centroAtual.current.x - gesto.dx, centroAtual.current.y - gesto.dy);
      deslocamento.setValue({ x: 0, y: 0 });
      escolherAtual.current(ponto.latitude, ponto.longitude);
    },
    onPanResponderTerminate: () => deslocamento.setValue({ x: 0, y: 0 }),
  }), [deslocamento]);
  const tiles = useMemo(() => {
    const colunaInicial = Math.floor((centroX - dimensões.width / 2) / TILE);
    const colunaFinal = Math.floor((centroX + dimensões.width / 2 - 0.001) / TILE);
    const linhaInicial = Math.floor((centroY - dimensões.height / 2) / TILE);
    const linhaFinal = Math.floor((centroY + dimensões.height / 2 - 0.001) / TILE);
    const resultado = [];
    for (let linha = linhaInicial; linha <= linhaFinal; linha += 1) {
      for (let coluna = colunaInicial; coluna <= colunaFinal; coluna += 1) {
        if (linha < 0 || linha >= MAX_TILE) continue;
        const colunaNormalizada = ((coluna % MAX_TILE) + MAX_TILE) % MAX_TILE;
        resultado.push({
          chave: `${ZOOM}/${colunaNormalizada}/${linha}`,
          uri: `https://tile.openstreetmap.org/${ZOOM}/${colunaNormalizada}/${linha}.png`,
          left: coluna * TILE - centroX + dimensões.width / 2,
          top: linha * TILE - centroY + dimensões.height / 2,
        });
      }
    }
    return resultado;
  }, [centroX, centroY, dimensões.height, dimensões.width]);

  function selecionarPonto(x: number, y: number) {
    const ponto = coordenadas(centroX + x - dimensões.width / 2, centroY + y - dimensões.height / 2);
    onChoose(ponto.latitude, ponto.longitude);
  }

  return (
    <View
      style={[estilos.mapa, { height: alturaMapa }]}
      {...panResponder.panHandlers}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width && height) definirDimensões({ width, height });
      }}
    >
      <Animated.View pointerEvents="none" style={[estilos.camadaMapa, { transform: deslocamento.getTranslateTransform() }]}>
        {tiles.map(tile => (
          <Image
            key={tile.chave}
            source={{ uri: tile.uri, headers: { 'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)' } }}
            style={[estilos.tile, { left: tile.left, top: tile.top }]}
            resizeMode="stretch"
          />
        ))}
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Marcar este ponto no mapa"
        style={estilos.areaSelecionável}
        onPress={(event) => {
          const toque = event.nativeEvent as typeof event.nativeEvent & { offsetX?: number; offsetY?: number };
          const x = Number.isFinite(toque.locationX) ? toque.locationX : Number.isFinite(toque.offsetX) ? toque.offsetX : dimensões.width / 2;
          const y = Number.isFinite(toque.locationY) ? toque.locationY : Number.isFinite(toque.offsetY) ? toque.offsetY : dimensões.height / 2;
          selecionarPonto(x, y);
        }}
      />
      <View pointerEvents="none" style={estilos.marcadorMapa}>
        <Ionicons name="location" size={34} color="#D92D20" />
      </View>
      <View pointerEvents="none" style={estilos.dicaMapa}><Text style={estilos.textoDicaMapa}>Deslize para os lados ou toque para ajustar o ponto</Text></View>
    </View>
  );
}
