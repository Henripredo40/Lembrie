import React from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Aviso, TituloSecao } from '../componentes/Elementos';
import { cores } from '../tema';
import estilos from '../estilos/TelaConfiguracoes.estilos';

export default function TelaConfiguracoes({ perfil, configuracoes, salvarConfiguracoes, abrirPerfil, salvando, saindo, sairDaConta }) {
  const preferencias = configuracoes || { routine_enabled: false, preventive_alerts: true, essential_only: false };
  const alterar = (campo, valor) => salvarConfiguracoes({ ...preferencias, [campo]: valor });
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Text style={estilos.sobretitulo}>PREFERÊNCIAS</Text>
      <Text style={estilos.titulo}>Configurações</Text>
      <Text style={estilos.subtitulo}>Ajuste os lembretes, as listas e os dados da sua conta.</Text>
      <View style={estilos.perfil}>
        <View style={estilos.avatar}><Text style={estilos.letra}>{(perfil?.name || 'U').charAt(0).toLocaleUpperCase('pt-BR')}</Text></View>
        <View style={estilos.dadosPerfil}><Text style={estilos.nome}>{perfil?.name || 'Usuário'}</Text><Text style={estilos.email}>{perfil?.email || ''}</Text></View>
      </View>
      <Pressable accessibilityRole="button" onPress={abrirPerfil} style={estilos.botaoPerfil}><Ionicons name="create-outline" size={18} color={cores.primario} /><Text style={estilos.textoBotaoPerfil}>Editar perfil e senha</Text><Ionicons name="chevron-forward" size={16} color={cores.primario} /></Pressable>
      <TituloSecao título="COMPORTAMENTO DO APP" />
      <LinhaPreferencia ícone="notifications-outline" título="Lembretes preventivos" texto="Mostrar lembretes dentro do aplicativo." valor={ativo(preferencias.preventive_alerts)} aoMudar={valor => alterar('preventive_alerts', valor)} desativada={salvando} />
      <LinhaPreferencia ícone="calendar-outline" título="Reconhecer minha rotina" texto="Guardar destinos salvos por você. Desativar apaga esses registros." valor={ativo(preferencias.routine_enabled)} aoMudar={valor => alterar('routine_enabled', valor)} desativada={salvando} />
      <LinhaPreferencia ícone="star-outline" título="Somente itens essenciais" texto="Usar apenas os itens essenciais nas listas de saída." valor={ativo(preferencias.essential_only)} aoMudar={valor => alterar('essential_only', valor)} desativada={salvando} />
      <Aviso ícone="information-circle-outline" texto="A localização é necessária para usar o app e o site. Com o app/site aberto, o Lembriê identifica lugares para sugerir itens; guarda nomes aproximados por até 90 dias e não salva coordenadas. A IA Gemini usa esses nomes e seus objetos cadastrados quando ativada no servidor." />
      <TituloSecao título="SUA CONTA" />
      <Pressable accessibilityRole="button" onPress={sairDaConta} disabled={saindo} style={estilos.botaoSair}><Ionicons name="log-out-outline" size={19} color={cores.vermelho} /><Text style={estilos.textoSair}>{saindo ? 'Saindo...' : 'Sair da conta'}</Text></Pressable>
      <View style={estilos.rodape}><MaterialCommunityIcons name="map-marker-check" size={16} color={cores.primario} /><Text style={estilos.textoRodape}>Lembriê · versão 1.0</Text></View>
      <View style={estilos.espacador} />
    </ScrollView>
  );
}

function ativo(valor) {
  return valor === true || Number(valor) === 1;
}

function LinhaPreferencia({ ícone, título, texto, valor, aoMudar, desativada }) {
  return <View style={estilos.linhaPreferencia}>
    <View style={estilos.iconePreferencia}><Ionicons name={ícone} size={19} color={cores.primario} /></View>
    <View style={estilos.textosPreferencia}><Text style={estilos.tituloPreferencia}>{título}</Text><Text style={estilos.textoPreferencia}>{texto}</Text></View>
    <Switch value={valor} onValueChange={aoMudar} disabled={desativada} trackColor={{ false: '#D0D5DD', true: '#A8A2F1' }} thumbColor={valor ? cores.primario : '#F9FAFB'} />
  </View>;
}
