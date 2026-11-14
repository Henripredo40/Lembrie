import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, View } from 'react-native';
import { obterDesenhoDoObjeto } from '../utilitarios/objetos';
import styles from '../estilos/ImagemObjeto.estilos';

export default function ImagemObjeto({ nome, categoria, tamanho = 30, compacto = false, imagemUri }: { nome?: string; categoria?: string; tamanho?: number; compacto?: boolean; imagemUri?: string | null }) {
  const desenho = obterDesenhoDoObjeto(nome, categoria);
  const lado = tamanho + (compacto ? 22 : 30);

  return (
    <View
      accessibilityLabel={'Ilustração de ' + (nome || categoria || 'objeto')}
      style={[styles.base, { width: lado, height: lado, borderRadius: compacto ? 15 : 19, backgroundColor: desenho.fundo }]}
    >
      {imagemUri ? <Image source={{ uri: imagemUri }} resizeMode="cover" style={{ width: lado, height: lado, borderRadius: compacto ? 15 : 19 }} accessibilityLabel={'Foto de ' + (nome || categoria || 'objeto')} /> : <MaterialCommunityIcons name={desenho.ícone as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={tamanho} color={desenho.cor} />}
    </View>
  );
}
