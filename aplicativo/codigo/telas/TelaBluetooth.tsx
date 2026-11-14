import estilos from '../estilos/TelaBluetooth.estilos';
import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, ScrollView, Text, TextInput, View, type Permission } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import CartaoObjeto from '../componentes/CartaoObjeto';
import { Aviso, Botao, EstadoVazio, TituloSecao } from '../componentes/Elementos';
import { cores } from '../tema';
import { objetoTemChaveiro } from '../utilitarios/objetos';
import { lerResumoSaidaBluetooth, registrarItensEnviadosParaPlaca, removerItemDoResumoBluetooth } from '../utilitarios/resumoSaidaBluetooth';
import { criarPacotesComandoLambrie, criarPacotesResumoLambrie } from '../utilitarios/protocoloLambrie';

const SERVIÇO_LEMBRIE = '6f6d0001-7a52-4f6c-9a21-4c454d425249';
const CARACTERÍSTICA_LEMBRIE = '6f6d0002-7a52-4f6c-9a21-4c454d425249';
const CARACTERISTICA_EVENTOS = '6f6d0003-7a52-4f6c-9a21-4c454d425249';
const ALFABETO_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function detalharErroBluetooth(mensagem, erro) {
  const codigo = erro?.errorCode ?? erro?.code;
  const detalhe = String(erro?.message || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  return `${mensagem}${codigo != null ? ` [${codigo}]` : ''}${detalhe ? `: ${detalhe}` : ''}`;
}

function decodificarEventoBase64(valor) {
  let resultado = '';
  let acumulador = 0;
  let bits = 0;
  for (const caractere of valor || '') {
    if (caractere === '=') break;
    const digito = ALFABETO_BASE64.indexOf(caractere);
    if (digito < 0) continue;
    acumulador = (acumulador << 6) | digito;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      resultado += String.fromCharCode((acumulador >> bits) & 255);
      acumulador &= (1 << bits) - 1;
    }
  }
  return resultado;
}
let ConstrutorBluetooth = null;
let gerenteBluetoothCompartilhado = null;
let conexãoLambrieCompartilhada = null;
let monitoramentoDesativado = false;
let inscriçãoEventosLambrie = null;
if (Platform.OS !== 'web') {
  try {
    ConstrutorBluetooth = require('react-native-ble-plx').BleManager;
  } catch (erro) {
    ConstrutorBluetooth = null;
  }
}

async function enviarComandoLambrie(dispositivo, comando) {
  for (const pacote of criarPacotesComandoLambrie(comando)) {
    await dispositivo.writeCharacteristicWithResponseForService(SERVIÇO_LEMBRIE, CARACTERÍSTICA_LEMBRIE, pacote);
  }
}

export async function enviarResumoPerimetroParaLambrie(resumo, idSalvo = null) {
  const id = idSalvo || conexãoLambrieCompartilhada?.id;
  if (!id || Platform.OS === 'web') return false;
  const gerente = gerenteBluetoothCompartilhado || (ConstrutorBluetooth ? new ConstrutorBluetooth() : null);
  if (!gerente) return false;
  gerenteBluetoothCompartilhado = gerente;
  let dispositivo;
  dispositivo = (await gerente.connectedDevices([SERVIÇO_LEMBRIE]).catch(() => [])).find((item) => item.id === id);
  if (!dispositivo) return false;
  conexãoLambrieCompartilhada = { id, objetoId: conexãoLambrieCompartilhada?.objetoId || null };
  await dispositivo.discoverAllServicesAndCharacteristics();
  for (const pacote of criarPacotesResumoLambrie(resumo)) {
    await dispositivo.writeCharacteristicWithResponseForService(
      SERVIÇO_LEMBRIE,
      CARACTERÍSTICA_LEMBRIE,
      pacote,
    );
  }
  await registrarItensEnviadosParaPlaca(resumo.items);
  return true;
}

function aguardar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

export async function encerrarConexaoLambrie() {
  monitoramentoDesativado = true;
  const conexão = conexãoLambrieCompartilhada;
  const gerente = gerenteBluetoothCompartilhado;
  if (!conexão || !gerente) return;
  try {
    const dispositivo = (await gerente.devices([conexão.id]))[0] || await gerente.connectToDevice(conexão.id, { timeout: 5000 });
    await dispositivo.discoverAllServicesAndCharacteristics();
    await enviarComandoLambrie(dispositivo, 'disarm');
    await aguardar(150);
  } catch (falha) {
    // Se o dispositivo já estiver fora de alcance, a conexão será encerrada abaixo.
  }
  await gerente.cancelDeviceConnection(conexão.id).catch(() => {});
  conexãoLambrieCompartilhada = null;
}

export async function reativarMonitoramentoLambrie(id, objetoId, api) {
  if (Platform.OS === 'web' || !id || monitoramentoDesativado || !ConstrutorBluetooth) return false;
  try {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
      const permissões = await PermissionsAndroid.requestMultiple([
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT',
      ]);
      if (Object.values(permissões).some((resultado) => resultado !== PermissionsAndroid.RESULTS.GRANTED)) {
        await api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: id, connected: false }) }).catch(() => {});
        return false;
      }
    }
    const gerente = gerenteBluetoothCompartilhado || new ConstrutorBluetooth();
    gerenteBluetoothCompartilhado = gerente;
    const conectados = await gerente.connectedDevices([SERVIÇO_LEMBRIE]);
    if (conexãoLambrieCompartilhada?.id === id && conectados.some((dispositivo) => dispositivo.id === id)) {
      await api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: id, connected: true }) }).catch(() => {});
      return true;
    }
    const dispositivoConectado = conectados.find((dispositivo) => dispositivo.id === id);
    const dispositivo = dispositivoConectado || await gerente.connectToDevice(id, { timeout: 10000 });
    await dispositivo.discoverAllServicesAndCharacteristics();
    await enviarComandoLambrie(dispositivo, 'arm');
    conexãoLambrieCompartilhada = { id, objetoId };
    await api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: id, connected: true }) }).catch(() => {});
    return true;
  } catch (falha) {
    await api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: id, connected: false }) }).catch(() => {});
    return false;
  }
}

export function habilitarMonitoramentoLambrie() {
  monitoramentoDesativado = false;
}

export default function TelaBluetooth({ objetos, definirObjetos, api, notificar, abrirObjetos, lerResumo = lerResumoSaidaBluetooth }) {
  const gerente = useRef(null);
  const temporizador = useRef(null);
  const temporizadorReinicioBusca = useRef(null);
  const temporizadorSinal = useRef(null);
  const buscaEmAndamento = useRef(false);
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
  const [enviandoResumo, setEnviandoResumo] = useState(false);
  const [cadastroSolicitado, definirCadastroSolicitado] = useState(false);
  const [nomeCadastroChaveiro, definirNomeCadastroChaveiro] = useState('');
  const [salvandoCadastroChaveiro, definirSalvandoCadastroChaveiro] = useState(false);
  const [erroCadastroChaveiro, definirErroCadastroChaveiro] = useState('');
  const [localizando, setLocalizando] = useState(false);
  const componenteAtivo = useRef(false);

  function acompanharPedidoCadastro(dispositivo) {
    inscriçãoEventosLambrie?.remove();
    const receberEvento = (erroMonitoramento, característica) => {
      if (erroMonitoramento || !característica?.value) return;
      try {
        const evento = JSON.parse(decodificarEventoBase64(característica.value));
        if (evento.event === 'register_object' && componenteAtivo.current) {
          definirNomeCadastroChaveiro('');
          definirErroCadastroChaveiro('');
          definirCadastroSolicitado(true);
        } else if (Number.isInteger(evento.checked)) {
          removerItemDoResumoBluetooth(evento.checked)
            .then((removido) => {
              if (removido) notificar?.('Item conferido na placa e removido de “Lembrar” no app.');
            })
            .catch(() => {});
        }
      } catch (erro) {
        // Ignora mensagens que não pertencem ao protocolo de cadastro.
      }
    };
    inscriçãoEventosLambrie = dispositivo.monitorCharacteristicForService(
      SERVIÇO_LEMBRIE,
      CARACTERISTICA_EVENTOS,
      receberEvento,
    );
    dispositivo.readCharacteristicForService(SERVIÇO_LEMBRIE, CARACTERISTICA_EVENTOS)
      .then((característica) => receberEvento(null, característica))
      .catch(() => {});
  }

  async function concluirCadastroSolicitado() {
    const nome = nomeCadastroChaveiro.trim();
    if (!nome) {
      definirErroCadastroChaveiro('Informe o nome do objeto.');
      return;
    }
    definirSalvandoCadastroChaveiro(true);
    definirErroCadastroChaveiro('');
    try {
      const novo = await api('/objects', {
        method: 'POST',
        body: JSON.stringify({ name: nome, category: 'Outros', essential: false }),
      });
      definirObjetos((atuais) => [novo, ...atuais]);
      definirCadastroSolicitado(false);
      definirNomeCadastroChaveiro('');
      let resumoEnviado = false;
      const conexão = conexãoAtual.current;
      if (conexão && gerente.current) {
        try {
          const dispositivo = (await gerente.current.devices([conexão.id]))[0];
          if (dispositivo) {
            for (const pacote of criarPacotesResumoLambrie({ destination: 'Novo objeto', items: [nome], updatedAt: Date.now() })) {
              await dispositivo.writeCharacteristicWithoutResponseForService(SERVIÇO_LEMBRIE, CARACTERÍSTICA_LEMBRIE, pacote);
            }
            resumoEnviado = true;
          }
        } catch (falhaAoAtualizarVisor) {
          // O cadastro já foi aceito pelo app; a tela pode ser atualizada ao reconectar.
        }
      }
      notificar(resumoEnviado ? 'Objeto cadastrado no app e enviado para o visor.' : 'Objeto cadastrado no app; conecte o chaveiro para atualizar o visor.');
    } catch (falha) {
      definirErroCadastroChaveiro(falha.message || 'Não foi possível salvar o objeto.');
      const conexão = conexãoAtual.current;
      if (conexão && gerente.current) {
        const dispositivo = (await gerente.current.devices([conexão.id]).catch(() => []))[0];
        if (dispositivo) await enviarComandoLambrie(dispositivo, 'registration_error').catch(() => {});
      }
    } finally {
      definirSalvandoCadastroChaveiro(false);
    }
  }

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
      const novoGerente = gerenteBluetoothCompartilhado || new ConstrutorBluetooth();
      gerenteBluetoothCompartilhado = novoGerente;
      gerente.current = novoGerente;
      const inscrição = novoGerente.onStateChange((estado) => setEstadoBluetooth(estado), true);
      componenteAtivo.current = true;
      void (async () => {
        try {
          const conectados = await novoGerente.connectedDevices([SERVIÇO_LEMBRIE]);
          const conexãoSalva = conexãoLambrieCompartilhada;
          if (!conexãoSalva || !conectados.some((dispositivo) => dispositivo.id === conexãoSalva.id)) {
            if (conexãoSalva) {
              conexãoLambrieCompartilhada = null;
              conexãoAtual.current = null;
              definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(conexãoSalva.objetoId) ? { ...item, connected: false } : item));
              api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: conexãoSalva.id, connected: false }) }).catch(() => {});
            }
            return;
          }
          conexãoAtual.current = conexãoSalva;
          definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(conexãoSalva.objetoId) ? { ...item, connected: true } : item));
          await acompanharDesconexão(conexãoSalva.id, conexãoSalva.objetoId);
          const dispositivo = conectados.find((item) => item.id === conexãoSalva.id);
          if (!dispositivo) return;
          await dispositivo.discoverAllServicesAndCharacteristics();
          acompanharPedidoCadastro(dispositivo);
          const serviços = await dispositivo.services();
          setDiagnostico({ nome: dispositivo.name || 'Lambrie ESP32C3', serviços: await Promise.all((serviços || []).map(async (serviço) => ({
            uuid: serviço.uuid,
            características: (await dispositivo.characteristicsForService(serviço.uuid)).map((característica) => ({
              uuid: característica.uuid,
              leitura: característica.isReadable,
              escrita: característica.isWritableWithResponse || característica.isWritableWithoutResponse,
              notificação: característica.isNotifiable || característica.isIndicatable,
            })),
          }))) });
        } catch (falha) {}
      })();
      return () => {
        componenteAtivo.current = false;
        if (temporizador.current) clearTimeout(temporizador.current);
        if (temporizadorReinicioBusca.current) clearTimeout(temporizadorReinicioBusca.current);
        if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
        try { novoGerente.stopDeviceScan(); } catch (falha) {}
        inscriçãoDesconexão.current?.remove();
        inscriçãoDesconexão.current = null;
        inscrição.remove();
        // Mantém a conexão BLE durante a navegação no app para que o chaveiro
        // possa detectar uma perda real de proximidade, sem alertar ao trocar de tela.
      };
    } catch (falha) {
      setEstadoBluetooth('Indisponível');
      setErro('Não foi possível iniciar o Bluetooth neste aparelho.');
      return undefined;
    }
  }, []);

  function pararBusca() {
    buscaEmAndamento.current = false;
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    if (temporizadorReinicioBusca.current) {
      clearTimeout(temporizadorReinicioBusca.current);
      temporizadorReinicioBusca.current = null;
    }
    try {
      const resultado = gerente.current?.stopDeviceScan();
      resultado?.catch?.(() => {});
    } catch (falha) {}
    setProcurando(false);
  }

  async function acompanharDesconexão(id, objetoId) {
    inscriçãoDesconexão.current?.remove();
    inscriçãoDesconexão.current = gerente.current.onDeviceDisconnected(id, () => {
      if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
      temporizadorSinal.current = null;
      inscriçãoEventosLambrie?.remove();
      inscriçãoEventosLambrie = null;
      conexãoAtual.current = null;
      if (conexãoLambrieCompartilhada?.id === id) conexãoLambrieCompartilhada = null;
      if (componenteAtivo.current) {
        setDiagnostico(null);
        definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(objetoId) ? { ...item, connected: false } : item));
      setErro('A conexão Bluetooth caiu. A placa precisa estar conectada para receber o aviso visual; o buzzer está desativado por enquanto.');
      }
      api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: id, connected: false }) }).catch(() => {});
    });
  }

  async function pedirPermissões() {
    if (Platform.OS !== 'android') return true;
    if (Number(Platform.Version) < 31) {
      const serviçosDeLocalizaçãoAtivos = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!serviçosDeLocalizaçãoAtivos) {
        setErro('Ative a Localização/GPS do celular para procurar dispositivos Bluetooth neste Android.');
        return false;
      }
    }
    const necessárias: Permission[] = Number(Platform.Version) >= 31
      ? ['android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT']
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const resultados = await PermissionsAndroid.requestMultiple(necessárias);
    const recusadas = necessárias.filter((permissão) => resultados[permissão] !== PermissionsAndroid.RESULTS.GRANTED);
    if (recusadas.length) {
      setErro('Permita Bluetooth e Localização nas configurações do Android e tente buscar novamente.');
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

    if (buscaEmAndamento.current) return;
    buscaEmAndamento.current = true;
    setErro('');
    setDispositivos([]);
    escolherDispositivo(null);

    try {
      const autorizado = await pedirPermissões();
      if (!autorizado) {
        buscaEmAndamento.current = false;
        return;
      }

      // Encerra qualquer busca anterior do gerenciador compartilhado e dá
      // tempo para o Android liberar o scanner antes de iniciar outra.
      try { await gerente.current.stopDeviceScan(); } catch (falha) {}
      await new Promise((resolver) => setTimeout(resolver, 500));
      const estado = await gerente.current.state();
      setEstadoBluetooth(estado);
      if (estado !== 'PoweredOn') {
        setErro(estado === 'PoweredOff'
          ? 'Ative o Bluetooth do celular e toque em “Buscar dispositivos” novamente.'
          : 'O Bluetooth ainda não está pronto. Confira se está disponível e tente de novo.');
        buscaEmAndamento.current = false;
        return;
      }

      setProcurando(true);
      const iniciarScanner = (tentativa = 0) => {
        if (!buscaEmAndamento.current || !gerente.current) return;
        const receberResultado = (falha, dispositivo) => {
          if (falha) {
            if (tentativa === 0 && /scan|scanning|scanner/i.test(falha.message || '')) {
              try { gerente.current?.stopDeviceScan(); } catch (ignorada) {}
              setErro('O Android não iniciou a busca. Vou reiniciar o scanner e tentar mais uma vez…');
              temporizadorReinicioBusca.current = setTimeout(() => iniciarScanner(1), 800);
              return;
            }
            setErro(detalharErroBluetooth('A busca foi interrompida. Confira as permissões de Dispositivos próximos.', falha));
            pararBusca();
            return;
          }
          if (!dispositivo?.id) return;
          setErro('');
          const achado = {
            id: dispositivo.id,
            nome: dispositivo.name || dispositivo.localName || 'Dispositivo Bluetooth sem nome',
            sinal: dispositivo.rssi,
          };
          setDispositivos((atuais) => {
            const semDuplicados = atuais.filter((item) => item.id !== achado.id);
            return [...semDuplicados, achado].sort((a, b) => (b.sinal ?? -100) - (a.sinal ?? -100));
          });
        };
        try {
          gerente.current.startDeviceScan(null, { allowDuplicates: false }, receberResultado);
        } catch (falha) {
          if (tentativa === 0 && /scan|scanning|scanner/i.test(falha?.message || '')) {
            try { gerente.current?.stopDeviceScan(); } catch (ignorada) {}
            temporizadorReinicioBusca.current = setTimeout(() => iniciarScanner(1), 800);
          } else {
            setErro(detalharErroBluetooth('O Android não conseguiu iniciar a busca.', falha));
            pararBusca();
          }
        }
      };
      iniciarScanner();
      temporizador.current = setTimeout(pararBusca, 15000);
    } catch (falha) {
      buscaEmAndamento.current = false;
      const detalhe = String(falha?.message || '').toLowerCase();
      const mensagem = detalhe.includes('permission') || detalhe.includes('unauthorized')
        ? 'O Android bloqueou a busca. Permita Bluetooth e, em aparelhos antigos, Localização.'
        : 'Não foi possível iniciar a busca. Confira o Bluetooth do celular.';
      setErro(detalharErroBluetooth(mensagem, falha));
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
      monitoramentoDesativado = false;
      pararBusca();
      const conectado = await gerente.current.connectToDevice(dispositivoEscolhido.id, { timeout: 12000 });
      await conectado.discoverAllServicesAndCharacteristics();
      acompanharPedidoCadastro(conectado);
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
      conexãoLambrieCompartilhada = conexãoAtual.current;
      setDiagnostico({ nome: dispositivoEscolhido.nome, serviços: listaServiços });
      await api('/devices/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ ble_uuid: dispositivoEscolhido.id, connected: true, rssi: dispositivoEscolhido.sinal }),
      });
      await enviarComandoLambrie(conectado, 'arm');
      await acompanharDesconexão(dispositivoEscolhido.id, objeto.id);
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
      if (dispositivoEscolhido?.id && gerente.current) {
        const dispositivo = (await gerente.current.devices([dispositivoEscolhido.id]).catch(() => []))[0];
        if (dispositivo) {
          await enviarComandoLambrie(dispositivo, 'disarm').catch(() => {});
          await aguardar(150);
        }
        gerente.current.cancelDeviceConnection(dispositivoEscolhido.id).catch(() => {});
      }
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
      const dispositivo = (await gerente.current.devices([id]))[0] || await gerente.current.connectToDevice(id);
      await dispositivo.discoverAllServicesAndCharacteristics();
      await enviarComandoLambrie(dispositivo, 'disarm');
      await aguardar(150);
      monitoramentoDesativado = true;
      inscriçãoDesconexão.current?.remove();
      inscriçãoDesconexão.current = null;
      if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
      temporizadorSinal.current = null;
      await gerente.current.cancelDeviceConnection(id);
      await api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: id, connected: false }) });
      conexãoAtual.current = null;
      conexãoLambrieCompartilhada = null;
      setDiagnostico(null);
      definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(objeto.id) ? { ...item, connected: false } : item));
    } catch (falha) {
      notificar(falha.message || 'Não foi possível desconectar o dispositivo.');
    }
  }

  async function localizarChaveiro(objetoAlvo = null) {
    const objeto = objetoAlvo || associados.find((item) => conexãoAtual.current?.id === item.ble_uuid) || associados[0];
    const id = objeto?.ble_uuid || (objeto?.id === conexãoAtual.current?.objetoId ? conexãoAtual.current.id : null);
    const gerenteAtual = gerente.current || gerenteBluetoothCompartilhado;
    if (!id || !objeto || !gerenteAtual) {
      setErro('Associe primeiro um chaveiro Bluetooth ao objeto que deseja localizar.');
      return;
    }
    setLocalizando(true);
    setErro('');
    try {
      const autorizado = await pedirPermissões();
      if (!autorizado) return;
      if (conexãoAtual.current && conexãoAtual.current.id !== id) {
        const anterior = (await gerenteAtual.devices([conexãoAtual.current.id]))[0];
        if (anterior) {
          await anterior.discoverAllServicesAndCharacteristics();
          await enviarComandoLambrie(anterior, 'disarm').catch(() => {});
          await aguardar(150);
        }
        inscriçãoDesconexão.current?.remove();
        if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
        await gerenteAtual.cancelDeviceConnection(conexãoAtual.current.id).catch(() => {});
        conexãoAtual.current = null;
        conexãoLambrieCompartilhada = null;
      }
      const conectados = await gerenteAtual.connectedDevices([SERVIÇO_LEMBRIE]);
      const dispositivo = conectados.find((item) => item.id === id) || await gerenteAtual.connectToDevice(id, { timeout: 10000 });
      await dispositivo.discoverAllServicesAndCharacteristics();
      if (!conexãoAtual.current || conexãoAtual.current.id !== id) {
        await enviarComandoLambrie(dispositivo, 'arm');
        conexãoAtual.current = { id, objetoId: objeto.id };
        conexãoLambrieCompartilhada = conexãoAtual.current;
        monitoramentoDesativado = false;
        await acompanharDesconexão(id, objeto.id);
        definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(objeto.id) ? { ...item, connected: true } : item));
        await api('/devices/heartbeat', { method: 'POST', body: JSON.stringify({ ble_uuid: id, connected: true }) }).catch(() => {});
      }
      await enviarComandoLambrie(dispositivo, 'locate');
      const serviços = await dispositivo.services();
      setDiagnostico({ nome: dispositivo.name || 'Lambrie ESP32C3', serviços: await Promise.all((serviços || []).map(async (serviço) => ({
        uuid: serviço.uuid,
        características: (await dispositivo.characteristicsForService(serviço.uuid)).map((característica) => ({
          uuid: característica.uuid,
          leitura: característica.isReadable,
          escrita: característica.isWritableWithResponse || característica.isWritableWithoutResponse,
          notificação: característica.isNotifiable || característica.isIndicatable,
        })),
      }))) });
      notificar('Comando de localização enviado. O chaveiro emitirá um som.');
    } catch (falha) {
      setErro(falha.message || 'Não foi possível localizar o chaveiro. Confira se ele está conectado e próximo.');
    } finally {
      setLocalizando(false);
    }
  }

  async function enviarResumoParaTela() {
    const conexão = conexãoAtual.current;
    if (!conexão || !gerente.current) {
      setErro('Conecte primeiro a ESP32-C3 Lambrie nesta tela.');
      return;
    }
    setEnviandoResumo(true);
    setErro('');
    try {
      const resumo = await lerResumo();
      if (!resumo) throw new Error('Monte uma lista na tela “Antes de sair” primeiro.');
      const dispositivo = await gerente.current.devices([conexão.id]);
      const conectado = dispositivo[0] || await gerente.current.connectToDevice(conexão.id);
      await conectado.discoverAllServicesAndCharacteristics();
      for (const pacote of criarPacotesResumoLambrie(resumo)) {
        await conectado.writeCharacteristicWithoutResponseForService(
          SERVIÇO_LEMBRIE,
          CARACTERÍSTICA_LEMBRIE,
          pacote,
        );
      }
      await registrarItensEnviadosParaPlaca(resumo.items);
      notificar('Resumo da saída enviado para a tela Lambrie.');
    } catch (falha) {
      setErro(falha.message || 'Não foi possível enviar o resumo. Confira se o firmware Lambrie está instalado.');
    } finally {
      setEnviandoResumo(false);
    }
  }

  async function removerAssociacao(objeto) {
    try {
      await api('/objects/' + objeto.id, {
        method: 'PATCH',
        body: JSON.stringify({ ble_uuid: null }),
      });
      if (conexãoAtual.current?.id === objeto.ble_uuid) {
        monitoramentoDesativado = true;
        const dispositivo = (await gerente.current?.devices([objeto.ble_uuid]) || [])[0];
        if (dispositivo && gerente.current) {
          await dispositivo.discoverAllServicesAndCharacteristics();
          await enviarComandoLambrie(dispositivo, 'disarm');
          await aguardar(150);
        }
        inscriçãoDesconexão.current?.remove();
        if (temporizadorSinal.current) clearInterval(temporizadorSinal.current);
        temporizadorSinal.current = null;
        await gerente.current?.cancelDeviceConnection(objeto.ble_uuid).catch(() => {});
        conexãoAtual.current = null;
        conexãoLambrieCompartilhada = null;
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
      <Text style={estilos.subtitulo}>O app avisa quando a conexão Bluetooth cai. O buzzer da placa está desativado por enquanto.</Text>

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
            <Text style={estilos.textoAviso}>Sem chaveiro, você ainda pode organizar objetos e conferir sua lista manualmente. Os sons precisam de um buzzer externo instalado na ESP32-C3; veja as instruções do firmware.</Text>
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
          {cadastroSolicitado ? (
            <View style={estilos.cartaoCadastroChaveiro}>
              <Text style={estilos.tituloBusca}>Cadastro pedido pelo chaveiro</Text>
              <Text style={estilos.textoBusca}>Digite o nome. O objeto será salvo na sua conta, na categoria Outros.</Text>
              <TextInput
                accessibilityLabel="Nome do objeto solicitado pelo chaveiro"
                value={nomeCadastroChaveiro}
                onChangeText={definirNomeCadastroChaveiro}
                placeholder="Ex.: Chaves de casa"
                placeholderTextColor={cores.textoSuave}
                maxLength={60}
                returnKeyType="done"
                style={estilos.campoCadastroChaveiro}
              />
              {erroCadastroChaveiro ? <Text style={estilos.erroCadastroChaveiro}>{erroCadastroChaveiro}</Text> : null}
              <Botao título={salvandoCadastroChaveiro ? 'Salvando...' : 'Cadastrar objeto'} aoPressionar={concluirCadastroSolicitado} carregando={salvandoCadastroChaveiro} desativado={!nomeCadastroChaveiro.trim()} />
            </View>
          ) : null}

          {diagnostico ? (
            <View style={estilos.cartaoDiagnostico}>
              <Text style={estilos.tituloBusca}>Conectado: {diagnostico.nome}</Text>
              <Text style={estilos.textoBusca}>Serviços encontrados: {diagnostico.serviços.length}</Text>
              <Botao título={enviandoResumo ? 'Enviando resumo...' : 'Enviar resumo da saída para a tela'} ícone="paper-plane-outline" aoPressionar={enviarResumoParaTela} carregando={enviandoResumo} estilo={{ marginTop: 12 }} />
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
                  <Botao título={localizando ? 'Preparando...' : 'Tocar buzzer (em preparação)'} ícone="volume-high-outline" aoPressionar={() => localizarChaveiro(objeto)} carregando={localizando} desativado estilo={{ marginTop: 10 }} />
                  {objeto.connected ? <Pressable accessibilityRole="button" onPress={() => desconectarDispositivo(objeto)} style={estilos.removerVinculo}><Ionicons name="bluetooth-outline" size={16} color={cores.primario} /><Text style={[estilos.textoRemoverVinculo, { color: cores.primario }]}>Desconectar</Text></Pressable> : null}
                  <Pressable accessibilityRole="button" onPress={() => removerAssociacao(objeto)} style={estilos.removerVinculo}><Ionicons name="unlink-outline" size={16} color={cores.vermelho} /><Text style={estilos.textoRemoverVinculo}>Desassociar dispositivo</Text></Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={estilos.nenhumAssociado}>Para habilitar a detecção por proximidade, associe um chaveiro Bluetooth compatível. A lista de objetos continua disponível sem ele.</Text>
          )}
        </>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
