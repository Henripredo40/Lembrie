import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cores } from '../tema';
import estilos from '../estilos/TelaAcessoSeguranca.estilos';

function formatarData(valor, carregando) {
  if (!valor) return carregando ? 'Consultando último login…' : 'Nenhum acesso registrado';
  const data = new Date(String(valor).replace(' ', 'T'));
  return Number.isNaN(data.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(data);
}

function formatarDuracao(segundos) {
  const total = Math.max(0, Number(segundos) || 0);
  if (total < 60) return 'menos de 1 minuto';
  const minutos = Math.floor(total / 60);
  const horas = Math.floor(minutos / 60);
  const restantes = minutos % 60;
  return horas ? `${horas} h ${restantes} min` : `${minutos} min`;
}

export default function TelaAcessoSeguranca({ api, segurancaInicial }) {
  const [seguranca, definirSeguranca] = useState(segurancaInicial || null);
  const [carregando, definirCarregando] = useState(!segurancaInicial);
  const [erro, definirErro] = useState('');

  const carregarSeguranca = useCallback(async () => {
    definirCarregando(true);
    definirErro('');
    try {
      definirSeguranca(await api('/me/security'));
    } catch (falha) {
      definirErro(falha.message || 'Não foi possível carregar os dados de acesso.');
    } finally {
      definirCarregando(false);
    }
  }, [api]);

  useEffect(() => { carregarSeguranca(); }, [carregarSeguranca]);

  const sessao = seguranca?.sessions?.[0];
  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregarSeguranca} tintColor={cores.primario} colors={[cores.primario]} />}
    >
      <Text style={estilos.sobretitulo}>SEGURANÇA DA CONTA</Text>
      <Text style={estilos.titulo}>Acesso e segurança</Text>

      <View style={estilos.cartaoUltimoLogin}>
        <View style={estilos.iconeUltimoLogin}><Ionicons name="shield-checkmark" size={23} color={cores.primario} /></View>
        <View style={estilos.textoUltimoLogin}>
          <Text style={estilos.rotulo}>ÚLTIMO LOGIN</Text>
          <Text style={estilos.data}>{formatarData(seguranca?.last_login, carregando)}</Text>
        </View>
      </View>

      {carregando && !seguranca ? <View style={estilos.estado}><ActivityIndicator color={cores.primario} /><Text style={estilos.textoEstado}>Carregando os dados de acesso…</Text></View> : null}
      {erro ? <Pressable accessibilityRole="button" onPress={carregarSeguranca} style={estilos.avisoErro}><Ionicons name="refresh-outline" size={18} color={cores.laranja} /><Text style={estilos.textoErro}>{erro} Toque para tentar novamente.</Text></Pressable> : null}

      {sessao ? <View style={estilos.cartaoDetalhes}>
        <Text style={estilos.tituloSecao}>Detalhes deste acesso</Text>
        {sessao.device_label ? <LinhaAcesso ícone="phone-portrait-outline" titulo="Aparelho" valor={sessao.device_label} /> : null}
        {sessao.location_label ? <LinhaAcesso ícone="location-outline" titulo="Local aproximado" valor={sessao.location_label} /> : null}
        <LinhaAcesso ícone="time-outline" titulo="Tempo de uso" valor={formatarDuracao(sessao.active_seconds) + (sessao.active ? ' · em uso' : '')} />
      </View> : null}

      {!carregando && !erro && !sessao ? <View style={estilos.cartaoVazio}><Ionicons name="shield-outline" size={24} color={cores.primario} /><Text style={estilos.tituloVazio}>Nenhuma sessão detalhada ainda</Text><Text style={estilos.textoVazio}>Os detalhes do aparelho e da duração aparecerão após um novo acesso à conta.</Text></View> : null}

      <View style={estilos.notaPrivacidade}>
        <Ionicons name="information-circle-outline" size={18} color={cores.primario} />
        <Text style={estilos.textoPrivacidade}>O aparelho é identificado pelos dados informados pelo sistema. O local mostra cidade e estado quando disponíveis; as coordenadas desse acesso não são salvas. Coordenadas de perímetros salvos ficam na sua conta. A duração é aproximada e conta enquanto o app ou site está em uso.</Text>
      </View>
      <View style={estilos.espacador} />
    </ScrollView>
  );
}

function LinhaAcesso({ ícone, titulo, valor }) {
  return <View style={estilos.linhaAcesso}>
    <View style={estilos.iconeLinha}><Ionicons name={ícone} size={18} color={cores.primario} /></View>
    <View style={estilos.textoLinha}><Text style={estilos.rotuloLinha}>{titulo}</Text><Text style={estilos.valorLinha}>{valor}</Text></View>
  </View>;
}
