import React, { useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import estilos from '../estilos/MapaOSM.estilos';

const NIVEL_ZOOM = 15;
const TAMANHO_QUADRO = 256;
const TOTAL_QUADROS = 2 ** NIVEL_ZOOM;

function calcularPixelX(longitude: number) {
  return ((longitude + 180) / 360) * TOTAL_QUADROS * TAMANHO_QUADRO;
}

function calcularPixelY(latitude: number) {
  const latitudeLimitada = Math.max(-85.0511, Math.min(85.0511, latitude));
  const radianos = latitudeLimitada * Math.PI / 180;
  return ((1 - Math.asinh(Math.tan(radianos)) / Math.PI) / 2) * TOTAL_QUADROS * TAMANHO_QUADRO;
}

function calcularCoordenadas(x: number, y: number) {
  const tamanhoMundo = TOTAL_QUADROS * TAMANHO_QUADRO;
  const xNormalizado = ((x % tamanhoMundo) + tamanhoMundo) % tamanhoMundo;
  const yLimitado = Math.max(0, Math.min(tamanhoMundo, y));
  return {
    longitude: xNormalizado / tamanhoMundo * 360 - 180,
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * yLimitado / tamanhoMundo))) * 180 / Math.PI,
  };
}

type Propriedades = {
  latitude: number;
  longitude: number;
  aoEscolher: (latitude: number, longitude: number) => void;
};

export default function MapaOSMBase({ latitude, longitude, aoEscolher }: Propriedades) {
  const janela = useWindowDimensions();
  const alturaMapa = Math.min(390, Math.max(310, Math.round(Math.min(janela.height * 0.42, janela.width * 0.88))));
  const [dimensões, definirDimensões] = useState({ width: 360, height: alturaMapa });
  const deslocamento = useRef(new Animated.ValueXY()).current;
  const centroHorizontal = calcularPixelX(longitude);
  const centroVertical = calcularPixelY(latitude);
  const centroDoMapa = useRef({ x: centroHorizontal, y: centroVertical });
  const funcaoAoEscolher = useRef(aoEscolher);
  centroDoMapa.current = { x: centroHorizontal, y: centroVertical };
  funcaoAoEscolher.current = aoEscolher;
  const controleDeArrasto = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_evento, gesto) => Math.abs(gesto.dx) > 10 && Math.abs(gesto.dx) > Math.abs(gesto.dy) * 1.2,
    onPanResponderTerminationRequest: () => true,
    onPanResponderMove: Animated.event([null, { dx: deslocamento.x, dy: deslocamento.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_evento, gesto) => {
      const ponto = calcularCoordenadas(centroDoMapa.current.x - gesto.dx, centroDoMapa.current.y - gesto.dy);
      deslocamento.setValue({ x: 0, y: 0 });
      funcaoAoEscolher.current(ponto.latitude, ponto.longitude);
    },
    onPanResponderTerminate: () => deslocamento.setValue({ x: 0, y: 0 }),
  }), [deslocamento]);
  const quadros = useMemo(() => {
    const colunaInicial = Math.floor((centroHorizontal - dimensões.width / 2) / TAMANHO_QUADRO);
    const colunaFinal = Math.floor((centroHorizontal + dimensões.width / 2 - 0.001) / TAMANHO_QUADRO);
    const linhaInicial = Math.floor((centroVertical - dimensões.height / 2) / TAMANHO_QUADRO);
    const linhaFinal = Math.floor((centroVertical + dimensões.height / 2 - 0.001) / TAMANHO_QUADRO);
    const quadrosDoMapa = [];
    for (let linha = linhaInicial; linha <= linhaFinal; linha += 1) {
      for (let coluna = colunaInicial; coluna <= colunaFinal; coluna += 1) {
        if (linha < 0 || linha >= TOTAL_QUADROS) continue;
        const colunaNormalizada = ((coluna % TOTAL_QUADROS) + TOTAL_QUADROS) % TOTAL_QUADROS;
        quadrosDoMapa.push({
          chave: `${NIVEL_ZOOM}/${colunaNormalizada}/${linha}`,
          uri: `https://tile.openstreetmap.org/${NIVEL_ZOOM}/${colunaNormalizada}/${linha}.png`,
          left: coluna * TAMANHO_QUADRO - centroHorizontal + dimensões.width / 2,
          top: linha * TAMANHO_QUADRO - centroVertical + dimensões.height / 2,
        });
      }
    }
    return quadrosDoMapa;
  }, [centroHorizontal, centroVertical, dimensões.height, dimensões.width]);

  function selecionarPonto(x: number, y: number) {
    const ponto = calcularCoordenadas(centroHorizontal + x - dimensões.width / 2, centroVertical + y - dimensões.height / 2);
    aoEscolher(ponto.latitude, ponto.longitude);
  }

  return (
    <View
      style={[estilos.mapa, { height: alturaMapa }]}
      {...controleDeArrasto.panHandlers}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width && height) definirDimensões({ width, height });
      }}
    >
      <Animated.View pointerEvents="none" style={[estilos.camadaMapa, { transform: deslocamento.getTranslateTransform() }]}>
        {quadros.map(quadro => (
          <Image
            key={quadro.chave}
            source={{ uri: quadro.uri, headers: { 'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)' } }}
            style={[estilos.tile, { left: quadro.left, top: quadro.top }]}
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
