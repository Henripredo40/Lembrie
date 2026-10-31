import estilos from './estilos/App.estilos';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable,  Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TelaAutenticacao from './telas/TelaAutenticacao';
import TelaInicio from './telas/TelaInicio';
import TelaObjetos from './telas/TelaObjetos';
import TelaBluetooth from './telas/TelaBluetooth';
import TelaSaida from './telas/TelaSaida';
import TelaConfiguracoes from './telas/TelaConfiguracoes';
import TelaHistorico from './telas/TelaHistorico';
import TelaMapaRotina from './telas/TelaMapaRotina';
import TelaPerfil from './telas/TelaPerfil';
import { cores } from './tema';

const endereçoDaApi = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? '' : Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
const preferênciasIniciais = { notifications: true, routine_enabled: false, preventive_alerts: true, essential_only: false };
const preferênciaAtiva = (valor) => valor === true || Number(valor) === 1;

export default function App() {
  const [token, definirToken] = useState(null);
  const [restaurando, definirRestaurando] = useState(true);
  const [tela, definirTela] = useState('inicio');
  const [menuAberto, definirMenuAberto] = useState(false);
  const [objetos, definirObjetos] = useState([]);
  const [eventos, definirEventos] = useState([]);
  const [perfil, definirPerfil] = useState(null);
  const [preferências, definirPreferências] = useState(preferênciasIniciais);
  const [categoriaInicial, definirCategoriaInicial] = useState('');
  const [destinoInicial, definirDestinoInicial] = useState('');
  const [busca, definirBusca] = useState('');
  const [carregandoAutenticação, definirCarregandoAutenticação] = useState(false);
  const [atualizando, definirAtualizando] = useState(false);
  const [erroConexão, definirErroConexão] = useState('');
  const [salvandoPreferências, definirSalvandoPreferências] = useState(false);
  const [saindo, definirSaindo] = useState(false);
  const [notificaçãoWeb, definirNotificaçãoWeb] = useState('');
  const temporizadorNotificação = useRef<any>(null);

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
    AsyncStorage.getItem('token')
      .then((valor) => { if (ativo && valor) definirToken(valor); })
      .catch(() => {})
      .finally(() => { if (ativo) definirRestaurando(false); });
    return () => { ativo = false; };
  }, []);

  const chamarApi = useCallback(async (caminho: string, opções: RequestInit = {}): Promise<any> => {
    let resposta;
    try {
      resposta = await fetch(endereçoDaApi + caminho, {
        ...opções,
        headers: {
          ...(opções.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(opções.headers || {}),
        },
      });
    } catch (falha) {
      throw new Error('Não consegui acessar o servidor. Verifique a internet e tente novamente.');
    }

    const texto = await resposta.text();
    let dados: any = {};
    try { dados = texto ? JSON.parse(texto) : {}; } catch (falha) { dados = { message: texto }; }
    if (!resposta.ok) {
      const erro = Object.assign(new Error(dados.message || dados.error || 'Não foi possível concluir. Tente novamente.'), { status: resposta.status });
      throw erro;
    }
    return dados;
  }, [token]);

  const carregarDados = useCallback(async (silencioso = false) => {
    if (!token) return;
    if (!silencioso) definirAtualizando(true);
    try {
      const [objetosNovos, eventosNovos, perfilNovo, preferênciasNovas] = await Promise.all([
        chamarApi('/objects'),
        chamarApi('/events'),
        chamarApi('/me'),
        chamarApi('/settings'),
      ]);
      definirObjetos(Array.isArray(objetosNovos) ? objetosNovos : []);
      definirEventos(Array.isArray(eventosNovos) ? eventosNovos : []);
      definirPerfil(perfilNovo || null);
      definirPreferências({ ...preferênciasIniciais, ...(preferênciasNovas || {}) });
      definirErroConexão('');
    } catch (falha) {
      definirErroConexão(falha.message || 'Não foi possível atualizar seus dados.');
      if (falha.status === 401) {
        await AsyncStorage.removeItem('token').catch(() => {});
        definirToken(null);
        definirPerfil(null);
        definirObjetos([]);
        definirEventos([]);
        definirErroConexão('Sua sessão terminou. Entre novamente para continuar.');
      }
    } finally {
      definirAtualizando(false);
    }
  }, [token, chamarApi]);

  useEffect(() => {
    if (token) carregarDados(true);
  }, [token, carregarDados]);

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
    await AsyncStorage.setItem('token', dados.token);
    definirToken(dados.token);
    definirPerfil(dados.user || null);
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
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: senha }),
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
        body: JSON.stringify({ name: nome.trim(), email: email.trim().toLowerCase(), password: senha }),
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
      await AsyncStorage.removeItem('token').catch(() => {});
      definirToken(null);
      definirPerfil(null);
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

  let conteúdo;
  if (tela === 'inicio') {
    conteúdo = <TelaInicio perfil={perfil} objetos={objetos} eventos={eventos} busca={busca} definirBusca={definirBusca} abrirTela={abrirTela} atualizar={() => carregarDados(false)} atualizando={atualizando} erroConexao={erroConexão} mostrarAlertas={preferênciaAtiva(preferências.preventive_alerts)} />;
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
  } else if (tela === 'historico') {
    conteúdo = <TelaHistorico eventos={eventos} />;
  } else {
    conteúdo = <TelaConfiguracoes perfil={perfil} configuracoes={preferências} salvarConfiguracoes={salvarPreferências} abrirPerfil={() => abrirTela('perfil')} salvando={salvandoPreferências} saindo={saindo} sairDaConta={sairDaConta} />;
  }

  const título = {
    inicio: 'Início', objetos: 'Meus objetos', bluetooth: 'Bluetooth', saida: 'Antes de sair',
    historico: 'Histórico', configuracoes: 'Configurações', mapa: 'Mapa e rotina', perfil: 'Meu perfil',
  }[tela] || 'Lembriê';

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'left', 'right']} style={estilos.raiz}>
        <StatusBar style="dark" />
        <View style={estilos.cabecalho}>
          <View style={estilos.marcaCabecalho}><MaterialCommunityIcons name="map-marker-check" size={22} color={cores.branco} /></View>
          <View style={estilos.textosCabecalho}><Text style={estilos.nomeApp}>LEMBRIÊ</Text><Text numberOfLines={1} ellipsizeMode="tail" style={estilos.tituloCabecalho}>{título}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Atualizar dados" onPress={() => carregarDados(false)} hitSlop={9} style={estilos.botaoAtualizar}>
            {atualizando ? <ActivityIndicator size="small" color={cores.primario} /> : <Ionicons name="refresh-outline" size={20} color={cores.primario} />}
          </Pressable>
        </View>

        {erroConexão && tela !== 'inicio' ? (
          <Pressable accessibilityRole="button" onPress={() => carregarDados(false)} style={estilos.faixaErro}>
            <Ionicons name="cloud-offline-outline" size={17} color={cores.laranja} />
            <Text style={estilos.textoFaixaErro} numberOfLines={2}>{erroConexão} Toque para tentar atualizar.</Text>
          </Pressable>
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
            <ItemNavegação ativo={menuAberto || ['mapa', 'historico', 'configuracoes', 'perfil'].includes(tela)} ícone="grid-outline" íconeAtivo="grid" rótulo="Mais" aoPressionar={() => definirMenuAberto(true)} />
          </View>
        </SafeAreaView>

        <Modal visible={menuAberto} animationType="slide" transparent onRequestClose={() => definirMenuAberto(false)}>
          <View style={estilos.fundoMenu}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={() => definirMenuAberto(false)} style={estilos.fundoClicável} />
            <View style={estilos.painelMenu}>
              <View style={estilos.alçaMenu} />
              <View style={estilos.cabeçalhoMenu}><View><Text style={estilos.tituloMenu}>Mais opções</Text><Text style={estilos.subtituloMenu}>{perfil?.name || perfil?.email || 'Sua conta'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={() => definirMenuAberto(false)} style={estilos.fecharMenu}><Ionicons name="close" size={20} color={cores.texto} /></Pressable></View>
              <View style={estilos.listaMenu}>
                <ItemMenu ativo={tela === 'mapa'} ícone="map-outline" título="Mapa e rotina" texto="Planeje um destino e seus itens" aoPressionar={() => abrirTela('mapa')} />
                <ItemMenu ativo={tela === 'historico'} ícone="time-outline" título="Histórico" texto="Atividades recentes" aoPressionar={() => abrirTela('historico')} />
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
