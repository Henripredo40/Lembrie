import estilos from '../estilos/Elementos.estilos';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cores } from '../tema';

type IconeIon = React.ComponentProps<typeof Ionicons>['name'];

export function Botao({ titulo, título, aoPressionar, ícone, secundário = false, carregando = false, desativado = false, estilo }: { titulo?: string; título?: string; aoPressionar?: () => void; ícone?: IconeIon | string; secundário?: boolean; carregando?: boolean; desativado?: boolean; estilo?: StyleProp<ViewStyle> }) {
  const textoBotao = título ?? titulo ?? '';
  const bloqueado = desativado || carregando;
  const [focado, definirFocado] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: bloqueado, busy: carregando }}
      onPress={aoPressionar}
      onFocus={() => definirFocado(true)}
      onBlur={() => definirFocado(false)}
      disabled={bloqueado}
      style={({ pressed }) => [
        estilos.botao,
        secundário && estilos.botaoSecundario,
        bloqueado && estilos.botaoDesativado,
        focado && estilos.botaoFocado,
        pressed && !bloqueado && estilos.botaoPressionado,
        estilo,
      ]}
    >
      {carregando ? (
        <>
          <ActivityIndicator color={secundário ? cores.primario : cores.branco} />
          <Text style={[estilos.textoBotao, secundário && estilos.textoBotaoSecundario]}>{textoBotao}</Text>
        </>
      ) : (
        <>
          {ícone ? <Ionicons name={ícone as IconeIon} size={19} color={secundário ? cores.primario : cores.branco} /> : null}
          <Text style={[estilos.textoBotao, secundário && estilos.textoBotaoSecundario]}>{textoBotao}</Text>
        </>
      )}
    </Pressable>
  );
}

export function CampoTexto({ rótulo, erro, estilo, ...propriedades }: { rótulo?: string; erro?: string; estilo?: StyleProp<TextStyle> } & TextInputProps) {
  const [focado, definirFocado] = useState(false);
  const { onFocus, onBlur, ...outrasPropriedades } = propriedades;
  return (
    <View style={estilos.grupoCampo}>
      {rótulo ? <Text style={estilos.rotulo}>{rótulo}</Text> : null}
      <TextInput
        accessibilityLabel={rótulo}
        placeholderTextColor={cores.textoSuave}
        onFocus={(event) => { definirFocado(true); onFocus?.(event); }}
        onBlur={(event) => { definirFocado(false); onBlur?.(event); }}
        style={[estilos.campo, focado && estilos.campoFocado, erro && estilos.campoComErro, estilo]}
        {...outrasPropriedades}
      />
      {erro ? <Text style={estilos.textoErro}>{erro}</Text> : null}
    </View>
  );
}

export function TituloSecao({ título, ação, aoPressionar }: { título: string; ação?: string; aoPressionar?: () => void }) {
  return (
    <View style={estilos.tituloSecao}>
      <Text style={estilos.textoSecao}>{título}</Text>
      {ação ? (
        <Pressable accessibilityRole="button" onPress={aoPressionar} hitSlop={8}>
          <Text style={estilos.acaoSecao}>{ação}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EstadoVazio({ ícone = 'cube-outline', título, texto, ação, aoPressionar }: { ícone?: IconeIon | string; título: string; texto: string; ação?: string; aoPressionar?: () => void }) {
  return (
    <View style={estilos.estadoVazio}>
      <View style={estilos.iconeVazio}>
        <Ionicons name={ícone as IconeIon} size={30} color={cores.primario} />
      </View>
      <Text style={estilos.tituloVazio}>{título}</Text>
      <Text style={estilos.textoVazio}>{texto}</Text>
      {ação ? <Botao título={ação} aoPressionar={aoPressionar} estilo={estilos.botaoVazio} /> : null}
    </View>
  );
}

export function Aviso({ ícone = 'information-circle-outline', texto, tom = 'info' }: { ícone?: IconeIon | string; texto: string; tom?: 'info' | 'alerta' | 'erro' }) {
  const fundo = tom === 'alerta' ? cores.laranjaClaro : tom === 'erro' ? cores.vermelhoClaro : cores.azulClaro;
  const tinta = tom === 'alerta' ? cores.laranja : tom === 'erro' ? cores.vermelho : cores.primario;

  return (
    <View accessibilityLiveRegion={tom === 'erro' ? 'assertive' : 'polite'} style={[estilos.aviso, { backgroundColor: fundo }]}>
      <Ionicons name={ícone as IconeIon} size={20} color={tinta} />
      <Text style={[estilos.textoAviso, { color: tinta }]}>{texto}</Text>
    </View>
  );
}

