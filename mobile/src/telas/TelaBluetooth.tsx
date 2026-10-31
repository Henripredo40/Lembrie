import estilos from '../estilos/TelaBluetooth.estilos';
import React, { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, ScrollView, Text, View, type Permission } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CartaoObjeto from '../componentes/CartaoObjeto';
import { Aviso, Botao, EstadoVazio, TituloSecao } from '../componentes/Elementos';
import { cores, raios } from '../tema';
import { objetoTemChaveiro } from '../utils/objetos';

let ConstrutorBluetooth = null;
if (Platform.OS !== 'web') {
  try {
    ConstrutorBluetooth = require('react-native-ble-plx').BleManager;
  } catch (erro) {
    ConstrutorBluetooth = null;
  }
}

export default function TelaBluetooth({ objetos, definirObjetos, api, notificar, abrirObjetos }) {
  const gerente = useRef(null);
  const temporizador = useRef(null);
  const temporizadorSinal = useRef(null);
  const inscriçãoDesconexão = useRef(null);
  const conexãoAtual = useRef(null);
  const [estadoBluetooth, setEstadoBluetooth] = useState('Verificando');
  const [erro, setErro] = useState('');
  const [procurando, setProcurando] = useState(false);
  const [dispositivos, setDispositivos] = useState([]);
  const [dispositivoEscolhido, escolherDispositivo] = useState(null);
  const [objetoEscolhido, escolherObjeto] = useState('');
  const [vinculando, setVinculando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);

  useEffect(() => {
    if (objetos.length && !objetos.some((objeto) => String(objeto.id) === String(objetoEscolhido))) {
      escolherObjeto(String(objetos[0].id));
    }
  }, [objetos, objetoEscolhido]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    if (!ConstrutorBluetooth) {
      setEstadoBluetooth('Indisponível');
      setErro('O módulo Bluetooth não está incluído nesta instalação. Gere novamente o aplicativo Android após as alterações.');
      return undefined;
    }

    try {
      const novoGerente = new ConstrutorBluetooth();
      gerente.current = novoGerente;
      const inscrição = novoGerente.onStateChange((estado) => setEstadoBluetooth(estado), true);
      return () => {
        if (temporizador.current) clearTimeout(temporizador.current);
        if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
        try { novoGerente.stopDeviceScan(); } catch (falha) {}
        inscriçãoDesconexão.current?.remove();
        if (conexãoAtual.current) {
          const conexão = conexãoAtual.current;
          api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: conexão.id, connected: false }) }).catch(() => {});
          novoGerente.cancelDeviceConnection(conexão.id).catch(() => {});
          conexãoAtual.current = null;
        }
        inscrição.remove();
        novoGerente.destroy();
        gerente.current = null;
      };
    } catch (falha) {
      setEstadoBluetooth('Indisponível');
      setErro('Não foi possível iniciar o Bluetooth neste aparelho.');
      return undefined;
    }
  }, []);

  function pararBusca() {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    try {
      const resultado = gerente.current?.stopDeviceScan();
      resultado?.catch?.(() => {});
    } catch (falha) {}
    setProcurando(false);
  }

  async function pedirPermissões() {
    if (Platform.OS !== 'android') return true;
    const necessárias: Permission[] = Number(Platform.Version) >= 31
      ? ['android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT']
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const resultados = await PermissionsAndroid.requestMultiple(necessárias);
    const recusadas = necessárias.filter((permissão) => resultados[permissão] !== PermissionsAndroid.RESULTS.GRANTED);
    if (recusadas.length) {
      setErro('Permita o acesso ao Bluetooth nas configurações do Android para procurar o chaveiro.');
      return false;
    }
    return true;
  }

  async function iniciarBusca() {
    if (Platform.OS === 'web') return;
    if (!objetos.length) {
      setErro('Cadastre primeiro o objeto que receberá o chaveiro.');
      return;
    }
    if (!gerente.current) {
      setErro('O Bluetooth não está disponível nesta instalação do aplicativo.');
      return;
    }

    setErro('');
    setDispositivos([]);
    escolherDispositivo(null);

    try {
      const autorizado = await pedirPermissões();
      if (!autorizado) return;

      const estado = await gerente.current.state();
      setEstadoBluetooth(estado);
      if (estado !== 'PoweredOn') {
        setErro(estado === 'PoweredOff'
          ? 'Ative o Bluetooth do celular e toque em “Buscar dispositivos” novamente.'
          : 'O Bluetooth ainda não está pronto. Confira se está disponível e tente de novo.');
        return;
      }

      setProcurando(true);
      await gerente.current.startDeviceScan(null, { allowDuplicates: false }, (falha, dispositivo) => {
        if (falha) {
          setErro('A busca foi interrompida: ' + falha.message);
          pararBusca();
          return;
        }
        if (!dispositivo?.id) return;
        const achado = {
          id: dispositivo.id,
          nome: dispositivo.name || dispositivo.localName || 'Dispositivo Bluetooth sem nome',
          sinal: dispositivo.rssi,
        };
        setDispositivos((atuais) => {
          const semDuplicados = atuais.filter((item) => item.id !== achado.id);
          return [...semDuplicados, achado].sort((a, b) => (b.sinal ?? -100) - (a.sinal ?? -100));
        });
      });
      temporizador.current = setTimeout(pararBusca, 15000);
    } catch (falha) {
      setErro('Não foi possível buscar dispositivos. Verifique o Bluetooth e tente novamente.');
      pararBusca();
    }
  }

  async function associarDispositivo() {
    if (!dispositivoEscolhido || !objetoEscolhido) return;
    const objeto = objetos.find((item) => String(item.id) === String(objetoEscolhido));
    if (!objeto) return;
    setVinculando(true);
    setConectando(true);
    setErro('');
    try {
      pararBusca();
      const conectado = await gerente.current.connectToDevice(dispositivoEscolhido.id, { timeout: 12000 });
      await conectado.discoverAllServicesAndCharacteristics();
      const serviços = await conectado.services();
      const listaServiços = await Promise.all(serviços.map(async (serviço) => {
        const características = await conectado.characteristicsForService(serviço.uuid);
        return {
          uuid: serviço.uuid,
          características: características.map((característica) => ({
            uuid: característica.uuid,
            leitura: característica.isReadable,
            escrita: característica.isWritableWithResponse || característica.isWritableWithoutResponse,
            notificação: característica.isNotifiable || característica.isIndicatable,
          })),
        };
      }));
      await api('/objects/' + objeto.id, {
        method: 'PATCH',
        body: JSON.stringify({ ble_uuid: dispositivoEscolhido.id }),
      });
      conexãoAtual.current = { id: dispositivoEscolhido.id, objetoId: objeto.id };
      setDiagnostico({ nome: dispositivoEscolhido.nome, serviços: listaServiços });
      await api('/devices/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ ble_uuid: dispositivoEscolhido.id, connected: true, rssi: dispositivoEscolhido.sinal }),
      });
      inscriçãoDesconexão.current?.remove();
      inscriçãoDesconexão.current = gerente.current.onDeviceDisconnected(dispositivoEscolhido.id, () => {
        if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
        temporizadorSinal.current = null;
        conexãoAtual.current = null;
        setDiagnostico(null);
        definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(objeto.id) ? { ...item, connected: false } : item));
        api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: dispositivoEscolhido.id, connected: false }) }).catch(() => {});
      });
      if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
      temporizadorSinal.current = setInterval(async () => {
        try {
          const atualizado = await gerente.current?.readRSSIForDevice(dispositivoEscolhido.id);
          await api('/devices/heartbeat', {
            method: 'POST',
            body: JSON.stringify({ ble_uuid: dispositivoEscolhido.id, connected: true, rssi: atualizado?.rssi ?? null }),
          });
        } catch (falha) {
          // A conexão pode cair entre a leitura do sinal e o envio do heartbeat.
        }
      }, 20000);
      definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(objeto.id)
        ? { ...item, ble_uuid: dispositivoEscolhido.id, connected: true, last_rssi: dispositivoEscolhido.sinal }
        : item));
      escolherDispositivo(null);
      notificar('Dispositivo conectado e associado a “' + objeto.name + '”. Os serviços e recursos Bluetooth foram identificados.');
    } catch (falha) {
      if (dispositivoEscolhido?.id) gerente.current?.cancelDeviceConnection(dispositivoEscolhido.id).catch(() => {});
      setErro(falha.message || 'Não foi possível associar esse dispositivo.');
    } finally {
      setVinculando(false);
      setConectando(false);
    }
  }

  async function desconectarDispositivo(objeto) {
    const id = objeto.ble_uuid;
    if (!id || !gerente.current) return;
    try {
      inscriçãoDesconexão.current?.remove();
      inscriçãoDesconexão.current = null;
      if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
      temporizadorSinal.current = null;
      await gerente.current.cancelDeviceConnection(id);
      await api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: id, connected: false }) });
      conexãoAtual.current = null;
      setDiagnostico(null);
      definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(objeto.id) ? { ...item, connected: false } : item));
    } catch (falha) {
      notificar(falha.message || 'Não foi possível desconectar o dispositivo.');
    }
  }

  async function removerAssociacao(objeto) {
    try {
      await api('/objects/' + objeto.id, {
        method: 'PATCH',
        body: JSON.stringify({ ble_uuid: null }),
      });
      if (conexãoAtual.current?.id === objeto.ble_uuid) {
        inscriçãoDesconexão.current?.remove();
        if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
        temporizadorSinal.current = null;
        await gerente.current?.cancelDeviceConnection(objeto.ble_uuid).catch(() => {});
        conexãoAtual.current = null;
        setDiagnostico(null);
      }
      definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(objeto.id)
        ? { ...item, ble_uuid: null, device_id: null, connected: false, last_rssi: null }
        : item));
      notificar('Associação Bluetooth removida.');
    } catch (falha) {
      notificar(falha.message || 'Não foi possível remover a associação.');
    }
  }

  const associados = objetos.filter(objetoTemChaveiro);
  const objetoSelecionado = objetos.find((item) => String(item.id) === String(objetoEscolhido));

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Text style={estilos.sobretitulo}>CHAVEIRO</Text>
      <Text style={estilos.titulo}>Bluetooth</Text>
      <Text style={estilos.subtitulo}>Prepare a associação dos seus objetos ao chaveiro que você vai construir.</Text>

      {Platform.OS === 'web' ? (
        <EstadoVazio ícone="phone-portrait-outline" título="Use o aplicativo Android para buscar" texto="A busca Bluetooth precisa das permissões nativas do celular. No site, você pode organizar os objetos; para encontrar dispositivos, use o APK Android." />
      ) : (
        <>
          <View style={estilos.cartaoEstado}>
            <View style={[estilos.iconeEstado, estadoBluetooth === 'PoweredOn' && estilos.iconeLigado]}><MaterialCommunityIcons name="bluetooth" size={26} color={estadoBluetooth === 'PoweredOn' ? cores.branco : cores.primario} /></View>
            <View style={{ flex: 1 }}>
              <Text style={estilos.tituloEstado}>{estadoBluetooth === 'PoweredOn' ? 'Bluetooth ligado' : estadoBluetooth === 'PoweredOff' ? 'Bluetooth desligado' : 'Bluetooth do celular'}</Text>
              <Text style={estilos.textoEstado}>{estadoBluetooth === 'PoweredOn' ? 'O aparelho está pronto para procurar dispositivos próximos.' : 'A busca só começa depois que o Bluetooth estiver ligado.'}</Text>
            </View>
            <View style={[estilos.pontoEstado, estadoBluetooth === 'PoweredOn' && estilos.pontoLigado]} />
          </View>

          <View style={estilos.cartaoAviso}>
            <View style={estilos.cabecalhoAviso}><Ionicons name="construct-outline" size={19} color={cores.primario} /><Text style={estilos.tituloAviso}>Como conectar</Text></View>
            <Text style={estilos.textoAviso}>Ligue a placa no interruptor físico e mantenha o chaveiro perto do celular. Escolha o objeto, toque em “Buscar meu chaveiro” e conecte ao dispositivo encontrado. A placa precisa estar ligada para o app encontrá-la.</Text>
          </View>

          {objetos.length ? (
            <View style={estilos.cartaoBusca}>
              <Text style={estilos.tituloBusca}>Associar a qual objeto?</Text>
              <Text style={estilos.textoBusca}>Escolha o objeto que receberá o chaveiro. O app vai procurar dispositivos Bluetooth próximos.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.listaObjetos}>
                {objetos.map((objeto) => (
                  <Pressable key={String(objeto.id)} accessibilityRole="button" onPress={() => escolherObjeto(String(objeto.id))} style={[estilos.opcaoObjeto, String(objeto.id) === String(objetoEscolhido) && estilos.opcaoObjetoAtiva]}>
                    <Text numberOfLines={1} style={[estilos.nomeOpcao, String(objeto.id) === String(objetoEscolhido) && estilos.nomeOpcaoAtiva]}>{objeto.name}</Text>
                    {objetoTemChaveiro(objeto) ? <Text style={estilos.associadoPequeno}>Associado</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
              <Botao título={procurando ? 'Procurando chaveiro...' : 'Buscar meu chaveiro'} ícone="bluetooth-outline" aoPressionar={procurando ? pararBusca : iniciarBusca} carregando={false} estilo={estilos.botaoBusca} />
              {procurando ? <Text style={estilos.tempoBusca}>Busca ativa por até 15 segundos. Mantenha o dispositivo por perto.</Text> : null}
            </View>
          ) : (
            <EstadoVazio ícone="cube-outline" título="Adicione um objeto primeiro" texto="Depois você poderá escolher qual objeto será associado ao chaveiro." ação="Ir para meus objetos" aoPressionar={abrirObjetos} />
          )}

          {erro ? <Aviso ícone="alert-circle-outline" tom="alerta" texto={erro} /> : null}

          {dispositivos.length > 0 ? (
            <View style={estilos.resultados}>
              <TituloSecao título={'DISPOSITIVOS PRÓXIMOS · ' + dispositivos.length} />
              <Text style={estilos.lembreteSelecao}>Selecione apenas o seu chaveiro. Outros acessórios Bluetooth também podem aparecer.</Text>
              {dispositivos.map((dispositivo) => {
                const ativo = dispositivoEscolhido?.id === dispositivo.id;
                const jáAssociado = objetos.some((objeto) => objeto.ble_uuid === dispositivo.id);
                return (
                  <Pressable key={dispositivo.id} accessibilityRole="button" onPress={() => escolherDispositivo(dispositivo)} style={[estilos.dispositivo, ativo && estilos.dispositivoAtivo]}>
                    <View style={estilos.iconeDispositivo}><MaterialCommunityIcons name="bluetooth-connect" size={20} color={ativo ? cores.primario : cores.textoSuave} /></View>
                    <View style={{ flex: 1 }}><Text style={estilos.nomeDispositivo} numberOfLines={1}>{dispositivo.nome}</Text><Text style={estilos.idDispositivo}>{dispositivo.id.slice(0, 8)}{dispositivo.id.length > 8 ? '…' : ''}{dispositivo.sinal != null ? ' · sinal ' + dispositivo.sinal + ' dBm' : ''}</Text></View>
                    {jáAssociado ? <Text style={estilos.textoAssociado}>Em uso</Text> : ativo ? <Ionicons name="checkmark-circle" size={22} color={cores.primario} /> : null}
                  </Pressable>
                );
              })}
              <Botao título={conectando ? 'Conectando ao chaveiro...' : 'Conectar chaveiro a ' + (objetoSelecionado?.name || 'objeto')} ícone="bluetooth-connect" aoPressionar={associarDispositivo} carregando={vinculando} desativado={!dispositivoEscolhido || !objetoEscolhido} estilo={{ marginTop: 11 }} />
            </View>
          ) : !procurando ? (
            <View style={estilos.semResultados}><Ionicons name="radio-outline" size={22} color={cores.textoSuave} /><Text style={estilos.textoSemResultados}>Os dispositivos encontrados aparecerão aqui.</Text></View>
          ) : null}

          <TituloSecao título={'OBJETOS ASSOCIADOS · ' + associados.length} />
          {diagnostico ? (
            <View style={estilos.cartaoDiagnostico}>
              <Text style={estilos.tituloBusca}>Conectado: {diagnostico.nome}</Text>
              <Text style={estilos.textoBusca}>Serviços encontrados: {diagnostico.serviços.length}</Text>
              {diagnostico.serviços.map((serviço) => (
                <View key={serviço.uuid} style={estilos.linhaServico}>
                  <Text style={estilos.uuidServico}>{serviço.uuid}</Text>
                  {serviço.características.map((característica) => (
                    <Text key={característica.uuid} style={estilos.textoCaracteristica}>
                      {característica.uuid} · {[
                        característica.leitura && 'ler',
                        característica.escrita && 'escrever',
                        característica.notificação && 'notificações',
                      ].filter(Boolean).join(', ') || 'sem acesso anunciado'}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
          {associados.length ? (
            <View style={estilos.listaAssociados}>
              {associados.map((objeto) => (
                <View key={String(objeto.id)} style={estilos.itemAssociado}>
                  <CartaoObjeto objeto={objeto} compacto />
                  {objeto.connected ? <Text style={estilos.statusConectado}>Bluetooth conectado</Text> : <Text style={estilos.statusDesconectado}>Bluetooth desconectado</Text>}
                  {objeto.connected ? <Pressable accessibilityRole="button" onPress={() => desconectarDispositivo(objeto)} style={estilos.removerVinculo}><Ionicons name="bluetooth-outline" size={16} color={cores.primario} /><Text style={[estilos.textoRemoverVinculo, { color: cores.primario }]}>Desconectar</Text></Pressable> : null}
                  <Pressable accessibilityRole="button" onPress={() => removerAssociacao(objeto)} style={estilos.removerVinculo}><Ionicons name="unlink-outline" size={16} color={cores.vermelho} /><Text style={estilos.textoRemoverVinculo}>Desassociar dispositivo</Text></Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={estilos.nenhumAssociado}>Ainda não há dispositivos associados. Você pode fazer isso quando o chaveiro estiver pronto.</Text>
          )}
        </>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

