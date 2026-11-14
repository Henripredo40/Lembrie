import estilos from '../estilos/CartaoObjeto.estilos';
import { Pressable,  Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ImagemObjeto from './ImagemObjeto';
import { cores } from '../tema';
import { objetoÉEssencial } from '../utilitarios/objetos';

export default function CartaoObjeto({ objeto, aoEditar, aoRemover, compacto = false }: { objeto: any; aoEditar?: () => void; aoRemover?: () => void; compacto?: boolean }) {
  return (
    <View style={[estilos.cartao, compacto && estilos.cartaoCompacto]}>
      <ImagemObjeto nome={objeto.name} categoria={objeto.category} imagemUri={objeto.image_data} tamanho={compacto ? 24 : 29} compacto={compacto} />
      <View style={estilos.conteudo}>
        <View style={estilos.linhaTitulo}>
          <Text style={estilos.nome} numberOfLines={1}>{objeto.name}</Text>
          {objetoÉEssencial(objeto) ? <View style={estilos.selo}><Text style={estilos.textoSelo}>ESSENCIAL</Text></View> : null}
        </View>
        <Text style={estilos.categoria} numberOfLines={1}>{objeto.category || 'Outros'}</Text>
      </View>
      {aoEditar || aoRemover ? (
        <View style={estilos.acoes}>
          {aoEditar ? <Pressable accessibilityRole="button" accessibilityLabel={'Editar ' + objeto.name} hitSlop={8} onPress={aoEditar} style={estilos.acao}><Ionicons name="create-outline" size={19} color={cores.primario} /></Pressable> : null}
          {aoRemover ? <Pressable accessibilityRole="button" accessibilityLabel={'Remover ' + objeto.name} hitSlop={8} onPress={aoRemover} style={estilos.acao}><Ionicons name="trash-outline" size={18} color={cores.vermelho} /></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

