import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, CampoTexto } from '../componentes/Elementos';
import { cores } from '../tema';
import estilos from '../estilos/TelaPerfil.estilos';
import { codigoEmailValido, emailValido, senhaTemTamanhoMinimo, senhasIguais } from '../utils/validacaoConta';

export default function TelaPerfil({ perfil, salvarPerfil, solicitarVerificacaoEmail, alterarSenha, recuperarSenha, notificar }) {
  const [nome, definirNome] = useState(perfil?.name || '');
  const [email, definirEmail] = useState(perfil?.email || '');
  const [senhaAtual, definirSenhaAtual] = useState('');
  const [novaSenha, definirNovaSenha] = useState('');
  const [confirmarSenha, definirConfirmarSenha] = useState('');
  const [codigoRecuperacao, definirCodigoRecuperacao] = useState('');
  const [recuperacaoEnviada, definirRecuperacaoEnviada] = useState(false);
  const [recuperandoSenha, definirRecuperandoSenha] = useState(false);
  const [mostrarSenhas, definirMostrarSenhas] = useState(false);
  const [salvandoPerfil, definirSalvandoPerfil] = useState(false);
  const [verificacaoEmailPendente, definirVerificacaoEmailPendente] = useState(false);
  const [codigoEmail, definirCodigoEmail] = useState('');
  const [salvandoSenha, definirSalvandoSenha] = useState(false);
  const [erroPerfil, definirErroPerfil] = useState('');
  const [erroSenha, definirErroSenha] = useState('');

  useEffect(() => {
    if (!perfil) return;
    definirNome(perfil.name || '');
    definirEmail(perfil.email || '');
  }, [perfil?.id, perfil?.name, perfil?.email]);

  async function salvarDados() {
    definirErroPerfil('');
    const nomeNormalizado = nome.trim();
    const emailNormalizado = email.trim().toLowerCase();
    const letrasNoNome = nomeNormalizado.match(/\p{L}/gu) || [];
    if (letrasNoNome.length < 2 || !/^[\p{L}\p{M} .'-]+$/u.test(nomeNormalizado)) {
      return definirErroPerfil('Informe um nome válido com pelo menos duas letras.');
    }
    if (!emailValido(emailNormalizado)) return definirErroPerfil('Digite um e-mail válido, como nome@exemplo.com.');
    definirSalvandoPerfil(true);
    try {
      let emailMudou = emailNormalizado !== String(perfil?.email || '').trim().toLowerCase();
      if (emailMudou && !verificacaoEmailPendente) {
        const envio = await solicitarVerificacaoEmail(emailNormalizado);
        if (envio?.erro) return definirErroPerfil(envio.erro);
        if (envio?.jaAtual) {
          emailMudou = false;
          definirVerificacaoEmailPendente(false);
        } else {
          definirVerificacaoEmailPendente(true);
          definirCodigoEmail('');
          notificar('Solicitamos o envio de um código para o novo e-mail. Só será alterado depois que você digitar o código recebido.');
          return;
        }
      }
      if (emailMudou && !/^\d{6}$/.test(codigoEmail)) {
        return definirErroPerfil('Digite o código de 6 números enviado para confirmar o novo e-mail.');
      }
      const resultado = await salvarPerfil({ nome: nomeNormalizado, email: emailNormalizado, codigoEmail: emailMudou ? codigoEmail : '' });
      if (!resultado?.ok) return definirErroPerfil(resultado?.erro || 'O servidor não confirmou que os dados foram salvos.');
      definirVerificacaoEmailPendente(false);
      definirCodigoEmail('');
      notificar(resultado.emailVerified ? 'E-mail confirmado e perfil salvo com sucesso.' : 'Seus dados foram salvos com sucesso.');
    } catch (falha) {
      definirErroPerfil(falha.message || 'Não foi possível confirmar o salvamento dos dados.');
    } finally {
      definirSalvandoPerfil(false);
    }
  }

  function atualizarEmail(valor) {
    if (verificacaoEmailPendente && valor.trim().toLowerCase() !== email.trim().toLowerCase()) {
      definirVerificacaoEmailPendente(false);
      definirCodigoEmail('');
    }
    definirEmail(valor);
  }

  async function reenviarCodigoEmail() {
    definirErroPerfil('');
    const emailNormalizado = email.trim().toLowerCase();
    const resultado = await solicitarVerificacaoEmail(emailNormalizado);
    if (resultado?.erro) definirErroPerfil(resultado.erro);
    else notificar(resultado?.mensagem || 'Novo código enviado.');
  }

  async function salvarNovaSenha() {
    definirErroSenha('');
    if (!senhaAtual) return definirErroSenha('Digite sua senha atual.');
    if (!senhaTemTamanhoMinimo(novaSenha)) return definirErroSenha('A nova senha precisa ter pelo menos 6 caracteres.');
    if (!senhasIguais(novaSenha, confirmarSenha)) return definirErroSenha('A confirmação não corresponde à nova senha.');
    definirSalvandoSenha(true);
    const resultado = await alterarSenha({ senhaAtual, novaSenha });
    definirSalvandoSenha(false);
    if (resultado.erro) return definirErroSenha(resultado.erro);
    definirSenhaAtual('');
    definirNovaSenha('');
    definirConfirmarSenha('');
    notificar('Senha alterada com sucesso.');
  }

  async function enviarCodigoRecuperacao() {
    definirErroSenha('');
    definirRecuperandoSenha(true);
    const resultado = await recuperarSenha({ email: perfil?.email || email });
    definirRecuperandoSenha(false);
    if (resultado.erro) return definirErroSenha(resultado.erro);
    definirRecuperacaoEnviada(true);
    notificar(resultado.mensagem || 'Código de recuperação enviado. Confira seu e-mail.');
  }

  async function redefinirComCodigo() {
    definirErroSenha('');
    if (!codigoEmailValido(codigoRecuperacao)) return definirErroSenha('Digite o código de 6 números enviado ao seu e-mail.');
    if (!senhaTemTamanhoMinimo(novaSenha)) return definirErroSenha('A nova senha precisa ter pelo menos 6 caracteres.');
    if (!senhasIguais(novaSenha, confirmarSenha)) return definirErroSenha('A confirmação não corresponde à nova senha.');
    definirRecuperandoSenha(true);
    const resultado = await recuperarSenha({ email: perfil?.email || email, codigo: codigoRecuperacao, senha: novaSenha });
    definirRecuperandoSenha(false);
    if (resultado.erro) return definirErroSenha(resultado.erro);
    definirSenhaAtual('');
    definirNovaSenha('');
    definirConfirmarSenha('');
    definirCodigoRecuperacao('');
    definirRecuperacaoEnviada(false);
    notificar(resultado.mensagem || 'Senha redefinida com sucesso.');
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={estilos.sobretitulo}>CONTA</Text>
      <Text style={estilos.titulo}>Meu perfil</Text>
      <Text style={estilos.subtitulo}>Mantenha seus dados de acesso atualizados.</Text>
      {!perfil ? <Text style={estilos.textoCarregando}>Carregando os dados da sua conta…</Text> : null}
      <View style={estilos.avatar}><Text style={estilos.letra}>{(nome || 'L').charAt(0).toLocaleUpperCase('pt-BR')}</Text></View>
      <View style={estilos.cartao}>
        <CampoTexto rótulo="Nome" value={nome} onChangeText={definirNome} placeholder="Seu nome" autoCapitalize="words" maxLength={120} />
        <CampoTexto rótulo="E-mail" value={email} onChangeText={atualizarEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        {verificacaoEmailPendente ? <>
          <Text style={estilos.ajudaVerificacaoEmail}>Digite o código recebido em {email.trim()}. O e-mail só será trocado depois da confirmação.</Text>
          <CampoTexto rótulo="Código de confirmação" value={codigoEmail} onChangeText={(valor) => definirCodigoEmail(valor.replace(/\D/g, '').slice(0, 6))} placeholder="6 números" keyboardType="number-pad" maxLength={6} />
          <Pressable accessibilityRole="button" onPress={reenviarCodigoEmail} style={estilos.linkRecuperacao}><Text style={estilos.textoRecuperacao}>Reenviar código</Text></Pressable>
        </> : null}
        {erroPerfil ? <Aviso ícone="alert-circle-outline" tom="alerta" texto={erroPerfil} /> : null}
        <Botao título={salvandoPerfil ? (verificacaoEmailPendente ? 'Confirmando e salvando...' : 'Salvando dados...') : verificacaoEmailPendente ? 'Confirmar e salvar perfil' : 'Salvar perfil'} ícone={verificacaoEmailPendente ? 'mail-outline' : 'save-outline'} carregando={salvandoPerfil} desativado={!perfil} aoPressionar={salvarDados} />
      </View>
      <View style={estilos.cartaoSenha}>
        <View style={estilos.cabecalhoSenha}><View style={estilos.iconeSenha}><Ionicons name="lock-closed-outline" size={18} color={cores.primario} /></View><View style={estilos.textoSenha}><Text style={estilos.tituloSenha}>{recuperacaoEnviada ? 'Redefinir com código' : 'Alterar senha'}</Text><Text style={estilos.subtituloSenha}>{recuperacaoEnviada ? 'Informe o código enviado para ' + (perfil?.email || email) + '.' : 'Confirme sua senha atual para continuar.'}</Text></View></View>
        {recuperacaoEnviada ? <Text style={estilos.ajudaRecuperacao}>O código foi enviado ao e-mail da conta. Confira também a pasta de spam.</Text> : null}
        {recuperacaoEnviada ? <CampoTexto rótulo="Código de recuperação" value={codigoRecuperacao} onChangeText={(valor) => definirCodigoRecuperacao(valor.replace(/\D/g, '').slice(0, 6))} placeholder="6 números" keyboardType="number-pad" maxLength={6} /> : <CampoTexto rótulo="Senha atual" value={senhaAtual} onChangeText={definirSenhaAtual} secureTextEntry={!mostrarSenhas} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" />}
        <CampoTexto rótulo="Nova senha" value={novaSenha} onChangeText={definirNovaSenha} placeholder="Pelo menos 6 caracteres" secureTextEntry={!mostrarSenhas} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
        <CampoTexto rótulo="Confirmar nova senha" value={confirmarSenha} onChangeText={definirConfirmarSenha} secureTextEntry={!mostrarSenhas} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
        <Pressable accessibilityRole="button" onPress={() => definirMostrarSenhas((atual) => !atual)} style={estilos.alternarSenha}><Ionicons name={mostrarSenhas ? 'eye-off-outline' : 'eye-outline'} size={17} color={cores.primario} /><Text style={estilos.textoAlternarSenha}>{mostrarSenhas ? 'Ocultar senhas' : 'Mostrar senhas'}</Text></Pressable>
        {erroSenha ? <Aviso ícone="alert-circle-outline" tom="alerta" texto={erroSenha} /> : null}
        {recuperacaoEnviada ? <Botao título={recuperandoSenha ? 'Redefinindo...' : 'Redefinir senha'} ícone="key-outline" carregando={recuperandoSenha} secundário aoPressionar={redefinirComCodigo} /> : <Botao título={salvandoSenha ? 'Alterando...' : 'Alterar senha'} ícone="key-outline" carregando={salvandoSenha} secundário aoPressionar={salvarNovaSenha} />}
        {!recuperacaoEnviada ? <Pressable accessibilityRole="button" onPress={enviarCodigoRecuperacao} disabled={recuperandoSenha} style={estilos.linkRecuperacao}><Text style={estilos.textoRecuperacao}>{recuperandoSenha ? 'Enviando código...' : 'Esqueceu a senha atual? Recuperar pelo e-mail'}</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => { definirRecuperacaoEnviada(false); definirCodigoRecuperacao(''); definirErroSenha(''); }} style={estilos.linkRecuperacao}><Text style={estilos.textoRecuperacao}>Voltar para informar a senha atual</Text></Pressable>}
      </View>
      <View style={estilos.espacador} />
    </ScrollView>
  );
}
