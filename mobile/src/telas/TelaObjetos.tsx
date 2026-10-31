import estilos from '../estilos/TelaObjetos.estilos';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,  Switch, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CartaoObjeto from '../componentes/CartaoObjeto';
import ImagemObjeto from '../componentes/ImagemObjeto';
import { Aviso, Botao, CampoTexto, EstadoVazio, TituloSecao } from '../componentes/Elementos';
import { cores, raios } from '../tema';
import { categoriasDeObjeto, normalizarTexto, objetoÉEssencial, objetoTemChaveiro } from '../utils/objetos';

export default function TelaObjetos({ objetos, definirObjetos, api, categoriaInicial, notificar }) {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('Chaves');
  const [essencial, setEssencial] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [editando, setEditando] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [categoriaEdicao, setCategoriaEdicao] = useState('Outros');
  const [essencialEdicao, setEssencialEdicao] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => {
    setFiltroCategoria(categoriaInicial || '');
  }, [categoriaInicial]);

  const filtrados = useMemo(() => {
    let lista = objetos;
    if (filtro === 'essenciais') lista = lista.filter(objetoÉEssencial);
    if (filtro === 'bluetooth') lista = lista.filter(objetoTemChaveiro);
    if (filtroCategoria) lista = lista.filter((objeto) => normalizarTexto(objeto.category) === normalizarTexto(filtroCategoria));
    const termo = normalizarTexto(busca.trim());
    if (termo) lista = lista.filter((objeto) => normalizarTexto(String(objeto.name) + ' ' + String(objeto.category)).includes(termo));
    return lista;
  }, [objetos, filtro, filtroCategoria, busca]);

  async function cadastrarObjeto() {
    if (!nome.trim()) {
      setErroFormulario('Dê um nome para o objeto.');
      return;
    }
    setErroFormulario('');
    setSalvando(true);
    try {
      const novo = await api('/objects', {
        method: 'POST',
        body: JSON.stringify({ name: nome.trim(), category: categoria, essential: essencial }),
      });
      definirObjetos((atuais) => [novo, ...atuais]);
      setNome('');
      setCategoria('Chaves');
      setEssencial(false);
      notificar('Objeto cadastrado. A ilustração foi escolhida automaticamente pela categoria e pelo nome.');
    } catch (erro) {
      setErroFormulario(erro.message || 'Não foi possível cadastrar o objeto. Confira sua conexão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(objeto) {
    setEditando(objeto);
    setNomeEdicao(objeto.name || '');
    setCategoriaEdicao(objeto.category || 'Outros');
    setEssencialEdicao(objetoÉEssencial(objeto));
  }

  async function salvarEdicao() {
    if (!nomeEdicao.trim()) {
      notificar('Dê um nome para o objeto antes de salvar.');
      return;
    }
    setSalvandoEdicao(true);
    try {
      await api('/objects/' + editando.id, {
        method: 'PATCH',
        body: JSON.stringify({ name: nomeEdicao.trim(), category: categoriaEdicao, essential: essencialEdicao }),
      });
      definirObjetos((atuais) => atuais.map((objeto) => String(objeto.id) === String(editando.id)
        ? { ...objeto, name: nomeEdicao.trim(), category: categoriaEdicao, essential: essencialEdicao, important: essencialEdicao }
        : objeto));
      setEditando(null);
      notificar('Alterações salvas.');
    } catch (erro) {
      notificar(erro.message || 'Não foi possível salvar as alterações.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  function confirmarRemocao(objeto) {
    const remover = async () => {
      try {
        await api('/objects/' + objeto.id, { method: 'DELETE' });
        definirObjetos((atuais) => atuais.filter((item) => String(item.id) !== String(objeto.id)));
        notificar('“' + objeto.name + '” foi removido da sua lista.');
      } catch (erro) {
        notificar(erro.message || 'Não foi possível remover o objeto.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Remover “' + objeto.name + '” da sua lista?')) remover();
      return;
    }
    Alert.alert('Remover objeto?', '“' + objeto.name + '” será removido da sua lista.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: remover },
    ]);
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={estilos.sobretitulo}>ORGANIZAÇÃO</Text>
      <Text style={estilos.titulo}>Meus objetos</Text>
      <Text style={estilos.subtitulo}>Cadastre e organize o que você não quer esquecer.</Text>

      <View style={estilos.formulario}>
        <View style={estilos.cabecalhoFormulario}>
          <View style={estilos.miniIcone}><Ionicons name="add" size={19} color={cores.primario} /></View>
          <View style={{ flex: 1 }}><Text style={estilos.tituloFormulario}>Adicionar objeto</Text><Text style={estilos.legendaFormulario}>A imagem muda conforme o nome e a categoria.</Text></View>
          <ImagemObjeto nome={nome} categoria={categoria} tamanho={25} compacto />
        </View>

        <CampoTexto rótulo="Nome do objeto" value={nome} onChangeText={(valor) => { setNome(valor); setErroFormulario(''); }} placeholder="Ex.: Chaves de casa" maxLength={120} returnKeyType="done" />
        <Text style={estilos.rotuloCategoria}>Categoria</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.listaCategorias}>
          {categoriasDeObjeto.map((opção) => (
            <Pressable key={opção.nome} accessibilityRole="radio" accessibilityState={{ selected: categoria === opção.nome }} onPress={() => setCategoria(opção.nome)} style={[estilos.opcaoCategoria, categoria === opção.nome && estilos.opcaoCategoriaAtiva]}>
              <MaterialCommunityIcons name={opção.ícone} size={16} color={categoria === opção.nome ? cores.primario : cores.textoSuave} />
              <Text style={[estilos.textoCategoria, categoria === opção.nome && estilos.textoCategoriaAtiva]}>{opção.nome}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={estilos.linhaEssencial}>
          <View style={estilos.iconeEssencial}><Ionicons name="star" size={16} color="#A85B11" /></View>
          <View style={{ flex: 1 }}><Text style={estilos.tituloEssencial}>Marcar como essencial</Text><Text style={estilos.textoEssencial}>Dá destaque na sua lista de saída.</Text></View>
          <Switch value={essencial} onValueChange={setEssencial} trackColor={{ false: '#D0D5DD', true: '#A8A2F1' }} thumbColor={essencial ? cores.primario : '#F9FAFB'} />
        </View>

        {erroFormulario ? <Aviso ícone="alert-circle-outline" tom="erro" texto={erroFormulario} /> : null}
        <Botao título={salvando ? 'Salvando objeto...' : 'Adicionar à minha lista'} ícone="add-circle-outline" aoPressionar={cadastrarObjeto} carregando={salvando} estilo={estilos.botaoCadastro} />
      </View>

      <TituloSecao título={'MINHA LISTA · ' + objetos.length} />
      <View style={estilos.busca}>
        <Ionicons name="search-outline" size={18} color={cores.textoSuave} />
        <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar por nome ou categoria" placeholderTextColor={cores.textoSuave} style={estilos.campoBusca} returnKeyType="search" accessibilityLabel="Buscar nos objetos" />
        {busca ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setBusca('')}><Ionicons name="close-circle" size={19} color="#98A2B3" /></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.listaFiltros}>
        {[
          { chave: 'todos', nome: 'Todos' },
          { chave: 'essenciais', nome: 'Essenciais' },
          { chave: 'bluetooth', nome: 'Com Bluetooth' },
        ].map((opção) => (
          <Pressable key={opção.chave} accessibilityRole="button" onPress={() => { setFiltro(opção.chave); setFiltroCategoria(''); }} style={[estilos.filtro, filtro === opção.chave && !filtroCategoria && estilos.filtroAtivo]}>
            <Text style={[estilos.textoFiltro, filtro === opção.chave && !filtroCategoria && estilos.textoFiltroAtivo]}>{opção.nome}</Text>
          </Pressable>
        ))}
        {filtroCategoria ? <Pressable onPress={() => setFiltroCategoria('')} style={[estilos.filtro, estilos.filtroAtivo]}><Text style={[estilos.textoFiltro, estilos.textoFiltroAtivo]}>{filtroCategoria} ×</Text></Pressable> : null}
      </ScrollView>

      {objetos.length === 0 ? (
        <EstadoVazio ícone="cube-outline" título="Ainda não há objetos" texto="Adicione o primeiro objeto usando o formulário acima. Você poderá associar um chaveiro Bluetooth depois." />
      ) : filtrados.length === 0 ? (
        <EstadoVazio ícone="search-outline" título="Nada encontrado" texto="Mude o texto da busca ou escolha outro filtro." />
      ) : (
        <View style={estilos.listaObjetos}>
          {filtrados.map((objeto) => <CartaoObjeto key={String(objeto.id)} objeto={objeto} aoEditar={() => abrirEdicao(objeto)} aoRemover={() => confirmarRemocao(objeto)} />)}
        </View>
      )}
      <View style={{ height: 24 }} />

      <Modal visible={Boolean(editando)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditando(null)}>
        <KeyboardAvoidingView style={estilos.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={estilos.topoModal}>
            <Pressable accessibilityRole="button" onPress={() => setEditando(null)} hitSlop={8}><Text style={estilos.cancelarModal}>Cancelar</Text></Pressable>
            <Text style={estilos.tituloModal}>Editar objeto</Text>
            <View style={{ width: 62 }} />
          </View>
          <ScrollView contentContainerStyle={estilos.conteudoModal} keyboardShouldPersistTaps="handled">
            <View style={estilos.previaModal}><ImagemObjeto nome={nomeEdicao} categoria={categoriaEdicao} tamanho={38} /><Text style={estilos.textoPrevia}>Ilustração automática do objeto</Text></View>
            <CampoTexto rótulo="Nome do objeto" value={nomeEdicao} onChangeText={setNomeEdicao} maxLength={120} />
            <Text style={estilos.rotuloCategoria}>Categoria</Text>
            <View style={estilos.gradeCategorias}>
              {categoriasDeObjeto.map((opção) => <Pressable key={opção.nome} onPress={() => setCategoriaEdicao(opção.nome)} style={[estilos.opcaoCategoria, categoriaEdicao === opção.nome && estilos.opcaoCategoriaAtiva]}><MaterialCommunityIcons name={opção.ícone} size={16} color={categoriaEdicao === opção.nome ? cores.primario : cores.textoSuave} /><Text style={[estilos.textoCategoria, categoriaEdicao === opção.nome && estilos.textoCategoriaAtiva]}>{opção.nome}</Text></Pressable>)}
            </View>
            <View style={estilos.linhaEssencial}><View style={{ flex: 1 }}><Text style={estilos.tituloEssencial}>Marcar como essencial</Text><Text style={estilos.textoEssencial}>Dá destaque na sua lista de saída.</Text></View><Switch value={essencialEdicao} onValueChange={setEssencialEdicao} trackColor={{ false: '#D0D5DD', true: '#A8A2F1' }} thumbColor={essencialEdicao ? cores.primario : '#F9FAFB'} /></View>
            <Botao título="Salvar alterações" aoPressionar={salvarEdicao} carregando={salvandoEdicao} estilo={{ marginTop: 8 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

