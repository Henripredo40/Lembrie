import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import MapaOSM from '../componentes/MapaOSM';
import ImagemObjeto from '../componentes/ImagemObjeto';
import { Aviso, Botao, CampoTexto, TituloSecao } from '../componentes/Elementos';
import { cores } from '../tema';
import estilos from '../estilos/TelaMapaRotina.estilos';

export default function TelaMapaRotina({ api, rotinaAtiva, abrirObjetos, notificar, atualizarDados }) {
  const [modoBusca, definirModoBusca] = useState('endereco');
  const [consulta, definirConsulta] = useState('');
  const [cepBusca, definirCepBusca] = useState('');
  const [cepsDoEndereco, definirCepsDoEndereco] = useState([]);
  const [locais, definirLocais] = useState([]);
  const [locaisProximos, definirLocaisProximos] = useState({ categories: [], places: [] });
  const [selecionado, definirSelecionado] = useState(null);
  const [objetosSugeridos, definirObjetosSugeridos] = useState([]);
  const [objetosRecomendadosIA, definirObjetosRecomendadosIA] = useState([]);
  const [motivoSugestaoIA, definirMotivoSugestaoIA] = useState('');
  const [gerandoSugestoesIA, definirGerandoSugestoesIA] = useState(false);
  const [buscandoProximidade, definirBuscandoProximidade] = useState(false);
  const [respostaIAAtiva, definirRespostaIAAtiva] = useState(null);
  const [objetosCadastrados, definirObjetosCadastrados] = useState([]);
  const [objetosSelecionados, definirObjetosSelecionados] = useState([]);
  const [conferindoSaida, definirConferindoSaida] = useState(false);
  const [resultadoConferencia, definirResultadoConferencia] = useState(null);
  const [planos, definirPlanos] = useState([]);
  const [buscando, definirBuscando] = useState(false);
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState('');
  const buscaPontoAtual = useRef(0);
  const destinosFrequentes = useMemo(() => {
    const resumo = new Map();
    planos.forEach(plano => resumo.set(plano.destination, (resumo.get(plano.destination) || 0) + 1));
    return [...resumo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [planos]);

  useEffect(() => {
    if (rotinaAtiva) api('/routine/plans').then(dados => definirPlanos(Array.isArray(dados) ? dados : [])).catch(() => {});
    else definirPlanos([]);
  }, [rotinaAtiva]);

  async function buscarLocal() {
    buscaPontoAtual.current += 1;
    if (consulta.trim().length < 3) return definirErro('Digite pelo menos 3 caracteres para buscar um local.');
    definirErro('');
    definirLocais([]);
    definirBuscando(true);
    try {
      const dados = await api('/places/search?q=' + encodeURIComponent(consulta.trim()));
      definirLocais(Array.isArray(dados) ? dados : []);
      if (!dados.length) definirErro('Não encontrei esse local. Tente informar uma cidade ou um endereço próximo.');
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível buscar o local agora.');
    } finally {
      definirBuscando(false);
    }
  }

  async function buscarPorCep() {
    buscaPontoAtual.current += 1;
    const cep = cepBusca.replace(/\D/g, '');
    if (cep.length !== 8) return definirErro('Digite os 8 números do CEP.');
    definirErro('');
    definirLocais([]);
    definirBuscando(true);
    try {
      const dados = await api('/postal-codes/lookup?cep=' + cep);
      const endereço = [dados.logradouro, dados.bairro, dados.cidade, dados.uf, 'Brasil'].filter(Boolean).join(', ');
      if (!endereço) throw new Error('O CEP foi encontrado, mas não retornou um endereço para pesquisar.');
      let encontrados = await api('/places/search?q=' + encodeURIComponent(endereço));
      let aproximado = true;
      if (!Array.isArray(encontrados) || !encontrados.length) {
        try {
          encontrados = await api('/places/postal-code?cep=' + cep);
        } catch (falha) {
          encontrados = [];
        }
      }
      if (!Array.isArray(encontrados) || !encontrados.length) {
        encontrados = await api('/places/search?q=' + encodeURIComponent([dados.cidade, dados.uf, 'Brasil'].filter(Boolean).join(', ')));
        aproximado = Array.isArray(encontrados) && encontrados.length > 0;
      }
      const resultados = Array.isArray(encontrados)
        ? encontrados.map(local => ({ ...local, cep: dados.cep, bairro: local.bairro || dados.bairro, logradouro: local.logradouro || dados.logradouro, cidade: local.cidade || dados.cidade, uf: local.uf || dados.uf, aproximado }))
        : [];
      definirLocais(resultados);
      if (!resultados.length) definirErro(`Encontrei o CEP ${dados.cep}, mas não consegui posicionar esse endereço no mapa. Pesquise o logradouro pelo nome e número.`);
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível consultar esse CEP.');
    } finally {
      definirBuscando(false);
    }
  }

  async function escolherLocal(local) {
    const idBusca = ++buscaPontoAtual.current;
    definirSelecionado(local);
    definirObjetosRecomendadosIA([]);
    definirMotivoSugestaoIA('');
    definirRespostaIAAtiva(null);
    definirLocaisProximos({ categories: [], places: [] });
    definirObjetosSugeridos([]);
    definirObjetosCadastrados([]);
    definirObjetosSelecionados([]);
    definirGerandoSugestoesIA(false);
    definirLocais([]);
    definirCepsDoEndereco(local.cep ? [{ cep: local.cep, bairro: local.bairro || '' }] : []);
    definirErro('');
    const próximosPromise = carregarLocaisProximos(local.latitude, local.longitude, idBusca);
    if (local.uf && local.cidade && local.logradouro) {
      try {
        const ceps = await api(`/postal-codes/search?uf=${encodeURIComponent(local.uf)}&city=${encodeURIComponent(local.cidade)}&street=${encodeURIComponent(local.logradouro)}`);
        if (Array.isArray(ceps) && ceps.length) {
          const códigos = ceps.filter(item => item.cep);
          definirCepsDoEndereco(códigos);
          definirSelecionado(atual => ({ ...atual, cep: atual?.cep || códigos[0]?.cep, bairro: atual?.bairro || códigos[0]?.bairro }));
        }
      } catch (falha) {
        // CEP pode não estar cadastrado para todo endereço encontrado no mapa.
      }
    }
    if (idBusca !== buscaPontoAtual.current) return;
    const próximos = await próximosPromise;
    if (idBusca !== buscaPontoAtual.current) return;
    const destino = [local.nome, local.endereço].filter(Boolean).join(', ').slice(0, 180);
    const dados = await carregarItensDoDestino(destino, idBusca, próximos.categories);
    if (idBusca === buscaPontoAtual.current) await sugerirItensComIA(destino, próximos, dados?.allRegisteredItems || [], idBusca);
  }

  async function carregarLocaisProximos(latitude, longitude, idBusca?) {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return { categories: [], places: [] };
    definirBuscandoProximidade(true);
    try {
      const dados = await api(`/places/nearby?lat=${latitude}&lon=${longitude}`);
      const resultado = { categories: Array.isArray(dados.categories) ? dados.categories : [], places: Array.isArray(dados.places) ? dados.places : [] };
      if (idBusca === undefined || idBusca === buscaPontoAtual.current) definirLocaisProximos(resultado);
      return resultado;
    } catch {
      const vazio = { categories: [], places: [] };
      if (idBusca === undefined || idBusca === buscaPontoAtual.current) definirLocaisProximos(vazio);
      return vazio;
    } finally {
      if (idBusca === undefined || idBusca === buscaPontoAtual.current) definirBuscandoProximidade(false);
    }
  }

  async function carregarItensDoDestino(nomeDestino, idBusca?, categoriasProximas = []) {
    definirResultadoConferencia(null);
    try {
      const dados = await api('/recommendations?destination=' + encodeURIComponent(nomeDestino) + '&nearby=' + encodeURIComponent(categoriasProximas.join(',')));
      if (idBusca !== undefined && idBusca !== buscaPontoAtual.current) return;
      const todos = Array.isArray(dados.allRegisteredItems) ? dados.allRegisteredItems : [];
      const relacionados = Array.isArray(dados.registeredItems) ? dados.registeredItems : [];
      definirObjetosSugeridos(relacionados);
      definirObjetosCadastrados(todos);
      definirObjetosSelecionados(relacionados.map(item => String(item.id)));
      return { allRegisteredItems: todos, registeredItems: relacionados };
    } catch (falha) {
      if (idBusca !== undefined && idBusca !== buscaPontoAtual.current) return;
      definirObjetosSugeridos([]);
      definirObjetosCadastrados([]);
      definirObjetosSelecionados([]);
      definirErro('O local foi selecionado, mas não consegui carregar seus objetos. Tente novamente.');
      return null;
    }
  }

  async function sugerirItensComIA(destinoInformado?, contextoProximo = locaisProximos, objetosDisponiveis = objetosCadastrados, idBusca?) {
    const destino = String(destinoInformado || [selecionado?.nome, selecionado?.endereço].filter(Boolean).join(', ')).slice(0, 180);
    if (destino.length < 2) return;
    definirGerandoSugestoesIA(true);
    definirErro('');
    try {
      const dados = await api('/recommendations/ai', { method: 'POST', body: JSON.stringify({ destination: destino, nearbyCategories: contextoProximo.categories, nearbyPlaces: contextoProximo.places }) });
      if (idBusca !== undefined && idBusca !== buscaPontoAtual.current) return;
      const itensRecomendados = Array.isArray(dados.registeredItems) ? dados.registeredItems : [];
      definirObjetosRecomendadosIA(itensRecomendados);
      definirMotivoSugestaoIA(String(dados.reason || ''));
      const ids = objetosDisponiveis.filter(item => itensRecomendados.some(nome => nome.toLocaleLowerCase('pt-BR') === String(item.name).toLocaleLowerCase('pt-BR'))).map(item => String(item.id));
      definirObjetosSelecionados(atuais => [...new Set([...atuais, ...ids])]);
      definirRespostaIAAtiva(dados.ai === true);
    } catch (falha) {
      if (idBusca !== undefined && idBusca !== buscaPontoAtual.current) return;
      definirErro(falha.message || 'Não consegui gerar sugestões agora. Tente novamente.');
    } finally {
      if (idBusca === undefined || idBusca === buscaPontoAtual.current) definirGerandoSugestoesIA(false);
    }
  }

  function alternarObjetoSelecionado(id) {
    definirResultadoConferencia(null);
    definirObjetosSelecionados(atuais => atuais.includes(String(id))
      ? atuais.filter(itemId => itemId !== String(id))
      : [...atuais, String(id)]);
  }

  async function conferirSaidaNoMapa() {
    if (!selecionado) return;
    if (!objetosSelecionados.length) {
      definirErro('Marque pelo menos um objeto que você pretende levar.');
      return;
    }
    definirErro('');
    definirResultadoConferencia(null);
    definirConferindoSaida(true);
    try {
      const resultado = await api('/departure/check', {
        method: 'POST',
        body: JSON.stringify({
          destination: selecionado.nome === 'Minha localização' ? '' : selecionado.nome,
          planned_ids: objetosSelecionados.map(Number).filter(Number.isSafeInteger),
        }),
      });
      definirResultadoConferencia(resultado);
      await atualizarDados?.();
    } catch (falha) {
      definirErro(falha.message || 'Não consegui conferir a saída agora. Verifique a conexão e tente novamente.');
    } finally {
      definirConferindoSaida(false);
    }
  }

  async function localizarAgora() {
    const idBusca = ++buscaPontoAtual.current;
    definirErro('');
    try {
      const permissão = await Location.requestForegroundPermissionsAsync();
      if (permissão.status !== 'granted') return definirErro('Permita o acesso à localização durante o uso para mostrar sua posição no mapa.');
      const posição = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (idBusca !== buscaPontoAtual.current) return;
      const local = { nome: 'Minha localização', endereço: 'Localização atual do aparelho', latitude: posição.coords.latitude, longitude: posição.coords.longitude };
      definirSelecionado(local);
      definirObjetosRecomendadosIA([]);
      definirMotivoSugestaoIA('');
      definirRespostaIAAtiva(null);
      definirCepsDoEndereco([]);
      definirObjetosSugeridos([]);
      definirObjetosCadastrados([]);
      definirObjetosSelecionados([]);
      definirGerandoSugestoesIA(false);
      const próximos = await carregarLocaisProximos(local.latitude, local.longitude, idBusca);
      if (idBusca !== buscaPontoAtual.current) return;
      const dados = await carregarItensDoDestino(local.nome, idBusca, próximos.categories);
      if (idBusca === buscaPontoAtual.current) await sugerirItensComIA(local.nome, próximos, dados?.allRegisteredItems || [], idBusca);
    } catch (falha) {
      if (idBusca === buscaPontoAtual.current) definirErro('Não consegui obter sua localização. Verifique o GPS e tente novamente.');
    }
  }

  async function salvarNaRotina() {
    if (!rotinaAtiva) return definirErro('Ative o reconhecimento opcional de rotina nas configurações primeiro.');
    if (!selecionado || selecionado.nome === 'Minha localização') return definirErro('Busque e selecione um destino antes de salvar na rotina.');
    definirSalvando(true);
    definirErro('');
    try {
      await api('/routine/plans', { method: 'POST', body: JSON.stringify({ destination: selecionado.nome }) });
      const dados = await api('/routine/plans');
      definirPlanos(Array.isArray(dados) ? dados : []);
      notificar('Destino salvo. Você pode removê-lo desativando o reconhecimento de rotina nas configurações.');
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível salvar este destino.');
    } finally {
      definirSalvando(false);
    }
  }

  async function repetirDestino(nome) {
    definirConsulta(nome);
    definirErro('');
    definirBuscando(true);
    try {
      const dados = await api('/places/search?q=' + encodeURIComponent(nome));
      definirLocais(Array.isArray(dados) ? dados : []);
      if (!dados.length) definirErro('Não encontrei esse local. Busque uma cidade ou um endereço próximo.');
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível buscar o destino salvo.');
    } finally {
      definirBuscando(false);
    }
  }

  async function escolherPontoNoMapa(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      definirErro('Não consegui ler o ponto marcado. Toque novamente em uma área visível do mapa.');
      return;
    }
    const idBusca = ++buscaPontoAtual.current;
    const ponto = {
      id: `coord:${latitude.toFixed(5)},${longitude.toFixed(5)}`,
      nome: 'Localizando endereço…',
      endereço: 'Mantendo o ponto escolhido no centro do mapa.',
      latitude,
      longitude,
    };
    definirSelecionado(ponto);
    definirObjetosRecomendadosIA([]);
    definirMotivoSugestaoIA('');
    definirRespostaIAAtiva(null);
    definirLocaisProximos({ categories: [], places: [] });
    definirCepsDoEndereco([]);
    definirObjetosCadastrados([]);
    definirObjetosSelecionados([]);
    definirGerandoSugestoesIA(false);
    definirLocais([]);
    definirObjetosSugeridos([]);
    definirErro('');
    try {
      const local = await api(`/places/reverse?lat=${latitude}&lon=${longitude}`);
      if (idBusca !== buscaPontoAtual.current) return;
      // Preserve the exact coordinate selected by the user; reverse geocoding
      // is only used to supply a readable address and destination label.
      const localSelecionado = { ...local, latitude, longitude };
      definirSelecionado(localSelecionado);
      definirCepsDoEndereco(local.cep ? [{ cep: local.cep, bairro: local.bairro || '' }] : []);
      const próximosPromise = carregarLocaisProximos(latitude, longitude, idBusca);
      const destino = [localSelecionado.nome, localSelecionado.endereço].filter(Boolean).join(', ').slice(0, 180);
      const próximos = await próximosPromise;
      if (idBusca !== buscaPontoAtual.current) return;
      const dados = await carregarItensDoDestino(destino, idBusca, próximos.categories);
      if (idBusca === buscaPontoAtual.current) await sugerirItensComIA(destino, próximos, dados?.allRegisteredItems || [], idBusca);
    } catch (falha) {
      if (idBusca !== buscaPontoAtual.current) return;
      const localAproximado = { ...ponto, nome: 'Ponto próximo ao local marcado', endereço: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, pontoAproximado: true };
      definirSelecionado(localAproximado);
      definirErro('');
      const próximos = await carregarLocaisProximos(latitude, longitude, idBusca);
      if (idBusca !== buscaPontoAtual.current) return;
      const dados = await carregarItensDoDestino(localAproximado.nome, idBusca, próximos.categories);
      if (idBusca === buscaPontoAtual.current) await sugerirItensComIA(localAproximado.nome, próximos, dados?.allRegisteredItems || [], idBusca);
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={estilos.sobretitulo}>PLANEJAMENTO</Text>
      <Text style={estilos.titulo}>Mapa e rotina</Text>
      <Text style={estilos.subtitulo}>Pesquise pelo endereço completo com número ou use o CEP como referência. Role a tela na vertical; deslize o mapa para os lados ou toque nele para ajustar o pino.</Text>
      <View style={estilos.modosBusca}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: modoBusca === 'endereco' }} onPress={() => { definirModoBusca('endereco'); definirLocais([]); definirErro(''); }} style={[estilos.modoBusca, modoBusca === 'endereco' && estilos.modoBuscaAtivo]}><Text style={[estilos.textoModoBusca, modoBusca === 'endereco' && estilos.textoModoBuscaAtivo]}>Endereço ou lugar</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: modoBusca === 'cep' }} onPress={() => { definirModoBusca('cep'); definirLocais([]); definirErro(''); }} style={[estilos.modoBusca, modoBusca === 'cep' && estilos.modoBuscaAtivo]}><Text style={[estilos.textoModoBusca, modoBusca === 'cep' && estilos.textoModoBuscaAtivo]}>Buscar por CEP</Text></Pressable>
      </View>
      <View style={estilos.busca}>
        {modoBusca === 'cep'
          ? <View style={estilos.campoBusca}><CampoTexto rótulo="CEP" value={cepBusca} onChangeText={valor => definirCepBusca(valor.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'))} placeholder="Ex.: 01001-000" keyboardType="number-pad" returnKeyType="search" onSubmitEditing={buscarPorCep} maxLength={9} /></View>
          : <View style={estilos.campoBusca}><CampoTexto rótulo="NOME DO LUGAR OU ENDEREÇO" value={consulta} onChangeText={definirConsulta} placeholder="Ex.: SQN 308, Brasília, DF" returnKeyType="search" onSubmitEditing={buscarLocal} maxLength={120} /></View>}
        <Pressable accessibilityRole="button" accessibilityLabel={modoBusca === 'cep' ? 'Buscar CEP' : 'Buscar lugar ou endereço'} onPress={modoBusca === 'cep' ? buscarPorCep : buscarLocal} disabled={buscando} style={estilos.botaoBusca}>{buscando ? <ActivityIndicator size="small" color={cores.branco} /> : <Ionicons name="search" size={19} color={cores.branco} />}</Pressable>
      </View>
      {buscando ? <View style={estilos.resultados}><ActivityIndicator size="small" color={cores.primario} /><Text style={estilos.endereçoResultado}>Buscando lugares e endereços…</Text></View> : null}
      {locais.length ? <View style={estilos.resultados}>
        <TituloSecao título="ESCOLHA UM RESULTADO" />
        {locais.map((local, índice) => <Pressable key={local.id} accessibilityRole="button" onPress={() => escolherLocal(local)} style={estilos.resultado}><Ionicons name="location-outline" size={18} color={cores.primario} /><View style={estilos.colunaResultado}><Text style={estilos.nomeResultado}>{local.nome}{local.aproximado ? ' · referência aproximada' : ''}</Text><Text style={estilos.endereçoResultado} numberOfLines={2}>{local.endereço}{local.cep ? ` · CEP ${local.cep}` : ''}</Text><Text style={estilos.textoCep}>{índice === 0 ? 'Melhor correspondência para a busca' : 'Sugestão de local'}</Text></View></Pressable>)}
      </View> : null}
      <Pressable accessibilityRole="button" onPress={localizarAgora} style={estilos.botaoLocalização}><Ionicons name="locate-outline" size={17} color={cores.primario} /><Text style={estilos.textoLocalização}>Mostrar minha localização agora</Text></Pressable>
      {erro ? <Aviso ícone="alert-circle-outline" tom="alerta" texto={erro} /> : null}
      <MapaOSM
        latitude={selecionado?.latitude ?? -15.7939}
        longitude={selecionado?.longitude ?? -47.8828}
        onChoose={escolherPontoNoMapa}
      />
      <Text style={estilos.atribuição}>Mapa © OpenStreetMap contributors</Text>
      {selecionado ? <>
        <View style={estilos.localSelecionado}><Ionicons name="location" size={18} color={cores.primario} /><View style={estilos.colunaResultado}><Text style={estilos.nomeResultado}>{selecionado.nome}</Text><Text style={estilos.endereçoResultado} numberOfLines={2}>{selecionado.endereço}</Text>{selecionado.pontoAproximado ? <Text style={estilos.endereçoResultado}>Endereço exato indisponível; a recomendação usa os locais mapeados mais próximos.</Text> : selecionado.aproximado ? <Text style={estilos.endereçoResultado}>O CEP indica uma referência da rua/região. Para chegar ao número certo, toque no ponto desejado do mapa.</Text> : null}{selecionado.cep ? <Text style={estilos.textoCep}>CEP {selecionado.cep}</Text> : null}</View></View>
        {locaisProximos.categories.length ? <View style={estilos.contextoProximo}><Text style={estilos.tituloContextoProximo}>O que existe por perto</Text><Text style={estilos.textoContextoProximo}>{locaisProximos.categories.join(' · ')}</Text>{locaisProximos.places.length ? <Text style={estilos.textoContextoProximo}>{locaisProximos.places.map(local => local.distancia != null ? `${local.nome} (${local.distancia} m)` : local.nome).join(' · ')}</Text> : null}</View> : null}
        {cepsDoEndereco.length > 1 ? <View style={estilos.cepsEncontrados}><Text style={estilos.endereçoResultado}>Mais de um CEP encontrado para este logradouro. Confira o bairro para escolher:</Text>{cepsDoEndereco.map(opção => <Pressable key={opção.cep} onPress={() => definirSelecionado(atual => ({ ...atual, cep: opção.cep, bairro: opção.bairro }))} style={[estilos.opcaoCep, selecionado.cep === opção.cep && estilos.opcaoCepAtiva]}><Text style={[estilos.textoOpcaoCep, selecionado.cep === opção.cep && estilos.textoOpcaoCepAtivo]}>{opção.cep}{opção.bairro ? ` · ${opção.bairro}` : ''}</Text></Pressable>)}</View> : null}
        <View style={estilos.cartaoSugestões}>
          {objetosCadastrados.length ? <>
            <View style={estilos.cabecalhoObjetos}><TituloSecao título="O QUE VOCÊ VAI LEVAR?" /><Pressable accessibilityRole="button" onPress={() => { definirResultadoConferencia(null); definirObjetosSelecionados(objetosSelecionados.length === objetosCadastrados.length ? [] : objetosCadastrados.map(item => String(item.id))); }}><Text style={estilos.acaoSelecao}>{objetosSelecionados.length === objetosCadastrados.length ? 'Limpar' : 'Selecionar todos'}</Text></Pressable></View>
            <Text style={estilos.notaSugestões}>As sugestões consideram seus itens essenciais, o destino e os locais próximos encontrados no mapa. Revise e marque o que pretende levar.</Text>
            <View style={estilos.listaObjetos}>{objetosCadastrados.map(item => {
              const recomendado = objetosSugeridos.some(objeto => String(objeto.id) === String(item.id)) || objetosRecomendadosIA.some(nome => nome.toLocaleLowerCase('pt-BR') === String(item.name).toLocaleLowerCase('pt-BR'));
              const marcado = objetosSelecionados.includes(String(item.id));
              return <Pressable key={String(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }} onPress={() => alternarObjetoSelecionado(item.id)} style={[estilos.linhaObjeto, marcado && estilos.linhaObjetoSelecionado]}><View style={[estilos.marcadorObjeto, marcado && estilos.marcadorObjetoAtivo]}>{marcado ? <Ionicons name="checkmark" size={15} color={cores.branco} /> : null}</View><ImagemObjeto nome={item.name} categoria={item.category} imagemUri={item.image_data} tamanho={22} compacto /><View style={{ flex: 1 }}><Text style={estilos.textoSugestão}>{item.name}</Text><Text style={estilos.endereçoResultado}>{recomendado ? 'Recomendado para este destino' : item.category || 'Objeto'}</Text></View>{item.essential ? <Ionicons name="star" size={16} color="#C77A19" /> : null}</Pressable>;
            })}</View>
          </> : <>
            <TituloSecao título="SEUS OBJETOS PARA LEVAR" />
            <Text style={estilos.notaSugestões}>Cadastre seus objetos para receber sugestões personalizadas e montar sua lista de saída.</Text>
            <Botao título="Cadastrar objetos" secundário aoPressionar={abrirObjetos} />
          </>}
          <Pressable accessibilityRole="button" onPress={() => sugerirItensComIA()} disabled={gerandoSugestoesIA || buscandoProximidade} style={estilos.botaoLocalização}>
            {gerandoSugestoesIA || buscandoProximidade ? <ActivityIndicator size="small" color={cores.primario} /> : <Ionicons name="sparkles-outline" size={17} color={cores.primario} />}
            <Text style={estilos.textoLocalização}>{buscandoProximidade ? 'Identificando locais próximos…' : gerandoSugestoesIA ? 'Analisando seus objetos…' : 'Recomendar itens com Gemini'}</Text>
          </Pressable>
          {objetosRecomendadosIA.length || motivoSugestaoIA ? <View style={estilos.listaSugestões}>
            <Text style={estilos.notaSugestões}>{objetosRecomendadosIA.length ? (respostaIAAtiva ? 'A IA Gemini recomenda estes itens da sua lista para o destino e os pontos próximos:' : 'Itens cadastrados relacionados ao destino:') + ' ' + objetosRecomendadosIA.join(', ') + '.' : 'Não encontrei objetos cadastrados específicos para este destino.'}{motivoSugestaoIA ? ` ${motivoSugestaoIA}` : ''}</Text>
            {objetosRecomendadosIA.length ? <Pressable accessibilityRole="button" onPress={() => {
              const ids = objetosCadastrados.filter(item => objetosRecomendadosIA.some(nome => nome.toLocaleLowerCase('pt-BR') === String(item.name).toLocaleLowerCase('pt-BR'))).map(item => String(item.id));
              definirObjetosSelecionados(atuais => [...new Set([...atuais, ...ids])]);
              definirResultadoConferencia(null);
            }} style={estilos.botaoLocalização}><Ionicons name="checkmark-circle-outline" size={17} color={cores.primario} /><Text style={estilos.textoLocalização}>Adicionar à lista de saída</Text></Pressable> : null}
          </View> : null}
          {objetosCadastrados.length ? <>
            <Text style={estilos.resumoSelecao}>{objetosSelecionados.length} de {objetosCadastrados.length} {objetosSelecionados.length === 1 ? 'objeto selecionado' : 'objetos selecionados'}</Text>
            <Botao título={conferindoSaida ? 'Conferindo...' : 'Conferir e registrar saída'} ícone="walk-outline" aoPressionar={conferirSaidaNoMapa} carregando={conferindoSaida} desativado={Boolean(resultadoConferencia)} />
            {resultadoConferencia ? <View accessibilityRole="summary" style={estilos.resultadoConferencia}><View style={estilos.cabecalhoResultado}><Ionicons name="checkmark-circle" size={20} color={cores.verde} /><Text style={estilos.tituloResultado}>Plano de saída registrado</Text></View><Text style={estilos.textoResultado}>{resultadoConferencia.message}</Text>{resultadoConferencia.planned?.length ? <Text style={estilos.textoResultado}>Você planeja levar: {resultadoConferencia.planned.join(', ')}.</Text> : null}{resultadoConferencia.detected?.length ? <Text style={estilos.textoResultado}>Detectados pelo Bluetooth: {resultadoConferencia.detected.join(', ')}.</Text> : null}{resultadoConferencia.missing?.length ? <Text style={estilos.textoAlertaResultado}>Sem sinal do chaveiro: {resultadoConferencia.missing.join(', ')}. Confira esses itens manualmente.</Text> : null}{resultadoConferencia.expected?.length ? <Text style={estilos.textoResultado}>Lembretes para o destino: {resultadoConferencia.expected.join(', ')}.</Text> : null}</View> : null}
          </> : null}
        </View>
        {selecionado.nome !== 'Minha localização' ? <Botao título={salvando ? 'Salvando destino...' : 'Salvar destino na minha rotina'} ícone="calendar-outline" secundário carregando={salvando} aoPressionar={salvarNaRotina} /> : null}
      </> : null}
      <View style={estilos.rotina}>
        <View style={estilos.cabecalhoRotina}><Ionicons name="calendar-outline" size={18} color={cores.primario} /><Text style={estilos.tituloRotina}>Padrões da sua rotina</Text></View>
        <Text style={estilos.textoRotina}>{rotinaAtiva ? 'Aprendo somente com destinos que você escolhe salvar. Não acompanho deslocamentos em segundo plano.' : 'O reconhecimento está desligado. Ative-o em Configurações para salvar destinos planejados.'}</Text>
        {destinosFrequentes.length ? destinosFrequentes.map(([nome, vezes]) => <Pressable key={nome} accessibilityRole="button" onPress={() => repetirDestino(nome)} style={estilos.destinoFrequente}><Text style={estilos.nomeFrequente}>{nome}</Text><Text style={estilos.vezesFrequente}>{vezes} {vezes === 1 ? 'plano' : 'planos'} · usar</Text></Pressable>) : <Text style={estilos.semRotina}>Seus destinos mais usados aparecerão aqui depois que você os salvar.</Text>}
      </View>
      <Text style={estilos.privacidade}>A busca de endereços e pontos próximos usa dados do OpenStreetMap. As coordenadas não são salvas na sua conta nem acompanhadas em segundo plano. Ao pedir uma análise com IA, o destino, os locais próximos e seus objetos cadastrados são enviados ao Gemini para gerar a recomendação. © colaboradores do OpenStreetMap.</Text>
      <View style={estilos.espacador} />
    </ScrollView>
  );
}
