import estilos from '../estilos/TelaSaida.estilos';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import ImagemObjeto from '../componentes/ImagemObjeto';
import MapaLibre from '../componentes/MapaLibre';
import { Aviso, Botao, EstadoVazio, TituloSecao } from '../componentes/Elementos';
import { cores } from '../tema';
import { alternarItemConferido, criarDadosConferencia, criarListaSaida, criarResumoSaida, lerChecklistPerfil } from '../utilitarios/listaDeSaida';
import { lerResumoSaidaBluetooth, salvarResumoSaidaBluetooth } from '../utilitarios/resumoSaidaBluetooth';
import { atualizarItensDoPerimetro, iniciarPerimetroEmSegundoPlano, pararPerimetroEmSegundoPlano, perimetroEmSegundoPlanoAtivo } from '../utilitarios/perimetroSegundoPlano';

const CHAVE_PERIMETRO = '@lembre/perimetro';

export default function TelaSaida({ objetos, api, notificar, atualizarDados, somenteEssenciais, destinoInicial = '', abrirObjetos = () => {}, salvarResumo = salvarResumoSaidaBluetooth }) {
  const [destino, definirDestino] = useState('');
  const [lista, definirLista] = useState([]);
  const [sugestoes, definirSugestoes] = useState([]);
  const [perfis, definirPerfis] = useState([]);
  const [carregando, definirCarregando] = useState(false);
  const [salvando, definirSalvando] = useState(false);
  const [conferindoSaida, definirConferindoSaida] = useState(false);
  const [resultadoSaida, definirResultadoSaida] = useState(null);
  const [erro, definirErro] = useState('');
  const [centroPerimetro, definirCentroPerimetro] = useState(null);
  const [nomeLocal, definirNomeLocal] = useState('Casa');
  const [raioPerimetro, definirRaioPerimetro] = useState(200);
  const [localSalvo, definirLocalSalvo] = useState(false);
  const [monitorandoPerimetro, definirMonitorandoPerimetro] = useState(false);
  const [estadoPerimetro, definirEstadoPerimetro] = useState('');
  const listaAtual = useRef(lista);

  useEffect(() => { listaAtual.current = lista; }, [lista]);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_PERIMETRO).then((conteudo) => {
      if (!conteudo) return;
      const salvo = JSON.parse(conteudo);
      if (Number.isFinite(salvo.latitude) && Number.isFinite(salvo.longitude)) {
        definirCentroPerimetro({ latitude: salvo.latitude, longitude: salvo.longitude });
        definirNomeLocal(salvo.nome || 'Casa');
        definirRaioPerimetro(Number(salvo.raio) || 200);
        definirLocalSalvo(true);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    perimetroEmSegundoPlanoAtivo().then(definirMonitorandoPerimetro).catch(() => {});
  }, []);

  useEffect(() => {
    api('/exit-profiles')
      .then((dados) => definirPerfis(Array.isArray(dados) ? dados : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    definirDestino(destinoInicial);
  }, [destinoInicial]);

  const conferidos = useMemo(() => lista.filter((item) => item.conferido).length, [lista]);
  const itensNaPlaca = useMemo(() => lista.filter((item) => item.mostrarNaPlaca === true).length, [lista]);
  const progresso = lista.length ? Math.round(conferidos * 100 / lista.length) : 0;
  useEffect(() => {
    if (lista.length) salvarResumo(criarResumoSaida(destino, lista)).catch(() => {});
  }, [destino, lista]);

  useEffect(() => {
    if (monitorandoPerimetro && lista.length) {
      atualizarItensDoPerimetro(lista.filter((item) => item.mostrarNaPlaca === true && !item.conferido).map((item) => item.name)).catch(() => {});
    }
  }, [lista, monitorandoPerimetro]);

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
      const resultado = criarListaSaida(objetos, itensSugeridos, somenteEssenciais);
      const resumoAnterior = await lerResumoSaidaBluetooth();
      const nomesNaPlaca = new Set(resumoAnterior?.items || []);
      const itensComSelecao = resultado.itens.map((item) => ({
        ...item,
        mostrarNaPlaca: nomesNaPlaca.has(item.name),
      }));
      definirLista(itensComSelecao);
      definirSugestoes(resultado.sugestões);
      if (!resultado.itens.length && somenteEssenciais) {
        definirErro('Ainda não há objetos essenciais. Marque algum objeto como essencial ou desative esse filtro nas configurações.');
      }
      if (resultado.itens.length) {
        const destinoRegistrado = destino.trim() || 'sem destino informado';
        api('/events', {
          method: 'POST',
          body: JSON.stringify({
            type: 'lista_saida',
            message: 'Lista de saída para ' + destinoRegistrado + ' montada com ' + resultado.itens.length + ' itens.',
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
    definirLista((atuais) => alternarItemConferido(atuais, id));
    definirResultadoSaida(null);
  }

  function alternarNaPlaca(id) {
    definirLista((atuais) => atuais.map((item) => item.id === id
      ? { ...item, mostrarNaPlaca: item.mostrarNaPlaca !== true }
      : item));
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
          ...criarDadosConferencia(destino, lista),
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
          checklist: lista.map(({ id, name, category, essential, sugestao, mostrarNaPlaca }) => ({ id, name, category, essential, sugestao, mostrarNaPlaca })),
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
    const itensFiltrados = lerChecklistPerfil(perfil, somenteEssenciais);
    definirLista(itensFiltrados);
    definirSugestoes([]);
    definirErro(somenteEssenciais && itensFiltrados.length === 0
      ? 'Este perfil não tem objetos essenciais. Desative o filtro ou monte uma lista nova.'
      : '');
  }

  async function marcarLocalAtual() {
    definirErro('');
    try {
      const permissão = await Location.requestForegroundPermissionsAsync();
      if (permissão.status !== 'granted') throw new Error('Permita a localização para cadastrar o local do perímetro.');
      const posição = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      definirCentroPerimetro({ latitude: posição.coords.latitude, longitude: posição.coords.longitude });
      definirLocalSalvo(false);
      definirEstadoPerimetro('Pino colocado na sua localização atual. Ajuste no mapa e salve o local.');
    } catch (falha) {
      definirErro(falha.message || 'Não consegui obter sua localização. Ative o GPS e tente novamente.');
    }
  }

  async function salvarLocalPerimetro() {
    if (!centroPerimetro) {
      definirErro('Marque o local no mapa ou use sua localização atual.');
      return;
    }
    const registro = {
      nome: nomeLocal.trim() || 'Local seguro',
      latitude: centroPerimetro.latitude,
      longitude: centroPerimetro.longitude,
      raio: raioPerimetro,
    };
    await AsyncStorage.setItem(CHAVE_PERIMETRO, JSON.stringify(registro));
    definirNomeLocal(registro.nome);
    definirLocalSalvo(true);
    definirEstadoPerimetro(`Local “${registro.nome}” salvo com perímetro de ${raioPerimetro} m.`);
  }

  async function alternarMonitoramentoPerimetro() {
    if (monitorandoPerimetro) {
      await pararPerimetroEmSegundoPlano();
      definirMonitorandoPerimetro(false);
      definirEstadoPerimetro('Aviso de perímetro pausado.');
      return;
    }
    if (!localSalvo || !centroPerimetro) {
      definirErro('Cadastre e salve o local do perímetro primeiro.');
      return;
    }
    if (!lista.length) {
      definirErro('Monte o checklist antes de ativar o aviso.');
      return;
    }
    try {
      await iniciarPerimetroEmSegundoPlano({
        nome: nomeLocal,
        latitude: centroPerimetro.latitude,
        longitude: centroPerimetro.longitude,
        raio: raioPerimetro,
        items: listaAtual.current.filter((item) => item.mostrarNaPlaca === true && !item.conferido).map((item) => item.name),
        bleId: objetos.find((objeto) => objeto.ble_uuid)?.ble_uuid,
      });
      definirMonitorandoPerimetro(true);
      definirErro('');
      definirEstadoPerimetro(`Aviso em segundo plano ativo para ${nomeLocal}. Ao sair, o celular mostra a notificação e envia o alerta somente se a placa já estiver conectada.`);
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível iniciar o GPS. Confira as permissões e tente novamente.');
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={estilos.sobretitulo}>ROTINA</Text>
      <Text style={estilos.titulo}>Checklist e perímetro</Text>
      <Text style={estilos.subtitulo}>Cadastre o local de referência, escolha os objetos e receba um aviso se sair do perímetro antes de conferir a lista.</Text>

      <View style={estilos.avisoPerimetro}>
        <Ionicons name="information-circle" size={21} color={cores.primario} />
      <Text style={estilos.textoAvisoPerimetro}>O celular monitora o perímetro em segundo plano com sua permissão. Ao sair, mostra uma notificação e envia os itens marcados somente se a placa já estiver conectada por Bluetooth. A placa não tem GPS próprio. O buzzer continua desativado.</Text>
      </View>

      <View style={estilos.cartaoPerimetro}>
        <Text style={estilos.tituloPerimetro}>1 · Cadastrar local de referência</Text>
        <Text style={estilos.textoPerimetro}>Use sua localização atual quando estiver no local que deseja proteger, ou ajuste o pino no mapa.</Text>
        <TextInput value={nomeLocal} onChangeText={(valor) => { definirNomeLocal(valor); definirLocalSalvo(false); }} placeholder="Ex.: Casa" placeholderTextColor={cores.textoSuave} maxLength={50} style={estilos.campoLocal} />
        <Botao título="Usar minha localização atual" ícone="locate-outline" aoPressionar={marcarLocalAtual} secundário />
        {centroPerimetro ? <MapaLibre latitude={centroPerimetro.latitude} longitude={centroPerimetro.longitude} aoEscolher={(latitude, longitude) => { definirCentroPerimetro({ latitude, longitude }); definirLocalSalvo(false); }} /> : null}
        {centroPerimetro ? <Text style={estilos.textoPerimetro}>Centro: {centroPerimetro.latitude.toFixed(5)}, {centroPerimetro.longitude.toFixed(5)}</Text> : null}
        <Text style={estilos.textoRaio}>Tamanho do perímetro</Text>
        <View style={estilos.opcoesRaio}>{[100, 200, 500, 1000].map((raio) => <Pressable key={raio} accessibilityRole="radio" accessibilityState={{ selected: raioPerimetro === raio }} onPress={() => { definirRaioPerimetro(raio); definirLocalSalvo(false); }} style={[estilos.opcaoRaio, raioPerimetro === raio && estilos.opcaoRaioAtiva]}><Text style={[estilos.textoOpcaoRaio, raioPerimetro === raio && estilos.textoOpcaoRaioAtiva]}>{raio >= 1000 ? `${raio / 1000} km` : `${raio} m`}</Text></Pressable>)}</View>
        <Botao título={localSalvo ? 'Local salvo' : 'Salvar local e perímetro'} ícone={localSalvo ? 'checkmark-circle-outline' : 'bookmark-outline'} aoPressionar={salvarLocalPerimetro} desativado={!centroPerimetro} />
      </View>

        <View style={estilos.avisoBuzzer}>
        <Ionicons name="volume-high-outline" size={20} color={cores.laranja} />
          <View style={{ flex: 1 }}><Text style={estilos.tituloAvisoBuzzer}>Buzzer em preparação</Text><Text style={estilos.textoAvisoBuzzer}>O acionamento pelo app ficará disponível depois que o buzzer for conectado. A função do buzzer está comentada no firmware por enquanto.</Text></View>
          {/* Ação reservada: ligar ao comando BLE de buzzer depois da instalação do componente. */}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={estilos.botaoBuzzerDesativado}><Text style={estilos.textoBotaoBuzzerDesativado}>Tocar buzzer</Text></Pressable>
      </View>

      <Botao título={carregando ? 'Preparando sua lista...' : 'Montar lista de saída'} ícone="checkbox-outline" aoPressionar={montarLista} carregando={carregando} />
      <Botao título="Cadastrar ou editar itens do checklist" ícone="add-circle-outline" aoPressionar={abrirObjetos} secundário />

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
          <Text style={estilos.resumoLista}>{itensNaPlaca} marcados para aparecer na placa</Text>
          <View style={estilos.trilho}><View style={[estilos.progresso, { width: `${progresso}%` as `${number}%` }]} /></View>

          <View style={estilos.cartaoMonitoramento}>
            <Text style={estilos.tituloPerimetro}>2 · Checklist de saída</Text>
            <Text style={estilos.textoPerimetro}>Marque “Lembrar” nos itens que quer ver na placa e acompanhar. Ao sair do local, o app avisa sobre os marcados que você ainda não conferiu e envia a lista para a placa se ela estiver conectada. O buzzer está desativado por enquanto.</Text>
            {estadoPerimetro ? <Text accessibilityRole="status" style={estilos.estadoPerimetro}>{estadoPerimetro}</Text> : null}
            <Botao título={monitorandoPerimetro ? 'Pausar aviso de perímetro' : 'Ativar aviso de perímetro'} ícone={monitorandoPerimetro ? 'pause-circle-outline' : 'shield-checkmark-outline'} aoPressionar={alternarMonitoramentoPerimetro} secundário={!monitorandoPerimetro} estilo={{ marginTop: 10 }} />
          </View>

          {lista.map((item) => (
            <View key={String(item.id)} style={estilos.itemLista}>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={'Marcar ' + item.name + ' como conferido'} accessibilityState={{ checked: item.conferido }} onPress={() => alternarConferido(item.id)} style={{ flex: 1, minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[estilos.caixaMarcacao, item.conferido && estilos.caixaMarcada]}>{item.conferido ? <Ionicons name="checkmark" size={16} color={cores.branco} /> : null}</View>
                <ImagemObjeto nome={item.name} categoria={item.category} tamanho={19} compacto />
                <View style={{ flex: 1 }}><Text style={[estilos.nomeItem, item.conferido && estilos.nomeConferido]}>{item.name}</Text><Text style={estilos.categoriaItem}>{item.sugestao ? 'Sugestão para o destino' : item.category || 'Objeto'}</Text></View>
                {item.essential ? <Ionicons name="star" size={15} color="#C77A19" /> : null}
              </Pressable>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={(item.mostrarNaPlaca === true ? 'Remover ' : 'Lembrar ') + item.name + (item.mostrarNaPlaca === true ? ' da placa e do aviso' : ' na placa e no aviso')} accessibilityState={{ checked: item.mostrarNaPlaca === true }} onPress={() => alternarNaPlaca(item.id)} style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, minHeight: 60 }}>
                <Ionicons name={item.mostrarNaPlaca === true ? 'checkbox' : 'square-outline'} size={20} color={item.mostrarNaPlaca === true ? cores.primario : cores.textoSuave} />
                <Text style={{ fontSize: 10, color: item.mostrarNaPlaca === true ? cores.primario : cores.textoSuave, marginTop: 3 }}>Lembrar</Text>
              </Pressable>
            </View>
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
          <Text style={estilos.textoOrientacao}>Cadastre seus objetos para montar a lista. O aviso de perímetro usa o GPS do celular; o buzzer físico só poderá ser ativado depois de conectado à placa.</Text>
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
