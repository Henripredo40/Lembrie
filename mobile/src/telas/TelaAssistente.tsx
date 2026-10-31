import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cores } from '../tema';
import estilos from '../estilos/TelaAssistente.estilos';

const perguntasRápidas = [
  'Como cadastro um objeto?',
  'Como marco um objeto como essencial?',
  'Como planejo uma saída pelo mapa?',
  'Como pesquiso um endereço ou CEP?',
  'Como conecto meu chaveiro Bluetooth?',
  'Como funcionam a localização e a privacidade?',
  'Como vejo meu último login?',
  'Quais são meus itens essenciais?',
  'Quais objetos estão cadastrados?',
  'O que levar para o trabalho?',
];

export default function TelaAssistente({ api }) {
  const [mensagens, definirMensagens] = useState([{ id: 'inicio', papel: 'assistente', texto: 'Olá! Posso ajudar você a usar o Lembriê, explicar objetos, mapa, localização, chaveiro e segurança, além de sugerir o que levar. Escolha uma pergunta ou escreva sua dúvida.' }]);
  const [texto, definirTexto] = useState('');
  const [enviando, definirEnviando] = useState(false);
  const rolagem = useRef(null);

  async function enviar(pergunta = texto) {
    const mensagem = pergunta.trim();
    if (!mensagem || enviando) return;
    definirTexto('');
    definirMensagens(atual => [...atual, { id: String(Date.now()), papel: 'pessoa', texto: mensagem }]);
    definirEnviando(true);
    try {
      const history = mensagens.filter(item => item.id !== 'inicio').slice(-8).map(item => ({ role: item.papel === 'pessoa' ? 'user' : 'assistant', text: item.texto }));
      const resposta = await api('/assistant', { method: 'POST', body: JSON.stringify({ message: mensagem, history }) });
      definirMensagens(atual => [...atual, { id: String(Date.now() + 1), papel: 'assistente', texto: resposta.answer }]);
    } catch (erro) {
      definirMensagens(atual => [...atual, { id: String(Date.now() + 1), papel: 'assistente', texto: erro.message || 'Não consegui responder agora. Confira a conexão e tente de novo.' }]);
    } finally {
      definirEnviando(false);
      setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={6}>
      <ScrollView ref={rolagem} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: true })}>
        <Text style={estilos.sobretitulo}>AJUDA PERSONALIZADA</Text>
        <Text style={estilos.titulo}>Converse com Lembriê</Text>
        <Text style={estilos.subtitulo}>Tire dúvidas sobre o site e o app, peça ajuda com mapa, rotina, objetos e Bluetooth, ou receba sugestões personalizadas.</Text>
        <View style={estilos.perguntas}>
          {perguntasRápidas.map(pergunta => <Pressable key={pergunta} accessibilityRole="button" onPress={() => enviar(pergunta)} style={estilos.pergunta}><Text style={estilos.textoPergunta}>{pergunta}</Text><Ionicons name="arrow-forward" size={16} color={cores.primario} /></Pressable>)}
        </View>
        <View style={estilos.conversa}>
          {mensagens.map(mensagem => <View key={mensagem.id} style={[estilos.bolha, mensagem.papel === 'pessoa' ? estilos.bolhaPessoa : estilos.bolhaAssistente]}><Text style={[estilos.textoBolha, mensagem.papel === 'pessoa' && estilos.textoBolhaPessoa]}>{mensagem.texto}</Text></View>)}
          {enviando ? <View style={estilos.carregando}><ActivityIndicator size="small" color={cores.primario} /><Text style={estilos.textoCarregando}>Pensando...</Text></View> : null}
        </View>
      </ScrollView>
      <View style={estilos.compositor}>
        <TextInput accessibilityLabel="Escreva sua pergunta" value={texto} onChangeText={definirTexto} placeholder="Pergunte como usar ou o que levar..." placeholderTextColor={cores.textoSuave} multiline maxLength={500} onSubmitEditing={() => enviar()} style={estilos.campo} />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar pergunta" disabled={enviando || !texto.trim()} onPress={() => enviar()} style={[estilos.enviar, (!texto.trim() || enviando) && estilos.enviarDesativado]}><Ionicons name="send" size={18} color={cores.branco} /></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
