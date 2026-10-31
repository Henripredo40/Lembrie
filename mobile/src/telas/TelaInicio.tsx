import estilos from '../estilos/TelaInicio.estilos';
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView,  Text, TextInput, Pressable, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CartaoObjeto from '../componentes/CartaoObjeto';
import ImagemObjeto from '../componentes/ImagemObjeto';
import { Aviso, EstadoVazio, TituloSecao } from '../componentes/Elementos';
import { cores, raios } from '../tema';
import { categoriasDeObjeto, chaveiroEstáConectado, normalizarTexto, objetoÉEssencial, objetoTemChaveiro } from '../utils/objetos';
import { formatarData } from '../utils/date';

type CategoriaComRepresentante = (typeof categoriasDeObjeto)[number] & { objetoRepresentativo?: { name: string; category?: string } };

export default function TelaInicio({ perfil, objetos, eventos, busca, definirBusca, abrirTela, atualizar, atualizando, erroConexao, mostrarAlertas }) {
  const objetosEncontrados = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    if (!termo) return objetos;
    return objetos.filter((objeto) => normalizarTexto(String(objeto.name) + ' ' + String(objeto.category)).includes(termo));
  }, [objetos, busca]);

  const vinculados = objetos.filter(objetoTemChaveiro).length;
  const detectados = objetos.filter(chaveiroEstáConectado).length;
  const essenciais = objetos.filter(objetoÉEssencial).length;
  const nome = perfil?.name?.trim()?.split(/\s+/)[0] || 'Olá';
  const categoriasVisiveis = useMemo(() => {
    const predefinidas: CategoriaComRepresentante[] = categoriasDeObjeto.slice(0, 8);
    const todasPredefinidas = new Set(categoriasDeObjeto.map((categoria) => normalizarTexto(categoria.nome)));
    const personalizadas: CategoriaComRepresentante[] = [...new Set<string>(objetos.map((objeto) => String(objeto.category || '').trim()).filter((categoria) => categoria.length > 0))]
      .filter((categoria) => !todasPredefinidas.has(normalizarTexto(categoria)))
      .map((categoria) => ({
        nome: categoria,
        ícone: 'tag-outline' as const,
        objetoRepresentativo: objetos.find((objeto) => normalizarTexto(String(objeto.category || '')) === normalizarTexto(categoria)),
      }));
    return [...predefinidas, ...personalizadas];
  }, [objetos]);

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.primario} colors={[cores.primario]} />}
    >
      <View style={estilos.cabecalhoBoasVindas}>
        <View style={estilos.blocoTexto}>
          <Text style={estilos.saudacao}>OLÁ, {nome.toLocaleUpperCase('pt-BR')}</Text>
          <Text style={estilos.titulo}>Vamos cuidar do que importa?</Text>
          <Text style={estilos.subtitulo}>Seus objetos, organizados em um só lugar.</Text>
        </View>
        <View style={estilos.avatar}><Text style={estilos.letraAvatar}>{nome.charAt(0).toLocaleUpperCase('pt-BR')}</Text></View>
      </View>

      {erroConexao ? <Aviso ícone="cloud-offline-outline" tom="alerta" texto={erroConexao} /> : null}

      <View style={estilos.busca}>
        <Ionicons name="search-outline" size={20} color={cores.textoSuave} />
        <TextInput
          accessibilityLabel="Buscar objeto"
          value={busca}
          onChangeText={definirBusca}
          placeholder="Buscar um objeto..."
          placeholderTextColor={cores.textoSuave}
          returnKeyType="search"
          style={estilos.campoBusca}
        />
        {busca ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => definirBusca('')} hitSlop={8}><Ionicons name="close-circle" size={20} color="#98A2B3" /></Pressable> : null}
      </View>

      <View style={estilos.cartaoChaveiro}>
        <View style={estilos.linhaChaveiro}>
          <View style={estilos.iconeChaveiro}><MaterialCommunityIcons name="bluetooth" size={24} color={cores.branco} /></View>
          <View style={estilos.infoChaveiro}>
            <Text style={estilos.rotuloChaveiro}>SEU CHAVEIRO</Text>
            <Text style={estilos.tituloChaveiro}>
              {detectados > 0 ? detectados + (detectados === 1 ? ' dispositivo detectado' : ' dispositivos detectados') : vinculados > 0 ? 'Aguardando o primeiro sinal' : 'Pronto para o seu projeto'}
            </Text>
            <Text style={estilos.textoChaveiro}>
              {detectados > 0 ? 'O aplicativo recebeu um sinal do chaveiro.' : vinculados > 0 ? 'O dispositivo está associado, mas ainda não enviou sinal.' : 'Cadastre seus itens agora e associe o chaveiro quando ele estiver pronto.'}
            </Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => abrirTela('bluetooth')} style={estilos.botaoChaveiro}>
          <Text style={estilos.textoBotaoChaveiro}>Abrir Bluetooth</Text>
          <Ionicons name="arrow-forward" size={17} color={cores.branco} />
        </Pressable>
      </View>

      <TituloSecao título="RESUMO" />
      <View style={estilos.resumos}>
        <Resumo ícone="cube-outline" número={objetos.length} legenda="Objetos" cor={cores.primario} fundo={cores.primarioClaro} />
        <Resumo ícone="star-outline" número={essenciais} legenda="Essenciais" cor="#A85B11" fundo="#FFF3E3" />
        <Resumo ícone="bluetooth" número={vinculados} legenda="Associados" cor="#2872B8" fundo="#EAF5FF" />
      </View>

      <TituloSecao título="CATEGORIAS" ação="Ver objetos" aoPressionar={() => abrirTela('objetos')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.listaCategorias}>
        {categoriasVisiveis.map((categoria) => {
          const quantidade = objetos.filter((objeto) => normalizarTexto(objeto.category) === normalizarTexto(categoria.nome)).length;
          return (
            <Pressable key={categoria.nome} accessibilityRole="button" onPress={() => abrirTela('objetos', { categoria: categoria.nome })} style={estilos.categoria}>
              <View style={estilos.iconeCategoria}>{categoria.objetoRepresentativo ? <ImagemObjeto nome={categoria.objetoRepresentativo.name} categoria={categoria.objetoRepresentativo.category} tamanho={12} compacto /> : <MaterialCommunityIcons name={categoria.ícone} size={20} color={cores.primario} />}</View>
              <Text style={estilos.nomeCategoria}>{categoria.nome}</Text>
              <Text style={estilos.quantidadeCategoria}>{quantidade} {quantidade === 1 ? 'item' : 'itens'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <TituloSecao título={busca ? 'RESULTADOS' : 'SEUS OBJETOS'} ação={objetos.length ? 'Ver todos' : undefined} aoPressionar={() => abrirTela('objetos')} />
      {objetosEncontrados.length === 0 ? (
        <EstadoVazio
          ícone={busca ? 'search-outline' : 'cube-outline'}
          título={busca ? 'Nenhum objeto encontrado' : 'Sua lista começa aqui'}
          texto={busca ? 'Tente outro nome ou categoria.' : 'Cadastre suas chaves, mochila, carteira e outros itens importantes.'}
          ação={busca ? undefined : 'Cadastrar primeiro objeto'}
          aoPressionar={() => abrirTela('objetos')}
        />
      ) : (
        <View style={estilos.listaObjetos}>
          {objetosEncontrados.slice(0, 4).map((objeto) => <CartaoObjeto key={String(objeto.id)} objeto={objeto} compacto />)}
        </View>
      )}

      <View style={estilos.atalhos}>
        <Atalho ícone="exit-outline" título="Conferir antes de sair" texto="Monte sua lista" aoPressionar={() => abrirTela('saida')} />
        <Atalho ícone="map-outline" título="Planejar destino" texto="Veja sugestões para onde vai" aoPressionar={() => abrirTela('mapa')} />
      </View>

      {mostrarAlertas && essenciais > 0 && vinculados === 0 ? (
        <Aviso ícone="information-circle-outline" texto="Você marcou itens essenciais, mas ainda não associou um chaveiro Bluetooth. Até o chaveiro ficar pronto, confira os itens manualmente antes de sair." />
      ) : null}

      <TituloSecao título="ATIVIDADE RECENTE" ação={eventos.length ? 'Ver histórico' : undefined} aoPressionar={() => abrirTela('historico')} />
      {eventos.length ? (
        <View style={estilos.cartaoAtividade}>
          {eventos.slice(0, 3).map((evento, índice) => (
            <View key={String(evento.id || índice)} style={[estilos.linhaAtividade, índice > 0 && estilos.linhaAtividadeComBorda]}>
              <View style={estilos.iconeAtividade}><Ionicons name={evento.type === 'departure' ? 'walk-outline' : evento.type === 'lista_saida' ? 'checkbox-outline' : 'time-outline'} size={17} color={cores.primario} /></View>
              <View style={estilos.textoAtividade}><Text style={estilos.mensagemAtividade} numberOfLines={2}>{evento.message || 'Atividade registrada'}</Text><Text style={estilos.dataAtividade}>{formatarData(evento.created_at)}</Text></View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={estilos.semAtividade}>As atividades e conferências aparecerão aqui.</Text>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function Resumo({ ícone, número, legenda, cor, fundo }) {
  return (
    <View style={estilos.cartaoResumo}>
      <View style={[estilos.iconeResumo, { backgroundColor: fundo }]}><MaterialCommunityIcons name={ícone} size={18} color={cor} /></View>
      <Text style={estilos.numeroResumo}>{número}</Text>
      <Text style={estilos.legendaResumo}>{legenda}</Text>
    </View>
  );
}

function Atalho({ ícone, título, texto, aoPressionar }) {
  return (
    <Pressable accessibilityRole="button" onPress={aoPressionar} style={({ pressed }) => [estilos.atalho, pressed && { opacity: 0.8 }]}>
      <View style={estilos.iconeAtalho}><Ionicons name={ícone} size={20} color={cores.primario} /></View>
      <Text style={estilos.tituloAtalho}>{título}</Text>
      <Text style={estilos.textoAtalho}>{texto}</Text>
    </Pressable>
  );
}

