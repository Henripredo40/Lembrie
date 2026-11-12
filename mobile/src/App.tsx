import estilos from './estilos/App.estilos';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FilaSemConexao } from './utilitarios/filaSemConexao';
import { criarClienteApi } from './servicos/clienteApi';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TelaAutenticacao from './telas/TelaAutenticacao';
import TelaInicio from './telas/TelaInicio';
import TelaObjetos from './telas/TelaObjetos';
import TelaBluetooth, { encerrarConexaoLambrie, habilitarMonitoramentoLambrie, reativarMonitoramentoLambrie } from './telas/TelaBluetooth';
import TelaSaida from './telas/TelaSaida';
import TelaConfiguracoes from './telas/TelaConfiguracoes';
import TelaHistorico from './telas/TelaHistorico';
import TelaMapaRotina from './telas/TelaMapaRotina';
import TelaPerfil from './telas/TelaPerfil';
import TelaAcessoSeguranca from './telas/TelaAcessoSeguranca';
import TelaAssistente from './telas/TelaAssistente';
import { cores } from './tema';

const endereçoDaApi = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? '' : Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
const preferênciasIniciais = { notifications: true, routine_enabled: false, preventive_alerts: true, essential_only: false };
const preferênciaAtiva = (valor) => valor === true || Number(valor) === 1;
function identificarDispositivo() {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return Platform.OS === 'android' ? 'Celular · Android' : 'Celular · iOS';
  }
  if (typeof navigator === 'undefined') return 'Navegador';
  const agente = navigator.userAgent || '';
  const móvel = /Android|iPhone|iPad|Mobile/i.test(agente);
  const sistema = /Android/i.test(agente) ? 'Android' : /iPhone|iPad/i.test(agente) ? 'iOS' : /Windows/i.test(agente) ? 'Windows' : /Mac OS/i.test(agente) ? 'macOS' : /Linux/i.test(agente) ? 'Linux' : 'dispositivo';
  const navegador = /Edg\//i.test(agente) ? 'Edge' : /Firefox\//i.test(agente) ? 'Firefox' : /Chrome\//i.test(agente) ? 'Chrome' : /Safari\//i.test(agente) ? 'Safari' : 'navegador';
  return (móvel ? 'Celular' : 'PC') + ' · ' + navegador + ' (' + sistema + ')';
}

export default function App() {
  const dimensoesJanela = useWindowDimensions();
  const [token, definirToken] = useState(null);
  const [restaurando, definirRestaurando] = useState(true);
  const [tela, definirTela] = useState('inicio');
  const [menuAberto, definirMenuAberto] = useState(false);
  const [objetos, definirObjetos] = useState([]);
  const [eventos, definirEventos] = useState([]);
  const [perfil, definirPerfil] = useState(null);
  const [seguranca, definirSeguranca] = useState(null);
  const [preferências, definirPreferências] = useState(preferênciasIniciais);
  const [categoriaInicial, definirCategoriaInicial] = useState('');
  const [destinoInicial, definirDestinoInicial] = useState('');
  const [busca, definirBusca] = useState('');
  const [carregandoAutenticação, definirCarregandoAutenticação] = useState(false);
  const [atualizando, definirAtualizando] = useState(false);
  const [erroConexão, definirErroConexão] = useState('');
  const [operaçõesPendentes, definirOperaçõesPendentes] = useState(0);
  const [erroSincronização, definirErroSincronização] = useState('');
  const [salvandoPreferências, definirSalvandoPreferências] = useState(false);
  const [saindo, definirSaindo] = useState(false);
  const [notificaçãoWeb, definirNotificaçãoWeb] = useState('');
  const [permissaoLocalizacao, definirPermissaoLocalizacao] = useState<'verificando' | 'permitida' | 'negada'>('verificando');
  const [sugestaoGPS, definirSugestaoGPS] = useState(null);
  const temporizadorNotificação = useRef<any>(null);
  const sessãoConta = useRef<string | null>(null);
  const [idSessãoConta, definirIdSessãoConta] = useState<string | null>(null);
  const localEnviadoNaSessão = useRef<string | null>(null);
  const filaSemConexao = useRef(new FilaSemConexao()).current;
  const sessaoMaisRecente = seguranca?.sessions?.[0];
  const dataUltimoLogin = seguranca?.last_login ? new Date(String(seguranca.last_login).replace(' ', 'T')) : null;
  const textoUltimoLogin = dataUltimoLogin && !Number.isNaN(dataUltimoLogin.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(dataUltimoLogin)
    : 'Consultando último login';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = 'pt-BR';
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    document.title = 'Lembriê — objetos sempre por perto';
    let metaTema = document.querySelector('meta[name="theme-color"]');
    if (!metaTema) {
      metaTema = document.createElement('meta');
      metaTema.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTema);
    }
    metaTema.setAttribute('content', '#16796D');
    const estiloFoco = document.createElement('style');
    estiloFoco.dataset.lembreAcessibilidade = 'true';
    estiloFoco.textContent = ':focus-visible{outline:3px solid #70B8A9!important;outline-offset:3px!important}';
    document.head.appendChild(estiloFoco);
    return () => { estiloFoco.remove(); };
  }, []);

  useEffect(() => () => {
    if (temporizadorNotificação.current) clearTimeout(temporizadorNotificação.current);
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.all([AsyncStorage.getItem('token'), filaSemConexao.carregarEscopo()])
      .then(([valor]) => { if (ativo && valor) definirToken(valor); })
      .catch(() => {})
      .finally(() => { if (ativo) definirRestaurando(false); });
    return () => { ativo = false; };
  }, [filaSemConexao]);

  const chamarApi = useCallback(
    criarClienteApi({ endereco: endereçoDaApi, token, filaSemConexao, aoAtualizarPendentes: definirOperaçõesPendentes }),
    [token, filaSemConexao],
  );

  const idsChaveirosAssociados = objetos.filter((objeto) => objeto.ble_uuid).map((objeto) => String(objeto.id) + ':' + objeto.ble_uuid).join('|');
  useEffect(() => {
    if (!token || Platform.OS === 'web' || !idsChaveirosAssociados) return;
    const primeiro = objetos.find((objeto) => objeto.ble_uuid);
    if (primeiro) void reativarMonitoramentoLambrie(primeiro.ble_uuid, primeiro.id, chamarApi).then((conectado) => {
      definirObjetos((atuais) => atuais.map((item) => String(item.id) === String(primeiro.id) ? { ...item, connected: conectado } : item));
    });
  }, [token, idsChaveirosAssociados, chamarApi]);

  useEffect(() => {
    if (!token) return;
    const inscrição = AppState.addEventListener('change', estado => {
      if (estado !== 'active') return;
      Location.getForegroundPermissionsAsync()
        .then(permissão => definirPermissaoLocalizacao(permissão.status === 'granted' ? 'permitida' : 'negada'))
        .catch(() => definirPermissaoLocalizacao('negada'));
    });
    return () => inscrição.remove();
  }, [token]);

  async function solicitarPermissaoLocalizacao() {
    definirPermissaoLocalizacao('verificando');
    try {
      const permissão = await Location.requestForegroundPermissionsAsync();
      definirPermissaoLocalizacao(permissão.status === 'granted' ? 'permitida' : 'negada');
    } catch {
      definirPermissaoLocalizacao('negada');
    }
  }

  useEffect(() => {
    let ativo = true;
    if (!token) {
      definirPermissaoLocalizacao('verificando');
      definirSugestaoGPS(null);
      return () => { ativo = false; };
    }
    Location.getForegroundPermissionsAsync()
      .then(permissão => {
        if (!ativo) return;
        if (permissão.status === 'granted') definirPermissaoLocalizacao('permitida');
        else solicitarPermissaoLocalizacao();
      })
      .catch(() => { if (ativo) definirPermissaoLocalizacao('negada'); });
    return () => { ativo = false; };
  }, [token]);

  useEffect(() => {
    if (!token || permissaoLocalizacao !== 'permitida') return;
    let ativo = true;
    let ultimaConsulta = 0;
    let assinatura: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5 * 60 * 1000, distanceInterval: 300 },
      posição => {
        if (!ativo || Date.now() - ultimaConsulta < 4 * 60 * 1000) return;
        if (posição.coords.accuracy != null && posição.coords.accuracy > 1200) return;
        ultimaConsulta = Date.now();
        chamarApi('/routine/location', {
          method: 'POST',
          body: JSON.stringify({ latitude: posição.coords.latitude, longitude: posição.coords.longitude }),
        }).then(resultado => {
          if (ativo && resultado.destination) definirSugestaoGPS(resultado);
        }).catch(() => {});
      }
    ).then(resultado => {
      if (ativo) assinatura = resultado;
      else resultado.remove();
    }).catch(() => {});
    return () => { ativo = false; assinatura?.remove(); };
  }, [token, permissaoLocalizacao, chamarApi]);

  const carregarDados = useCallback(async (silencioso = false) => {
    if (!token) return;
    if (!silencioso) definirAtualizando(true);
    try {
      const [objetosNovos, eventosNovos, perfilNovo, preferênciasNovas, segurancaNova] = await Promise.all([
        chamarApi('/objects'),
        chamarApi('/events'),
        chamarApi('/me'),
        chamarApi('/settings'),
        chamarApi('/me/security').catch(() => null),
      ]);
      definirObjetos(Array.isArray(objetosNovos) ? objetosNovos : []);
      definirEventos(Array.isArray(eventosNovos) ? eventosNovos : []);
      definirPerfil(perfilNovo || null);
      definirPreferências({ ...preferênciasIniciais, ...(preferênciasNovas || {}) });
      definirSeguranca(segurancaNova || null);
      definirErroConexão('');
    } catch (falha) {
      definirErroConexão(falha.message || 'Não foi possível atualizar seus dados.');
      if (falha.status === 401) {
        await AsyncStorage.removeItem('token').catch(() => {});
        definirToken(null);
        definirPerfil(null);
        definirSeguranca(null);
        definirObjetos([]);
        definirEventos([]);
        definirErroConexão('Sua sessão terminou. Entre novamente para continuar.');
      }
    } finally {
      definirAtualizando(false);
    }
  }, [token, chamarApi]);

  useEffect(() => {
    if (token && permissaoLocalizacao === 'permitida') carregarDados(true);
  }, [token, permissaoLocalizacao, carregarDados]);

  useEffect(() => {
    if (!token) { definirOperaçõesPendentes(0); return; }
    let ativo = true;
    let sincronizando = false;
    const sincronizar = async () => {
      if (sincronizando || !await filaSemConexao.quantidadePendente()) return;
      sincronizando = true;
      const resultado = await filaSemConexao.sincronizar(token, endereçoDaApi);
      if (ativo) {
        definirOperaçõesPendentes(resultado.pendentes);
        definirErroSincronização(resultado.erro || '');
        if (resultado.sincronizadas > 0 && resultado.pendentes === 0) void carregarDados(true);
      }
      sincronizando = false;
    };
    void sincronizar();
    const intervalo = setInterval(sincronizar, 15000);
    const inscrição = AppState.addEventListener('change', estado => { if (estado === 'active') void sincronizar(); });
    return () => { ativo = false; clearInterval(intervalo); inscrição.remove(); };
  }, [token, filaSemConexao, carregarDados]);

  function notificar(mensagem) {
    if (Platform.OS === 'web') {
      if (temporizadorNotificação.current) clearTimeout(temporizadorNotificação.current);
      definirNotificaçãoWeb(mensagem);
      temporizadorNotificação.current = setTimeout(() => definirNotificaçãoWeb(''), 5000);
      return;
    }
    Alert.alert('Lembriê', mensagem);
  }

  async function aceitarSessão(dados) {
    habilitarMonitoramentoLambrie();
    await AsyncStorage.setItem('token', dados.token);
    if (dados.user?.id != null) await filaSemConexao.definirEscopo(String(dados.user.id));
    if (dados.session_id) await AsyncStorage.setItem('account_session_id', String(dados.session_id));
    definirIdSessãoConta(dados.session_id ? String(dados.session_id) : null);
    definirToken(dados.token);
    definirPerfil(dados.user || null);
    definirSeguranca(null);
    definirTela('inicio');
    definirBusca('');
    definirErroConexão('');
  }

  async function entrar({ email, senha }) {
    if (!email.trim() || !senha) return { erro: 'Informe seu e-mail e sua senha.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { erro: 'Digite um endereço de e-mail válido.' };
    definirCarregandoAutenticação(true);
    try {
      const dados = await chamarApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: senha, device_label: identificarDispositivo() }),
      });
      await aceitarSessão(dados);
      return { ok: true };
    } catch (falha) {
      return { erro: falha.message || 'Não foi possível entrar. Confira seus dados e tente novamente.' };
    } finally {
      definirCarregandoAutenticação(false);
    }
  }

  async function cadastrar({ nome, email, senha }) {
    if (!nome.trim() || !email.trim() || !senha) return { erro: 'Preencha seu nome, e-mail e senha.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { erro: 'Digite um endereço de e-mail válido.' };
    if (senha.length < 6) return { erro: 'A senha precisa ter pelo menos 6 caracteres.' };
    definirCarregandoAutenticação(true);
    try {
      const dados = await chamarApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: nome.trim(), email: email.trim().toLowerCase(), password: senha, device_label: identificarDispositivo() }),
      });
      await aceitarSessão(dados);
      return { ok: true };
    } catch (falha) {
      return { erro: falha.message || 'Não foi possível criar a conta. Confira os dados e tente novamente.' };
    } finally {
      definirCarregandoAutenticação(false);
    }
  }

  async function recuperarSenha(dados) {
    definirCarregandoAutenticação(true);
    try {
      const resultado = await chamarApi('/auth/' + (dados.codigo ? 'reset-password' : 'forgot-password'), {
        method: 'POST',
        body: JSON.stringify(dados.codigo
          ? { email: dados.email, code: dados.codigo, password: dados.senha }
          : { email: dados.email }),
      });
      return { ok: true, mensagem: resultado.message };
    } catch (falha) {
      return { erro: falha.message };
    } finally {
      definirCarregandoAutenticação(false);
    }
  }

  async function recuperarSenhaGoogle({ idToken, senha }) {
    definirCarregandoAutenticação(true);
    try {
      const resultado = await chamarApi('/auth/google/reset-password', {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken, password: senha }),
      });
      return { ok: true, mensagem: resultado.message };
    } catch (falha) {
      return { erro: falha.message || 'Não foi possível redefinir a senha com o Google.' };
    } finally {
      definirCarregandoAutenticação(false);
    }
  }

  async function salvarPerfil(dados) {
    try {
      const resposta = await chamarApi('/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: dados.nome, email: dados.email, email_verification_code: dados.codigoEmail }),
      });
      const usuario = resposta?.user;
      const nomeEsperado = String(dados.nome || '').trim();
      const emailEsperado = String(dados.email || '').trim().toLowerCase();
      if (resposta?.ok !== true || !usuario || usuario.name !== nomeEsperado || String(usuario.email || '').toLowerCase() !== emailEsperado) {
        return { erro: 'O servidor não confirmou que os dados foram salvos. Tente novamente.' };
      }
      definirPerfil(usuario);
      return { ok: true, emailVerified: resposta.email_verified === true };
    } catch (falha) {
      return { erro: falha.message };
    }
  }

  async function solicitarVerificacaoEmail(email) {
    try {
      const resultado = await chamarApi('/me/email-verification/send', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return { ok: true, mensagem: resultado.message, jaAtual: resultado.already_current === true };
    } catch (falha) {
      return { erro: falha.message };
    }
  }

  async function alterarSenha(dados) {
    try {
      await chamarApi('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: dados.senhaAtual, new_password: dados.novaSenha }),
      });
      return { ok: true };
    } catch (falha) {
      return { erro: falha.message };
    }
  }

  function abrirTela(destino: string, opções: { categoria?: string; destino?: string } = {}) {
    if (destino === 'objetos') definirCategoriaInicial(opções.categoria || '');
    if (Object.prototype.hasOwnProperty.call(opções, 'destino')) definirDestinoInicial(opções.destino || '');
    definirTela(destino);
    definirMenuAberto(false);
  }

  async function sairDaConta() {
    const confirmar = async () => {
      definirSaindo(true);
      await encerrarConexaoLambrie();
      if (sessãoConta.current) await chamarApi('/sessions/end', { method: 'POST', body: JSON.stringify({ session_id: sessãoConta.current }) }).catch(() => {});
      sessãoConta.current = null;
      definirIdSessãoConta(null);
      await AsyncStorage.removeItem('account_session_id').catch(() => {});
      await AsyncStorage.removeItem('token').catch(() => {});
      definirToken(null);
      definirPerfil(null);
      definirSeguranca(null);
      definirObjetos([]);
      definirEventos([]);
      definirPreferências(preferênciasIniciais);
      definirTela('inicio');
      definirMenuAberto(false);
      definirSaindo(false);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair da sua conta?')) await confirmar();
      return;
    }
    Alert.alert('Sair da conta?', 'Você precisará entrar novamente para ver seus objetos.', [
      { text: 'Continuar no app', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: confirmar },
    ]);
  }

  useEffect(() => {
    if (!token) { sessãoConta.current = null; return; }
    let ativo = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    let started = false;
    let aguardando = false;
    const visível = () => Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState === 'visible';
    const atualizarSessão = async () => {
      if (!ativo || aguardando || !visível() || !sessãoConta.current) return;
      aguardando = true;
      try { await chamarApi('/sessions/heartbeat', { method: 'POST', body: JSON.stringify({ session_id: sessãoConta.current }) }); }
      catch {} finally { aguardando = false; }
    };
    const iniciar = async () => {
      try {
        let idSessão = await AsyncStorage.getItem('account_session_id');
        if (!idSessão) {
          const criada = await chamarApi('/sessions/start', { method: 'POST', body: JSON.stringify({ device_label: identificarDispositivo() }) });
          idSessão = criada.session_id;
          if (idSessão) await AsyncStorage.setItem('account_session_id', String(idSessão));
        }
        if (!ativo || !idSessão) return;
        sessãoConta.current = idSessão;
        definirIdSessãoConta(idSessão);
        started = true;
        await atualizarSessão();
        timer = setInterval(atualizarSessão, 60_000);
      } catch {}
    };
    void iniciar();
    const inscrição = AppState.addEventListener('change', estado => { if (estado === 'active') void atualizarSessão(); else void atualizarSessão(); });
    const visibilidade = () => { if (visível()) void atualizarSessão(); else void atualizarSessão(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', visibilidade);
    return () => {
      ativo = false;
      if (timer) clearInterval(timer);
      inscrição.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibilidade);
      if (started && sessãoConta.current) void chamarApi('/sessions/heartbeat', { method: 'POST', body: JSON.stringify({ session_id: sessãoConta.current }) }).catch(() => {});
    };
  }, [token, chamarApi]);

  useEffect(() => {
    if (!token || permissaoLocalizacao !== 'permitida' || !idSessãoConta || localEnviadoNaSessão.current === idSessãoConta) return;
    let ativo = true;
    localEnviadoNaSessão.current = idSessãoConta;
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(posição => {
        if (!ativo) return;
        if (posição.coords.accuracy != null && posição.coords.accuracy > 2000) {
          if (localEnviadoNaSessão.current === idSessãoConta) localEnviadoNaSessão.current = null;
          return;
        }
        return chamarApi('/sessions/location', { method: 'POST', body: JSON.stringify({ session_id: idSessãoConta, latitude: posição.coords.latitude, longitude: posição.coords.longitude }) });
      })
      .catch(() => { if (localEnviadoNaSessão.current === idSessãoConta) localEnviadoNaSessão.current = null; });
    return () => { ativo = false; };
  }, [token, permissaoLocalizacao, idSessãoConta, chamarApi]);

  async function salvarPreferências(novas) {
    const anteriores = preferências;
    definirPreferências(novas);
    definirSalvandoPreferências(true);
    try {
      const salvas = await chamarApi('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          notifications: novas.notifications,
          preventive_alerts: novas.preventive_alerts,
          essential_only: novas.essential_only,
          routine_enabled: novas.routine_enabled,
        }),
      });
      definirPreferências({ ...novas, ...(salvas || {}) });
    } catch (falha) {
      definirPreferências(anteriores);
      notificar(falha.message || 'Não foi possível salvar a preferência.');
    } finally {
      definirSalvandoPreferências(false);
    }
  }

  if (restaurando) {
    return <SafeAreaProvider><SafeAreaView style={estilos.carregandoInicial}><StatusBar style="dark" /><ActivityIndicator size="large" color={cores.primario} /><Text style={estilos.textoCarregando}>Abrindo seus dados...</Text></SafeAreaView></SafeAreaProvider>;
  }

  if (!token) {
    return <SafeAreaProvider><SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={estilos.raiz}><StatusBar style="dark" /><TelaAutenticacao entrar={entrar} cadastrar={cadastrar} recuperarSenha={recuperarSenha} recuperarSenhaGoogle={recuperarSenhaGoogle} carregando={carregandoAutenticação} /></SafeAreaView></SafeAreaProvider>;
  }

  if (permissaoLocalizacao !== 'permitida') {
    return <SafeAreaProvider><SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={estilos.raiz}><StatusBar style="dark" /><View style={{ flex: 1, justifyContent: 'center', padding: 24, maxWidth: 520, width: '100%', alignSelf: 'center', gap: 14 }}>
      <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: cores.primarioClaro, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="location" size={29} color={cores.primario} /></View>
      <Text style={{ color: cores.texto, fontSize: 24, fontWeight: '900' }}>Localização necessária</Text>
      <Text style={{ color: cores.textoSuave, fontSize: 15, lineHeight: 23 }}>A localização é necessária para usar o Lembriê. O GPS funciona enquanto o app ou site está aberto; não rastreamos em segundo plano. Para mostrar o último acesso, guardamos apenas cidade e estado quando conseguimos identificar o local, sem salvar as coordenadas GPS desse acesso. Para sugestões de rotina, nomes aproximados de lugares frequentes podem ser guardados por até 90 dias. Você pode rever as permissões nas configurações do aparelho ou do navegador.</Text>
      {permissaoLocalizacao === 'verificando' ? <ActivityIndicator size="small" color={cores.primario} /> : <Pressable accessibilityRole="button" onPress={solicitarPermissaoLocalizacao} style={{ minHeight: 50, paddingHorizontal: 16, borderRadius: 14, backgroundColor: cores.primario, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: cores.branco, fontWeight: '900' }}>Permitir localização e continuar</Text></Pressable>}
      {permissaoLocalizacao === 'negada' ? <Pressable accessibilityRole="button" onPress={() => { if (Platform.OS !== 'web') Linking.openSettings(); }}><Text style={{ color: cores.primario, fontSize: 13, fontWeight: '800' }}>{Platform.OS === 'web' ? 'Altere a permissão de localização nas configurações do site no navegador e tente novamente.' : 'Abrir configurações do aparelho'}</Text></Pressable> : null}
      <Pressable accessibilityRole="button" onPress={sairDaConta} style={{ paddingVertical: 12 }}><Text style={{ color: cores.textoSuave, textAlign: 'center' }}>Sair da conta</Text></Pressable>
    </View></SafeAreaView></SafeAreaProvider>;
  }

  let conteúdo;
  if (tela === 'inicio') {
    conteúdo = <TelaInicio perfil={perfil} seguranca={seguranca} mostrarResumoLogin={false} mostrarAtalhosFlutuantes={dimensoesJanela.width >= 760} compacto={Platform.OS !== 'web' && dimensoesJanela.width < 760} objetos={objetos} busca={busca} definirBusca={definirBusca} abrirTela={abrirTela} atualizar={() => carregarDados(false)} atualizando={atualizando} erroConexao={erroConexão} mostrarAlertas={preferênciaAtiva(preferências.preventive_alerts)} api={chamarApi} rotinaAtiva={preferênciaAtiva(preferências.routine_enabled)} sugestaoGPS={sugestaoGPS} />;
  } else if (tela === 'objetos') {
    conteúdo = <TelaObjetos objetos={objetos} definirObjetos={definirObjetos} api={chamarApi} categoriaInicial={categoriaInicial} notificar={notificar} />;
  } else if (tela === 'bluetooth') {
    conteúdo = <TelaBluetooth objetos={objetos} definirObjetos={definirObjetos} api={chamarApi} notificar={notificar} abrirObjetos={() => abrirTela('objetos')} />;
  } else if (tela === 'saida') {
    conteúdo = <TelaSaida objetos={objetos} api={chamarApi} notificar={notificar} atualizarDados={() => carregarDados(true)} somenteEssenciais={preferênciaAtiva(preferências.essential_only)} destinoInicial={destinoInicial} />;
  } else if (tela === 'mapa') {
    conteúdo = <TelaMapaRotina api={chamarApi} rotinaAtiva={preferênciaAtiva(preferências.routine_enabled)} abrirObjetos={() => abrirTela('objetos')} notificar={notificar} atualizarDados={() => carregarDados(true)} />;
  } else if (tela === 'perfil') {
    conteúdo = <TelaPerfil perfil={perfil} salvarPerfil={salvarPerfil} solicitarVerificacaoEmail={solicitarVerificacaoEmail} alterarSenha={alterarSenha} recuperarSenha={recuperarSenha} notificar={notificar} />;
  } else if (tela === 'acesso') {
    conteúdo = <TelaAcessoSeguranca api={chamarApi} segurancaInicial={seguranca} />;
  } else if (tela === 'assistente') {
    conteúdo = <TelaAssistente api={chamarApi} />;
  } else if (tela === 'historico') {
    conteúdo = <TelaHistorico eventos={eventos} />;
  } else {
    conteúdo = <TelaConfiguracoes perfil={perfil} configuracoes={preferências} salvarConfiguracoes={salvarPreferências} abrirPerfil={() => abrirTela('perfil')} salvando={salvandoPreferências} saindo={saindo} sairDaConta={sairDaConta} />;
  }

  const título = {
    inicio: 'Início', objetos: 'Meus objetos', bluetooth: 'Bluetooth', saida: 'Antes de sair',
    historico: 'Histórico', configuracoes: 'Configurações', mapa: 'Mapa e rotina', perfil: 'Meu perfil', acesso: 'Acesso e segurança', assistente: 'Ajuda com IA',
  }[tela] || 'Lembriê';

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'left', 'right']} style={estilos.raiz}>
        <StatusBar style="dark" />
        <View style={[estilos.cabecalho, dimensoesJanela.width < 760 && estilos.cabecalhoCompacto]}>
          <View style={estilos.marcaCabecalho}><MaterialCommunityIcons name="map-marker-check" size={22} color={cores.branco} /></View>
          <View style={estilos.textosCabecalho}><Text style={estilos.nomeApp}>LEMBRIÊ</Text><Text numberOfLines={1} ellipsizeMode="tail" style={estilos.tituloCabecalho}>{título}</Text></View>
          {tela === 'inicio' ? <Pressable accessibilityRole="button" accessibilityLabel={'Abrir detalhes do último login: ' + textoUltimoLogin} onPress={() => abrirTela('acesso')} style={[estilos.resumoLoginCabecalho, dimensoesJanela.width < 760 && estilos.resumoLoginCabecalhoCompacto]}>
            <View style={[estilos.iconeResumoLoginCabecalho, dimensoesJanela.width < 760 && estilos.iconeResumoLoginCabecalhoCompacto]}><Ionicons name="shield-checkmark" size={dimensoesJanela.width < 760 ? 15 : 19} color={cores.primario} /></View>
            <View style={estilos.textoResumoLoginCabecalho}>
              <Text style={estilos.rotuloResumoLoginCabecalho}>ÚLTIMO LOGIN</Text>
              <Text numberOfLines={1} style={[estilos.dataResumoLoginCabecalho, dimensoesJanela.width < 760 && estilos.dataResumoLoginCabecalhoCompacto]}>{textoUltimoLogin}</Text>
              {dimensoesJanela.width >= 760 && sessaoMaisRecente?.device_label ? <Text numberOfLines={1} style={estilos.dispositivoResumoLoginCabecalho}>{sessaoMaisRecente.device_label}{sessaoMaisRecente.location_label ? ' · ' + sessaoMaisRecente.location_label : ''}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={dimensoesJanela.width < 760 ? 14 : 17} color={cores.primario} />
          </Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Recarregar página e dados" onPress={() => {
            if (Platform.OS === 'web') window.location.reload();
            else void carregarDados(false);
          }} hitSlop={9} style={[estilos.botaoAtualizar, dimensoesJanela.width < 760 && estilos.botaoAtualizarCompacto]}>
            {atualizando ? <ActivityIndicator size="small" color={cores.primario} /> : <Ionicons name="refresh-outline" size={20} color={cores.primario} />}
          </Pressable>
        </View>

        {erroConexão && tela !== 'inicio' ? (
          <Pressable accessibilityRole="button" onPress={() => carregarDados(false)} style={estilos.faixaErro}>
            <Ionicons name="cloud-offline-outline" size={17} color={cores.laranja} />
            <Text style={estilos.textoFaixaErro} numberOfLines={2}>{erroConexão} Toque para tentar atualizar.</Text>
          </Pressable>
        ) : null}

        {operaçõesPendentes > 0 ? (
          <View accessibilityRole="status" style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 16, marginTop: 8, padding: 11, borderRadius: 12, backgroundColor: '#FFF4D6' }}>
            <Ionicons name="cloud-upload-outline" size={18} color="#8A5B00" />
            <Text style={{ flex: 1, color: '#684500', fontSize: 13, fontWeight: '700' }}>{operaçõesPendentes} alteração(ões) salva(s) neste aparelho aguardando envio.{erroSincronização ? ' ' + erroSincronização : ''}</Text>
          </View>
        ) : null}

          {conteúdo}

          {notificaçãoWeb ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={estilos.notificaçãoWeb}>
            <Ionicons name="information-circle" size={21} color={cores.primario} />
            <Text style={estilos.textoNotificaçãoWeb}>{notificaçãoWeb}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso" onPress={() => { if (temporizadorNotificação.current) clearTimeout(temporizadorNotificação.current); definirNotificaçãoWeb(''); }} style={estilos.fecharNotificaçãoWeb}><Ionicons name="close" size={18} color={cores.textoSuave} /></Pressable>
          </View> : null}

        <SafeAreaView edges={['bottom']} style={estilos.areaNavegação}>
          <View style={estilos.navegação}>
            <ItemNavegação ativo={tela === 'inicio'} ícone="home-outline" íconeAtivo="home" rótulo="Início" aoPressionar={() => abrirTela('inicio')} />
            <ItemNavegação ativo={tela === 'objetos'} ícone="cube-outline" íconeAtivo="cube" rótulo="Objetos" aoPressionar={() => abrirTela('objetos')} />
            <ItemNavegação ativo={tela === 'bluetooth'} ícone="bluetooth-outline" íconeAtivo="bluetooth" rótulo="Bluetooth" aoPressionar={() => abrirTela('bluetooth')} />
            <ItemNavegação ativo={tela === 'saida'} ícone="checkbox-outline" íconeAtivo="checkbox" rótulo="Saída" aoPressionar={() => abrirTela('saida')} />
            <ItemNavegação ativo={menuAberto || ['mapa', 'historico', 'configuracoes', 'perfil', 'acesso', 'assistente'].includes(tela)} ícone="grid-outline" íconeAtivo="grid" rótulo="Mais" aoPressionar={() => definirMenuAberto(true)} />
          </View>
        </SafeAreaView>

        <Modal visible={menuAberto} animationType="slide" transparent onRequestClose={() => definirMenuAberto(false)}>
          <View style={estilos.fundoMenu}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={() => definirMenuAberto(false)} style={estilos.fundoClicável} />
            <View style={estilos.painelMenu}>
              <View style={estilos.alçaMenu} />
              <View style={estilos.cabeçalhoMenu}><View><Text style={estilos.tituloMenu}>Mais opções</Text><Text style={estilos.subtituloMenu}>{perfil?.name || perfil?.email || 'Sua conta'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={() => definirMenuAberto(false)} style={estilos.fecharMenu}><Ionicons name="close" size={20} color={cores.texto} /></Pressable></View>
              <View style={estilos.listaMenu}>
                <ItemMenu ativo={tela === 'mapa'} ícone="map-outline" título="Mapa e rotina" texto="Pesquise destinos e planeje o que levar" aoPressionar={() => abrirTela('mapa')} />
                <ItemMenu ativo={tela === 'assistente'} ícone="sparkles-outline" título="Ajuda" texto="Tire dúvidas e receba orientações" aoPressionar={() => abrirTela('assistente')} />
                <ItemMenu ativo={tela === 'historico'} ícone="time-outline" título="Histórico" texto="Atividades recentes" aoPressionar={() => abrirTela('historico')} />
                <ItemMenu ativo={tela === 'acesso'} ícone="shield-checkmark-outline" título="Acesso e segurança" texto="Confira o último login da conta" aoPressionar={() => abrirTela('acesso')} />
                <ItemMenu ativo={tela === 'perfil'} ícone="person-circle-outline" título="Meu perfil" texto="Atualize seus dados e senha" aoPressionar={() => abrirTela('perfil')} />
                <ItemMenu ativo={tela === 'configuracoes'} ícone="settings-outline" título="Configurações" texto="Preferências e conta" aoPressionar={() => abrirTela('configuracoes')} />
              </View>
              <Pressable accessibilityRole="button" onPress={sairDaConta} style={estilos.sairMenu}><Ionicons name="log-out-outline" size={19} color={cores.vermelho} /><Text style={estilos.textoSairMenu}>Sair da conta</Text></Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ItemNavegação({ ativo, ícone, íconeAtivo, rótulo, aoPressionar }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: ativo }} onPress={aoPressionar} style={estilos.itemNavegação}>
      <View style={[estilos.iconeNavegação, ativo && estilos.iconeNavegaçãoAtiva]}><Ionicons name={ativo ? íconeAtivo : ícone} size={20} color={ativo ? cores.primario : '#7C8493'} /></View>
      <Text numberOfLines={1} ellipsizeMode="tail" style={[estilos.textoNavegação, ativo && estilos.textoNavegaçãoAtivo]}>{rótulo}</Text>
    </Pressable>
  );
}

function ItemMenu({ ativo, ícone, título, texto, aoPressionar }) {
  return (
    <Pressable accessibilityRole="button" onPress={aoPressionar} style={[estilos.itemMenu, ativo && estilos.itemMenuAtivo]}>
      <View style={estilos.iconeItemMenu}><Ionicons name={ícone} size={20} color={cores.primario} /></View>
      <View style={{ flex: 1 }}><Text style={estilos.tituloItemMenu}>{título}</Text><Text style={estilos.textoItemMenu}>{texto}</Text></View>
      <Ionicons name="chevron-forward" size={17} color="#98A2B3" />
    </Pressable>
  );
}
