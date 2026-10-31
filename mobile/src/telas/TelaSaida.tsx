import estilos from '../estilos/TelaSaida.estilos';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView,  Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ImagemObjeto from '../componentes/ImagemObjeto';
import { Aviso, Botao, CampoTexto, EstadoVazio, TituloSecao } from '../componentes/Elementos';
import { cores } from '../tema';
import { normalizarTexto, objetoÉEssencial } from '../utils/objetos';

export default function TelaSaida({ objetos, api, notificar, atualizarDados, somenteEssenciais, destinoInicial = '' }) {
  const [destino, definirDestino] = useState('');
  const [lista, definirLista] = useState([]);
  const [sugestoes, definirSugestoes] = useState([]);
  const [perfis, definirPerfis] = useState([]);
  const [carregando, definirCarregando] = useState(false);
  const [salvando, definirSalvando] = useState(false);
  const [conferindoSaida, definirConferindoSaida] = useState(false);
  const [resultadoSaida, definirResultadoSaida] = useState(null);
  const [erro, definirErro] = useState('');

  useEffect(() => {
    api('/exit-profiles')
      .then((dados) => definirPerfis(Array.isArray(dados) ? dados : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    definirDestino(destinoInicial);
  }, [destinoInicial]);

  const conferidos = useMemo(() => lista.filter((item) => item.conferido).length, [lista]);
  const progresso = lista.length ? Math.round(conferidos * 100 / lista.length) : 0;
  const objetosParaConferir = somenteEssenciais ? objetos.filter(objetoÉEssencial) : objetos;

  async function montarLista() {
    definirErro('');
    if (!objetos.length) {
      definirErro('Cadastre pelo menos um objeto antes de montar sua lista.');
      return;
    }
    definirCarregando(true);
    try {
      let itensSugeridos = [];
      if (!somenteEssenciais) {
        try {
          const resposta = await api('/recommendations?destination=' + encodeURIComponent(destino.trim()));
          itensSugeridos = Array.isArray(resposta.items) ? resposta.items : [];
        } catch (falha) {
          definirErro('Não consegui carregar as sugestões do destino. Montei a lista com os objetos cadastrados.');
        }
      }
      const nomesRegistrados = new Set(objetosParaConferir.map((item) => normalizarTexto(item.name)));
      const sugestõesNovas = itensSugeridos
        .filter((nome) => !nomesRegistrados.has(normalizarTexto(nome)))
        .map((nome, índice) => ({ id: 'sugestao-' + índice, name: nome, category: 'Sugestão', essential: false, sugestao: true, conferido: false }));
      const listaObjetos = objetosParaConferir.map((objeto) => ({
        id: objeto.id,
        name: objeto.name,
        category: objeto.category,
        image_data: objeto.image_data,
        essential: objetoÉEssencial(objeto),
        sugestao: false,
        conferido: false,
      }));
      definirLista([...listaObjetos, ...sugestõesNovas]);
      definirSugestoes(sugestõesNovas);
      if (!listaObjetos.length && !sugestõesNovas.length && somenteEssenciais) {
        definirErro('Ainda não há objetos essenciais. Marque algum objeto como essencial ou desative esse filtro nas configurações.');
      }
      if (listaObjetos.length || sugestõesNovas.length) {
        const destinoRegistrado = destino.trim() || 'sem destino informado';
        api('/events', {
          method: 'POST',
          body: JSON.stringify({
            type: 'lista_saida',
            message: 'Lista de saída para ' + destinoRegistrado + ' montada com ' + (listaObjetos.length + sugestõesNovas.length) + ' itens.',
          }),
        }).then(() => atualizarDados?.()).catch(() => {});
      }
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível preparar a lista. Confira a conexão e tente novamente.');
    } finally {
      definirCarregando(false);
    }
  }

  function alternarConferido(id) {
    definirLista((atuais) => atuais.map((item) => item.id === id ? { ...item, conferido: !item.conferido } : item));
    definirResultadoSaida(null);
  }

  function confirmarItensPendentes(quantidade) {
    const texto = `${quantidade} ${quantidade === 1 ? 'item ainda não está marcado' : 'itens ainda não estão marcados'}. Quer revisar a lista antes de registrar a saída?`;
    if (Platform.OS === 'web') {
      return Promise.resolve(window.confirm(texto));
    }
    return new Promise((resolver) => {
      Alert.alert('Ainda há itens pendentes', texto, [
        { text: 'Revisar lista', style: 'cancel', onPress: () => resolver(false) },
        { text: 'Registrar mesmo assim', onPress: () => resolver(true) },
      ], { cancelable: true, onDismiss: () => resolver(false) });
    });
  }

  async function conferirSaida() {
    const pendentes = lista.filter((item) => !item.conferido).length;
    if (pendentes && !(await confirmarItensPendentes(pendentes))) return;
    definirErro('');
    definirResultadoSaida(null);
    definirConferindoSaida(true);
    try {
      const resultado = await api('/departure/check', {
        method: 'POST',
        body: JSON.stringify({
          destination: destino.trim(),
          checked_ids: lista.filter((item) => item.conferido && !item.sugestao).map((item) => Number(item.id)).filter(Number.isFinite),
        }),
      });
      definirResultadoSaida(resultado);
      await atualizarDados?.();
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível conferir sua saída. Verifique a conexão e tente novamente.');
    } finally {
      definirConferindoSaida(false);
    }
  }

  async function salvarPerfil() {
    if (!destino.trim()) {
      definirErro('Dê um nome ao destino para salvar esta lista.');
      return;
    }
    if (!lista.length) {
      definirErro('Monte uma lista antes de salvar o perfil.');
      return;
    }
    definirErro('');
    definirSalvando(true);
    try {
      await api('/exit-profiles', {
        method: 'POST',
        body: JSON.stringify({
          destination: destino.trim(),
          checklist: lista.map(({ id, name, category, essential, sugestao }) => ({ id, name, category, essential, sugestao })),
        }),
      });
      const atualizados = await api('/exit-profiles');
      definirPerfis(Array.isArray(atualizados) ? atualizados : []);
      notificar('Perfil “' + destino.trim() + '” salvo.');
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível salvar este perfil.');
    } finally {
      definirSalvando(false);
    }
  }

  function usarPerfil(perfil) {
    definirDestino(perfil.destination || '');
    let itens = [];
    try {
      itens = typeof perfil.checklist_json === 'string' ? JSON.parse(perfil.checklist_json) : perfil.checklist_json || [];
    } catch (falha) {
      itens = [];
    }
    const itensDoPerfil = Array.isArray(itens) ? itens : [];
    const itensFiltrados = somenteEssenciais
      ? itensDoPerfil.filter((item) => item.essential === true || Number(item.essential) === 1)
      : itensDoPerfil;
    definirLista(itensFiltrados.map((item, índice) => ({ ...item, id: item.id || 'perfil-' + índice, conferido: false })));
    definirSugestoes([]);
    definirErro(somenteEssenciais && itensFiltrados.length === 0
      ? 'Este perfil não tem objetos essenciais. Desative o filtro ou monte uma lista nova.'
      : '');
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={estilos.sobretitulo}>ROTINA</Text>
      <Text style={estilos.titulo}>Antes de sair</Text>
      <Text style={estilos.subtitulo}>Monte sua lista e marque os itens conferidos. A detecção por proximidade e os alertas dependem de um chaveiro Bluetooth compatível associado.</Text>

      <Botao título={carregando ? 'Preparando sua lista...' : 'Montar lista de saída'} ícone="checkbox-outline" aoPressionar={montarLista} carregando={carregando} />

      {perfis.length ? (
        <View>
          <TituloSecao título="PERFIS SALVOS" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.listaPerfis}>
            {perfis.map((perfil) => <Pressable key={String(perfil.id)} onPress={() => usarPerfil(perfil)} style={estilos.perfil}><Ionicons name="bookmark-outline" size={16} color={cores.primario} /><Text style={estilos.nomePerfil} numberOfLines={1}>{perfil.destination}</Text></Pressable>)}
          </ScrollView>
        </View>
      ) : null}

      {somenteEssenciais ? (
        <View style={estilos.avisoConfiguracao}><Ionicons name="star" size={15} color="#A85B11" /><Text style={estilos.textoConfiguracao}>Sua configuração está incluindo apenas os objetos essenciais.</Text></View>
      ) : null}

      {erro ? <Aviso ícone="alert-circle-outline" tom="alerta" texto={erro} /> : null}

      {lista.length ? (
        <View style={estilos.cartaoLista}>
          <View style={estilos.cabecalhoLista}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.tituloLista}>{destino.trim() ? 'Lista para ' + destino.trim() : 'Sua lista de saída'}</Text>
              <Text style={estilos.resumoLista}>{conferidos} de {lista.length} itens conferidos</Text>
            </View>
            <Text style={estilos.porcentagem}>{progresso}%</Text>
          </View>
          <View style={estilos.trilho}><View style={[estilos.progresso, { width: `${progresso}%` as `${number}%` }]} /></View>

          {lista.map((item) => (
            <Pressable key={String(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: item.conferido }} onPress={() => alternarConferido(item.id)} style={estilos.itemLista}>
              <View style={[estilos.caixaMarcacao, item.conferido && estilos.caixaMarcada]}>{item.conferido ? <Ionicons name="checkmark" size={16} color={cores.branco} /> : null}</View>
              <ImagemObjeto nome={item.name} categoria={item.category} tamanho={19} compacto />
              <View style={{ flex: 1 }}><Text style={[estilos.nomeItem, item.conferido && estilos.nomeConferido]}>{item.name}</Text><Text style={estilos.categoriaItem}>{item.sugestao ? 'Sugestão para o destino' : item.category || 'Objeto'}</Text></View>
              {item.essential ? <Ionicons name="star" size={15} color="#C77A19" /> : null}
            </Pressable>
          ))}

          {sugestoes.length ? <Text style={estilos.legendaSugestoes}>Incluímos sugestões relacionadas ao destino. Você pode marcá-las conforme for pegando cada item.</Text> : null}
          <Botao título={conferindoSaida ? 'Conferindo...' : resultadoSaida ? 'Conferência concluída' : 'Conferir saída agora'} ícone="walk-outline" aoPressionar={conferirSaida} carregando={conferindoSaida} desativado={Boolean(resultadoSaida)} estilo={estilos.botaoSalvar} />
          {resultadoSaida ? (
            <View accessibilityRole="summary" style={estilos.resultadoSaida}>
              <View style={estilos.cabecalhoResultado}><Ionicons name="checkmark-circle" size={21} color={cores.verde} /><Text style={estilos.tituloResultado}>Conferência registrada</Text></View>
              <Text style={estilos.textoResultado}>{resultadoSaida.message}</Text>
              {resultadoSaida.checked?.length ? <Text style={estilos.textoResultado}>Marcados por você como conferidos: {resultadoSaida.checked.join(', ')}. Essa confirmação é manual.</Text> : null}
              {resultadoSaida.detected?.length ? <Text style={estilos.textoResultado}>Bluetooth detectou: {resultadoSaida.detected.join(', ')}.</Text> : null}
              {resultadoSaida.missing?.length ? <Text style={estilos.textoAlertaResultado}>Sem sinal do chaveiro: {resultadoSaida.missing.join(', ')}. Confira esses itens manualmente; o sinal sozinho não confirma que foram esquecidos.</Text> : null}
              {resultadoSaida.withoutKeychain?.length ? <Text style={estilos.textoResultado}>Para acompanhar objetos por Bluetooth, associe um chaveiro compatível.</Text> : null}
              {resultadoSaida.expected?.length ? <Text style={estilos.textoResultado}>Sugestões para esse destino: {resultadoSaida.expected.join(', ')}.</Text> : null}
            </View>
          ) : null}
          <Botao título={salvando ? 'Salvando...' : 'Salvar como perfil'} ícone="bookmark-outline" aoPressionar={salvarPerfil} carregando={salvando} secundário estilo={estilos.botaoSalvar} />
        </View>
      ) : objetos.length === 0 ? (
        <EstadoVazio ícone="cube-outline" título="Adicione seus objetos primeiro" texto="Depois você poderá montar listas de saída com seus itens cadastrados." />
      ) : (
        <View style={estilos.cartaoOrientacao}>
          <View style={estilos.iconeOrientacao}><Ionicons name="hand-left-outline" size={22} color={cores.primario} /></View>
          <Text style={estilos.tituloOrientacao}>Uma conferência simples e confiável</Text>
          <Text style={estilos.textoOrientacao}>A lista e a conferência manual funcionam sem chaveiro. A detecção de proximidade e os alertas de separação exigem um chaveiro Bluetooth compatível, ligado e associado.</Text>
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
