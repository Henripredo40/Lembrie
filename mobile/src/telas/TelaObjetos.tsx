import estilos from '../estilos/TelaObjetos.estilos';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import CartaoObjeto from '../componentes/CartaoObjeto';
import ImagemObjeto from '../componentes/ImagemObjeto';
import { Aviso, Botao, CampoTexto, EstadoVazio, TituloSecao } from '../componentes/Elementos';
import { cores } from '../tema';
import { categoriasDeObjeto, criarDadosObjeto, filtrarObjetos, normalizarTexto, objetoÉEssencial, obterCategoriasDisponiveis } from '../utils/objetos';

const CATEGORIA_PERSONALIZADA = '__personalizada__';
type CategoriaComRepresentante = (typeof categoriasDeObjeto)[number] & { objetoRepresentativo?: { name: string; category?: string; image_data?: string | null } };

export default function TelaObjetos({ objetos, definirObjetos, api, categoriaInicial, notificar }) {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('Chaves');
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState('');
  const [essencial, setEssencial] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoEdicao, setFotoEdicao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [editando, setEditando] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [categoriaEdicao, setCategoriaEdicao] = useState('Outros');
  const [categoriaEdicaoPersonalizada, setCategoriaEdicaoPersonalizada] = useState('');
  const [essencialEdicao, setEssencialEdicao] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [objetoRemocao, setObjetoRemocao] = useState(null);
  const [removendo, setRemovendo] = useState(false);

  const categoriasDisponiveis = useMemo<CategoriaComRepresentante[]>(() => obterCategoriasDisponiveis(objetos), [objetos]);

  useEffect(() => {
    setFiltroCategoria(categoriaInicial || '');
  }, [categoriaInicial]);

  const filtrados = useMemo(() => filtrarObjetos(objetos, { filtro, categoria: filtroCategoria, busca }), [objetos, filtro, filtroCategoria, busca]);

  const categoriaParaSalvar = categoria === CATEGORIA_PERSONALIZADA ? categoriaPersonalizada.trim() : categoria;
  const categoriaEdicaoParaSalvar = categoriaEdicao === CATEGORIA_PERSONALIZADA ? categoriaEdicaoPersonalizada.trim() : categoriaEdicao;

  async function escolherFoto(definirFoto: (imagem: string | null) => void) {
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      if (resultado.canceled || !resultado.assets?.[0]) return;
      const asset = resultado.assets[0];
      const resize = asset.width >= asset.height ? { width: 480 } : { height: 480 };
      let reduzida = await ImageManipulator.manipulateAsync(asset.uri, [{ resize }], { compress: 0.68, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!reduzida.base64) throw new Error('Não foi possível preparar a foto. Escolha outra imagem.');
      if (reduzida.base64.length > 630000) {
        reduzida = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: asset.width >= asset.height ? { width: 360 } : { height: 360 } }], { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      }
      if (!reduzida.base64 || reduzida.base64.length > 630000) throw new Error('Essa foto ficou grande demais. Escolha uma imagem menor.');
      definirFoto('data:image/jpeg;base64,' + reduzida.base64);
    } catch (erro) {
      notificar(erro.message || 'Não foi possível abrir essa foto.');
    }
  }

  async function cadastrarObjeto() {
    if (!nome.trim()) {
      setErroFormulario('Dê um nome para o objeto.');
      return;
    }
    if (!categoriaParaSalvar) {
      setErroFormulario('Digite o nome da categoria personalizada.');
      return;
    }
    setErroFormulario('');
    setSalvando(true);
    try {
      const novo = await api('/objects', {
        method: 'POST',
        body: JSON.stringify(criarDadosObjeto({ nome, categoria: categoriaParaSalvar, essencial, foto })),
      });
      definirObjetos((atuais) => [novo, ...atuais]);
      setNome('');
      setCategoria('Chaves');
      setCategoriaPersonalizada('');
      setEssencial(false);
      setFoto(null);
      notificar(foto ? 'Objeto cadastrado com a foto salva na sua conta.' : 'Objeto cadastrado. Você pode adicionar uma foto depois.');
    } catch (erro) {
      setErroFormulario(erro.message || 'Não foi possível cadastrar o objeto. Confira sua conexão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(objeto) {
    setEditando(objeto);
    setNomeEdicao(objeto.name || '');
    const categoriaAtual = objeto.category || 'Outros';
    const categoriaDisponivel = categoriasDisponiveis.find((opção) => normalizarTexto(opção.nome) === normalizarTexto(categoriaAtual));
    setCategoriaEdicao(categoriaDisponivel ? categoriaDisponivel.nome : CATEGORIA_PERSONALIZADA);
    setCategoriaEdicaoPersonalizada(categoriaDisponivel ? '' : categoriaAtual);
    setEssencialEdicao(objetoÉEssencial(objeto));
    setFotoEdicao(objeto.image_data || null);
  }

  async function salvarEdicao() {
    if (!nomeEdicao.trim()) {
      notificar('Dê um nome para o objeto antes de salvar.');
      return;
    }
    if (!categoriaEdicaoParaSalvar) {
      notificar('Digite o nome da categoria personalizada.');
      return;
    }
    setSalvandoEdicao(true);
    try {
      await api('/objects/' + editando.id, {
        method: 'PATCH',
        body: JSON.stringify({ name: nomeEdicao.trim(), category: categoriaEdicaoParaSalvar, essential: essencialEdicao, image_data: fotoEdicao }),
      });
      definirObjetos((atuais) => atuais.map((objeto) => String(objeto.id) === String(editando.id)
        ? { ...objeto, name: nomeEdicao.trim(), category: categoriaEdicaoParaSalvar, image_data: fotoEdicao, essential: essencialEdicao, important: essencialEdicao }
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
    setObjetoRemocao(objeto);
  }

  async function removerObjeto() {
    if (!objetoRemocao || removendo) return;
    setRemovendo(true);
    try {
      await api('/objects/' + objetoRemocao.id, { method: 'DELETE' });
      definirObjetos((atuais) => atuais.filter((item) => String(item.id) !== String(objetoRemocao.id)));
      setObjetoRemocao(null);
      notificar('“' + objetoRemocao.name + '” foi removido da sua lista.');
    } catch (erro) {
      setObjetoRemocao(null);
      notificar(erro.message || 'Não foi possível remover o objeto.');
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={estilos.sobretitulo}>ORGANIZAÇÃO</Text>
      <Text style={estilos.titulo}>Meus objetos</Text>
      <Text style={estilos.subtitulo}>Cadastre e organize o que você não quer esquecer.</Text>

      <View style={estilos.formulario}>
        <View style={estilos.cabecalhoFormulario}>
          <View style={estilos.miniIcone}><Ionicons name="add" size={19} color={cores.primario} /></View>
          <View style={{ flex: 1 }}><Text style={estilos.tituloFormulario}>Adicionar objeto</Text><Text style={estilos.legendaFormulario}>Escolha uma foto ou use a ilustração automática.</Text></View>
          <ImagemObjeto nome={nome} categoria={categoria === CATEGORIA_PERSONALIZADA ? categoriaPersonalizada : categoria} imagemUri={foto} tamanho={25} compacto />
        </View>

        <CampoTexto rótulo="Nome do objeto" value={nome} onChangeText={(valor) => { setNome(valor); setErroFormulario(''); }} placeholder="Ex.: Chaves de casa" maxLength={120} returnKeyType="done" />
        <Text style={estilos.rotuloCategoria}>Categoria</Text>
        <View style={estilos.gradeCategorias}>
          {categoriasDisponiveis.map((opção) => (
            <Pressable key={opção.nome} accessibilityRole="radio" accessibilityState={{ selected: categoria === opção.nome }} onPress={() => setCategoria(opção.nome)} style={[estilos.opcaoCategoria, categoria === opção.nome && estilos.opcaoCategoriaAtiva]}>
              {opção.objetoRepresentativo
                ? <ImagemObjeto nome={opção.objetoRepresentativo.name} categoria={opção.objetoRepresentativo.category} imagemUri={opção.objetoRepresentativo.image_data} tamanho={16} compacto />
                : <MaterialCommunityIcons name={opção.ícone} size={16} color={categoria === opção.nome ? cores.primario : cores.textoSuave} />}
              <Text style={[estilos.textoCategoria, categoria === opção.nome && estilos.textoCategoriaAtiva]}>{opção.nome}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: categoria === CATEGORIA_PERSONALIZADA }} onPress={() => setCategoria(CATEGORIA_PERSONALIZADA)} style={[estilos.opcaoCategoria, categoria === CATEGORIA_PERSONALIZADA && estilos.opcaoCategoriaAtiva]}>
            <Ionicons name="add-circle-outline" size={16} color={categoria === CATEGORIA_PERSONALIZADA ? cores.primario : cores.textoSuave} />
            <Text style={[estilos.textoCategoria, categoria === CATEGORIA_PERSONALIZADA && estilos.textoCategoriaAtiva]}>Personalizada</Text>
          </Pressable>
        </View>
        {categoria === CATEGORIA_PERSONALIZADA ? <CampoTexto rótulo="Nome da categoria" value={categoriaPersonalizada} onChangeText={(valor) => { setCategoriaPersonalizada(valor); setErroFormulario(''); }} placeholder="Ex.: Equipamento esportivo" maxLength={80} /> : null}

        <View style={estilos.linhaFoto}><View style={{ flex: 1 }}><Text style={estilos.tituloEssencial}>Foto do objeto</Text><Text style={estilos.textoEssencial}>A foto escolhida será salva na sua conta e aparecerá no app e no site.</Text></View><Pressable accessibilityRole="button" onPress={() => escolherFoto(setFoto)} style={estilos.botaoFoto}><Ionicons name="image-outline" size={17} color={cores.primario} /><Text style={estilos.textoBotaoFoto}>{foto ? 'Trocar' : 'Escolher'}</Text></Pressable>{foto ? <Pressable accessibilityRole="button" accessibilityLabel="Remover foto" onPress={() => setFoto(null)} style={estilos.botaoFoto}><Ionicons name="trash-outline" size={17} color={cores.vermelho} /></Pressable> : null}</View>

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
        <EstadoVazio ícone="cube-outline" título="Ainda não há objetos" texto="Adicione o primeiro objeto pelo formulário acima. O cadastro funciona sem chaveiro; a associação Bluetooth é opcional." />
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
            <View style={estilos.previaModal}><ImagemObjeto nome={nomeEdicao} categoria={categoriaEdicao === CATEGORIA_PERSONALIZADA ? categoriaEdicaoPersonalizada : categoriaEdicao} imagemUri={fotoEdicao} tamanho={38} /><Text style={estilos.textoPrevia}>{fotoEdicao ? 'Foto escolhida para este objeto' : 'Ilustração automática do objeto'}</Text><View style={estilos.acoesFoto}><Pressable accessibilityRole="button" onPress={() => escolherFoto(setFotoEdicao)} style={estilos.botaoFoto}><Ionicons name="image-outline" size={17} color={cores.primario} /><Text style={estilos.textoBotaoFoto}>{fotoEdicao ? 'Trocar foto' : 'Escolher foto'}</Text></Pressable>{fotoEdicao ? <Pressable accessibilityRole="button" accessibilityLabel="Remover foto" onPress={() => setFotoEdicao(null)} style={estilos.botaoFoto}><Ionicons name="trash-outline" size={17} color={cores.vermelho} /><Text style={[estilos.textoBotaoFoto, { color: cores.vermelho }]}>Remover</Text></Pressable> : null}</View></View>
            <CampoTexto rótulo="Nome do objeto" value={nomeEdicao} onChangeText={setNomeEdicao} maxLength={120} />
            <Text style={estilos.rotuloCategoria}>Categoria</Text>
            <View style={estilos.gradeCategorias}>
              {categoriasDisponiveis.map((opção) => <Pressable key={opção.nome} accessibilityRole="radio" accessibilityState={{ selected: categoriaEdicao === opção.nome }} onPress={() => setCategoriaEdicao(opção.nome)} style={[estilos.opcaoCategoria, categoriaEdicao === opção.nome && estilos.opcaoCategoriaAtiva]}>{opção.objetoRepresentativo ? <ImagemObjeto nome={opção.objetoRepresentativo.name} categoria={opção.objetoRepresentativo.category} imagemUri={opção.objetoRepresentativo.image_data} tamanho={16} compacto /> : <MaterialCommunityIcons name={opção.ícone} size={16} color={categoriaEdicao === opção.nome ? cores.primario : cores.textoSuave} />}<Text style={[estilos.textoCategoria, categoriaEdicao === opção.nome && estilos.textoCategoriaAtiva]}>{opção.nome}</Text></Pressable>)}
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: categoriaEdicao === CATEGORIA_PERSONALIZADA }} onPress={() => setCategoriaEdicao(CATEGORIA_PERSONALIZADA)} style={[estilos.opcaoCategoria, categoriaEdicao === CATEGORIA_PERSONALIZADA && estilos.opcaoCategoriaAtiva]}><Ionicons name="add-circle-outline" size={16} color={categoriaEdicao === CATEGORIA_PERSONALIZADA ? cores.primario : cores.textoSuave} /><Text style={[estilos.textoCategoria, categoriaEdicao === CATEGORIA_PERSONALIZADA && estilos.textoCategoriaAtiva]}>Personalizada</Text></Pressable>
            </View>
            {categoriaEdicao === CATEGORIA_PERSONALIZADA ? <CampoTexto rótulo="Nome da categoria" value={categoriaEdicaoPersonalizada} onChangeText={setCategoriaEdicaoPersonalizada} placeholder="Ex.: Equipamento esportivo" maxLength={80} /> : null}
            <View style={estilos.linhaEssencial}><View style={{ flex: 1 }}><Text style={estilos.tituloEssencial}>Marcar como essencial</Text><Text style={estilos.textoEssencial}>Dá destaque na sua lista de saída.</Text></View><Switch value={essencialEdicao} onValueChange={setEssencialEdicao} trackColor={{ false: '#D0D5DD', true: '#A8A2F1' }} thumbColor={essencialEdicao ? cores.primario : '#F9FAFB'} /></View>
            <Botao título="Salvar alterações" aoPressionar={salvarEdicao} carregando={salvandoEdicao} estilo={{ marginTop: 8 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(objetoRemocao)} transparent animationType="fade" onRequestClose={() => { if (!removendo) setObjetoRemocao(null); }}>
        <View style={estilos.fundoConfirmacao}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar remoção" disabled={removendo} onPress={() => setObjetoRemocao(null)} style={estilos.fundoConfirmacaoBotao} />
          <View style={estilos.painelConfirmacao}>
            <View style={estilos.iconeConfirmacao}><Ionicons name="trash-outline" size={21} color={cores.vermelho} /></View>
            <Text style={estilos.tituloConfirmacao}>Remover objeto?</Text>
            <Text style={estilos.textoConfirmacao}>Remover “{objetoRemocao?.name}” da sua lista? Esta ação não pode ser desfeita.</Text>
            <View style={estilos.acoesConfirmacao}>
              <Pressable accessibilityRole="button" disabled={removendo} onPress={() => setObjetoRemocao(null)} style={estilos.botaoCancelarConfirmacao}><Text style={estilos.textoCancelarConfirmacao}>Cancelar</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={removendo} onPress={removerObjeto} style={[estilos.botaoRemoverConfirmacao, removendo && { opacity: 0.65 }]}><Text style={estilos.textoRemoverConfirmacao}>{removendo ? 'Removendo…' : 'Remover'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

