import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Botao, CampoTexto } from '../componentes/Elementos';
import GoogleRecuperacao from '../componentes/GoogleRecuperacao';
import { cores } from '../tema';
import estilos from '../estilos/TelaAutenticacao.estilos';
import { codigoEmailValido, senhaTemTamanhoMinimo, senhasIguais } from '../utilitarios/validacaoConta';

export default function TelaAutenticacao({ entrar, cadastrar, recuperarSenha, recuperarSenhaGoogle, carregando }) {
  const [modoCadastro, setModoCadastro] = useState(false);
  const [recuperacao, definirRecuperacao] = useState(false);
  const [codigoEnviado, definirCodigoEnviado] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, definirCodigo] = useState('');
  const [novaSenha, definirNovaSenha] = useState('');
  const [confirmarNovaSenha, definirConfirmarNovaSenha] = useState('');
  const [tokenGoogle, definirTokenGoogle] = useState('');
  const [senhaVisivel, definirSenhaVisivel] = useState(false);
  const [erro, definirErro] = useState('');
  const [aviso, definirAviso] = useState('');

  async function enviar() {
    definirErro('');
    const resultado = modoCadastro ? await cadastrar({ nome, email, senha }) : await entrar({ email, senha });
    if (resultado?.erro) definirErro(resultado.erro);
  }

  async function enviarRecuperacao() {
    definirErro('');
    definirAviso('');
    if (codigoEnviado) {
      if (!codigoEmailValido(codigo)) return definirErro('Digite o código de 6 dígitos recebido por e-mail.');
      if (!senhaTemTamanhoMinimo(novaSenha)) return definirErro('A nova senha precisa ter pelo menos 6 caracteres.');
      if (!senhasIguais(novaSenha, confirmarNovaSenha)) return definirErro('As senhas não são iguais.');
    }
    const resultado = await recuperarSenha(codigoEnviado ? { email, codigo, senha: novaSenha } : { email });
    if (resultado?.erro) return definirErro(resultado.erro);
    if (codigoEnviado) {
      definirRecuperacao(false);
      definirCodigoEnviado(false);
      definirCodigo('');
      definirNovaSenha('');
      definirConfirmarNovaSenha('');
      setSenha('');
      return definirAviso('Senha alterada. Entre com sua nova senha.');
    }
    definirCodigoEnviado(true);
    definirCodigo('');
    definirNovaSenha('');
    definirConfirmarNovaSenha('');
    definirAviso(resultado?.mensagem || 'Confira seu e-mail para obter o código.');
  }

  async function redefinirComGoogle() {
    definirErro('');
    definirAviso('');
    if (!senhaTemTamanhoMinimo(novaSenha)) return definirErro('A senha precisa ter pelo menos 6 caracteres.');
    if (!senhasIguais(novaSenha, confirmarNovaSenha)) return definirErro('As senhas não são iguais.');
    const resultado = await recuperarSenhaGoogle({ idToken: tokenGoogle, senha: novaSenha });
    if (resultado?.erro) return definirErro(resultado.erro);
    definirRecuperacao(false);
    definirCodigoEnviado(false);
    definirTokenGoogle('');
    definirNovaSenha('');
    definirConfirmarNovaSenha('');
    setSenha('');
    definirAviso('Senha alterada. Entre com sua nova senha.');
  }

  function voltarAcesso() {
    definirRecuperacao(false);
    definirCodigoEnviado(false);
    definirErro('');
    definirAviso('');
  }

  return (
    <KeyboardAvoidingView style={estilos.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.marca}>
          <View style={estilos.iconeMarca}><MaterialCommunityIcons name="map-marker-check" size={36} color={cores.branco} /></View>
          <Text style={estilos.nomeMarca}>LEMBRIÊ</Text>
          <Text style={estilos.titulo}>Seus itens importantes,{ '\n' }sempre por perto.</Text>
          <Text style={estilos.subtitulo}>Organize seus objetos e planeje saídas. Associe um chaveiro Bluetooth compatível para ativar a detecção por proximidade.</Text>
        </View>

        <View style={estilos.cartao}>
          {recuperacao ? <>
            <Text style={estilos.tituloForm}>Recuperar senha</Text>
            <Text style={estilos.textoAjuda}>Informe o e-mail cadastrado. Enviaremos um código válido por 15 minutos para essa caixa de entrada. Confira também a pasta de spam.</Text>
            <CampoTexto rótulo="E-mail da conta" value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            {codigoEnviado ? <>
              <CampoTexto rótulo="Código de 6 dígitos" value={codigo} onChangeText={valor => definirCodigo(valor.replace(/\D/g, '').slice(0, 6))} placeholder="000000" keyboardType="number-pad" maxLength={6} />
              <CampoTexto rótulo="Nova senha" value={novaSenha} onChangeText={definirNovaSenha} placeholder="Pelo menos 6 caracteres" secureTextEntry={!senhaVisivel} autoCapitalize="none" />
              <CampoTexto rótulo="Confirmar nova senha" value={confirmarNovaSenha} onChangeText={definirConfirmarNovaSenha} placeholder="Digite a senha novamente" secureTextEntry={!senhaVisivel} autoCapitalize="none" />
              <Pressable accessibilityRole="button" onPress={() => definirSenhaVisivel(valor => !valor)} style={estilos.botaoSenha}><Ionicons name={senhaVisivel ? 'eye-off-outline' : 'eye-outline'} size={16} color={cores.primario} /><Text style={estilos.textoBotaoSenha}>{senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}</Text></Pressable>
            </> : null}
            {!codigoEnviado && !tokenGoogle ? <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 5 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: cores.linha }} />
                <Text style={{ color: cores.textoSuave, fontSize: 12 }}>ou recupere sem e-mail</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: cores.linha }} />
              </View>
              <GoogleRecuperacao
                carregando={carregando}
                aoReceberToken={token => { definirErro(''); definirAviso(''); definirTokenGoogle(token); }}
                aoFalhar={mensagem => definirErro(mensagem)}
              />
            </> : null}
            {tokenGoogle ? <>
              <Text style={estilos.textoAjuda}>Conta Google confirmada. Escolha uma nova senha para sua conta Lembriê.</Text>
              <CampoTexto rótulo="Nova senha" value={novaSenha} onChangeText={definirNovaSenha} placeholder="Pelo menos 6 caracteres" secureTextEntry={!senhaVisivel} autoCapitalize="none" />
              <CampoTexto rótulo="Confirmar nova senha" value={confirmarNovaSenha} onChangeText={definirConfirmarNovaSenha} placeholder="Digite a senha novamente" secureTextEntry={!senhaVisivel} autoCapitalize="none" />
              <Botao título={carregando ? 'Aguarde...' : 'Redefinir senha'} aoPressionar={redefinirComGoogle} carregando={carregando} ícone="lock-closed-outline" />
              <Pressable accessibilityRole="button" onPress={() => { definirTokenGoogle(''); definirErro(''); }} style={estilos.linkSecundario}><Text style={estilos.textoLink}>Escolher outro método</Text></Pressable>
            </> : null}
            {erro ? <View accessibilityRole="alert" style={estilos.caixaErro}><Text style={estilos.textoErro}>{erro}</Text></View> : null}
            {aviso ? <View style={estilos.caixaAviso}><Text style={estilos.textoAviso}>{aviso}</Text></View> : null}
            {!tokenGoogle ? <Botao título={carregando ? 'Aguarde...' : codigoEnviado ? 'Redefinir senha' : 'Enviar código'} aoPressionar={enviarRecuperacao} carregando={carregando} ícone="mail-outline" /> : null}
            {codigoEnviado ? <Pressable accessibilityRole="button" onPress={() => { definirCodigoEnviado(false); definirCodigo(''); definirNovaSenha(''); definirConfirmarNovaSenha(''); definirAviso('Aguarde pelo menos 1 minuto entre solicitações de código.'); definirErro(''); }} style={estilos.linkSecundario}><Text style={estilos.textoLink}>Solicitar outro código</Text></Pressable> : null}
            <Pressable accessibilityRole="button" onPress={voltarAcesso} style={estilos.linkSecundario}><Text style={estilos.textoLink}>Voltar para entrar</Text></Pressable>
          </> : <>
            <View style={estilos.abas}>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: !modoCadastro }} onPress={() => { setModoCadastro(false); definirErro(''); definirAviso(''); }} style={[estilos.aba, !modoCadastro && estilos.abaAtiva]}><Text style={[estilos.textoAba, !modoCadastro && estilos.textoAbaAtiva]}>Entrar</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: modoCadastro }} onPress={() => { setModoCadastro(true); definirErro(''); definirAviso(''); }} style={[estilos.aba, modoCadastro && estilos.abaAtiva]}><Text style={[estilos.textoAba, modoCadastro && estilos.textoAbaAtiva]}>Criar conta</Text></Pressable>
            </View>
            {modoCadastro ? <CampoTexto rótulo="Seu nome" value={nome} onChangeText={setNome} placeholder="Como podemos chamar você?" autoCapitalize="words" returnKeyType="next" /> : null}
            <CampoTexto rótulo="E-mail" value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            <CampoTexto rótulo="Senha" value={senha} onChangeText={setSenha} placeholder={modoCadastro ? 'Pelo menos 6 caracteres' : 'Digite sua senha'} secureTextEntry={!senhaVisivel} autoCapitalize="none" onSubmitEditing={enviar} />
            <Pressable accessibilityRole="button" onPress={() => definirSenhaVisivel(valor => !valor)} style={estilos.botaoSenha}><Ionicons name={senhaVisivel ? 'eye-off-outline' : 'eye-outline'} size={16} color={cores.primario} /><Text style={estilos.textoBotaoSenha}>{senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}</Text></Pressable>
            {!modoCadastro ? <Pressable accessibilityRole="button" onPress={() => { definirRecuperacao(true); definirErro(''); definirAviso(''); }} style={estilos.esqueceu}><Text style={estilos.textoLink}>Esqueceu a senha?</Text></Pressable> : null}
            {erro ? <View accessibilityRole="alert" style={estilos.caixaErro}><Text style={estilos.textoErro}>{erro}</Text></View> : null}
            {aviso ? <View style={estilos.caixaAviso}><Text style={estilos.textoAviso}>{aviso}</Text></View> : null}
            <Botao título={carregando ? 'Conectando...' : modoCadastro ? 'Criar minha conta' : 'Entrar'} aoPressionar={enviar} carregando={carregando} ícone={modoCadastro ? 'person-add-outline' : 'arrow-forward-outline'} />
            <Text style={estilos.rodape}>Seus dados e objetos ficam associados à sua conta.</Text>
          </>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

