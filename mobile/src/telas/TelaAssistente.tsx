import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cores } from '../tema';
import estilos from '../estilos/TelaAssistente.estilos';

const perguntasRápidas = ['O que levar para o trabalho?', 'Quais lugares eu costumo visitar?', 'Quais são meus itens essenciais?'];

export default function TelaAssistente({ api }) {
  const [mensagens, definirMensagens] = useState([{ id: 'inicio', papel: 'assistente', texto: 'Olá! Posso sugerir o que levar para um local, consultar seus objetos e ajudar com sua rotina. O que você quer saber?' }]);
  const [texto, definirTexto] = useState('');
  const [enviando, definirEnviando] = useState(false);
  const [iaAtiva, definirIaAtiva] = useState(null);
  const rolagem = useRef(null);

  useEffect(() => {
    let ativo = true;
    api('/assistant/status').then(status => { if (ativo) definirIaAtiva(status.enabled === true); }).catch(() => { if (ativo) definirIaAtiva(false); });
    return () => { ativo = false; };
  }, [api]);

  async function enviar(pergunta = texto) {
    const mensagem = pergunta.trim();
    if (!mensagem || enviando) return;
    definirTexto('');
    definirMensagens(atual => [...atual, { id: String(Date.now()), papel: 'pessoa', texto: mensagem }]);
    definirEnviando(true);
    try {
      const history = mensagens.filter(item => item.id !== 'inicio').slice(-8).map(item => ({ role: item.papel === 'pessoa' ? 'user' : 'assistant', text: item.texto }));
      const resposta = await api('/assistant', { method: 'POST', body: JSON.stringify({ message: mensagem, history }) });
      if (typeof resposta.ai === 'boolean') definirIaAtiva(resposta.ai);
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
        <Text style={estilos.subtitulo}>{iaAtiva === true ? 'IA Gemini ativa: posso considerar seus objetos e destinos salvos. Suas perguntas e esse contexto são enviados ao Google para gerar a resposta; o histórico não é guardado pela API do Gemini.' : iaAtiva === false ? 'Assistente especialista em objetos e destinos. A IA Gemini ainda não foi ativada no servidor; por enquanto, uso as respostas locais do Lembriê.' : 'Conferindo se a IA está disponível…'}</Text>
        <View style={estilos.perguntas}>
          {perguntasRápidas.map(pergunta => <Pressable key={pergunta} accessibilityRole="button" onPress={() => enviar(pergunta)} style={estilos.pergunta}><Text style={estilos.textoPergunta}>{pergunta}</Text><Ionicons name="arrow-forward" size={16} color={cores.primario} /></Pressable>)}
        </View>
        <View style={estilos.conversa}>
          {mensagens.map(mensagem => <View key={mensagem.id} style={[estilos.bolha, mensagem.papel === 'pessoa' ? estilos.bolhaPessoa : estilos.bolhaAssistente]}><Text style={[estilos.textoBolha, mensagem.papel === 'pessoa' && estilos.textoBolhaPessoa]}>{mensagem.texto}</Text></View>)}
          {enviando ? <View style={estilos.carregando}><ActivityIndicator size="small" color={cores.primario} /><Text style={estilos.textoCarregando}>Pensando...</Text></View> : null}
        </View>
      </ScrollView>
      <View style={estilos.compositor}>
        <TextInput accessibilityLabel="Escreva sua pergunta" value={texto} onChangeText={definirTexto} placeholder="Pergunte sobre seus objetos..." placeholderTextColor={cores.textoSuave} multiline maxLength={500} onSubmitEditing={() => enviar()} style={estilos.campo} />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar pergunta" disabled={enviando || !texto.trim()} onPress={() => enviar()} style={[estilos.enviar, (!texto.trim() || enviando) && estilos.enviarDesativado]}><Ionicons name="send" size={18} color={cores.branco} /></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
