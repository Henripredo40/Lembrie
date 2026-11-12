import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EstadoVazio } from '../componentes/Elementos';
import { cores } from '../tema';
import { formatarData } from '../utilitarios/datas';
import estilos from '../estilos/TelaHistorico.estilos';

export default function TelaHistorico({ eventos }) {
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Text style={estilos.sobretitulo}>HISTÓRICO</Text>
      <Text style={estilos.titulo}>Histórico</Text>
      <Text style={estilos.subtitulo}>Confira as últimas atividades da sua conta.</Text>
      {eventos.length ? <View style={estilos.lista}>
        {eventos.map((evento, índice) => <View key={String(evento.id || índice)} style={estilos.evento}>
          <View style={estilos.icone}><Ionicons name={evento.type === 'departure' ? 'walk-outline' : evento.type === 'lista_saida' ? 'checkbox-outline' : evento.type === 'locate' ? 'bluetooth-outline' : 'time-outline'} size={18} color={cores.primario} /></View>
          <View style={estilos.detalhe}><Text style={estilos.mensagem}>{evento.message || evento.object_name || 'Atividade registrada'}</Text><Text style={estilos.data}>{formatarData(evento.created_at)}</Text></View>
        </View>)}
      </View> : <EstadoVazio ícone="time-outline" título="Ainda não há atividades" texto="As atividades serão registradas aqui conforme você usar as listas e os recursos do aplicativo." />}
      <View style={estilos.espacador} />
    </ScrollView>
  );
}
