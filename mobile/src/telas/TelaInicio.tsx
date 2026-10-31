import estilos from '../estilos/TelaInicio.estilos';
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView,  Text, TextInput, Pressable, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CartaoObjeto from '../componentes/CartaoObjeto';
import ImagemObjeto from '../componentes/ImagemObjeto';
import { Aviso, EstadoVazio, TituloSecao } from '../componentes/Elementos';
import { cores, raios } from '../tema';
import { categoriasDeObjeto, chaveiroEstáConectado, normalizarTexto, objetoÉEssencial, objetoTemChaveiro } from '../utils/objetos';
import { formatarData } from '../utils/date';

type CategoriaComRepresentante = (typeof categoriasDeObjeto)[number] & { objetoRepresentativo?: { name: string; category?: string }; rotina?: boolean };

export default function TelaInicio({ perfil, seguranca, mostrarResumoLogin = true, objetos, eventos, busca, definirBusca, abrirTela, atualizar, atualizando, erroConexao, mostrarAlertas, api, rotinaAtiva, sugestaoGPS }) {
  const [categoriasDaRotina, definirCategoriasDaRotina] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    if (!rotinaAtiva || !objetos.length) {
      definirCategoriasDaRotina([]);
      return () => { cancelado = true; };
    }

    async function carregarCategoriasDaRotina() {
      try {
        const planos = await api('/routine/plans');
        const destinos = [...new Set<string>((Array.isArray(planos) ? planos : []).map((plano) => String(plano.destination || '').trim()).filter((destino) => destino.length > 0))].slice(0, 5);
        const recomendacoes = await Promise.all(destinos.map((destino) => api('/recommendations?destination=' + encodeURIComponent(destino)).catch(() => null)));
        const categorias = new Set<string>();
        recomendacoes.forEach((resposta) => {
          (Array.isArray(resposta?.registeredItems) ? resposta.registeredItems : []).forEach((objeto) => {
            const categoria = normalizarTexto(String(objeto.category || '').trim());
            if (categoria) categorias.add(categoria);
          });
        });
        if (!cancelado) definirCategoriasDaRotina([...categorias]);
      } catch {
        if (!cancelado) definirCategoriasDaRotina([]);
      }
    }

    carregarCategoriasDaRotina();
    return () => { cancelado = true; };
  }, [api, objetos, rotinaAtiva]);

  const objetosEncontrados = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    if (!termo) return objetos;
    return objetos.filter((objeto) => normalizarTexto(String(objeto.name) + ' ' + String(objeto.category)).includes(termo));
  }, [objetos, busca]);

  const vinculados = objetos.filter(objetoTemChaveiro).length;
  const detectados = objetos.filter(chaveiroEstáConectado).length;
  const essenciais = objetos.filter(objetoÉEssencial).length;
  const nome = perfil?.name?.trim()?.split(/\s+/)[0] || 'Olá';
  const sessaoRecente = seguranca?.sessions?.[0];
  const ultimoAcesso = seguranca?.last_login ? new Date(String(seguranca.last_login).replace(' ', 'T')) : null;
  const textoUltimoAcesso = ultimoAcesso && !Number.isNaN(ultimoAcesso.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ultimoAcesso)
    : 'Aguardando registro do acesso';
  const categoriasVisiveis = useMemo(() => {
    const nomes = [...new Set<string>(objetos.map((objeto) => String(objeto.category || 'Outros').trim()).filter((categoria) => categoria.length > 0))];
    return nomes.map((nomeCategoria) => {
      const predefinida = categoriasDeObjeto.find((categoria) => normalizarTexto(categoria.nome) === normalizarTexto(nomeCategoria));
      const representativo = objetos.find((objeto) => normalizarTexto(String(objeto.category || 'Outros')) === normalizarTexto(nomeCategoria));
      return {
        nome: predefinida?.nome || nomeCategoria,
        ícone: predefinida?.ícone || 'tag-outline',
        objetoRepresentativo: predefinida ? undefined : representativo,
        rotina: categoriasDaRotina.includes(normalizarTexto(nomeCategoria)),
      };
    }).sort((a, b) => Number(Boolean(b.rotina)) - Number(Boolean(a.rotina)));
  }, [objetos, categoriasDaRotina]);

  return (
    <View style={estilos.tela}>
    <ScrollView
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

      {mostrarResumoLogin ? <Pressable accessibilityRole="button" accessibilityLabel="Ver detalhes do último login" onPress={() => abrirTela('perfil')} style={estilos.cartaoUltimoAcesso}>
        <View style={estilos.iconeUltimoAcesso}><Ionicons name="shield-checkmark" size={18} color={cores.primario} /></View>
        <View style={estilos.detalheUltimoAcesso}>
          <View style={estilos.linhaUltimoAcesso}><Text style={estilos.rotuloUltimoAcesso}>ÚLTIMO LOGIN</Text><Text style={estilos.dataUltimoAcesso}>{textoUltimoAcesso}</Text></View>
          {sessaoRecente?.device_label ? <Text numberOfLines={1} ellipsizeMode="tail" style={estilos.dispositivoUltimoAcesso}>{sessaoRecente.device_label}{sessaoRecente.location_label ? ' · ' + sessaoRecente.location_label : ''}</Text> : <Text style={estilos.dispositivoUltimoAcesso}>Toque para ver o histórico de segurança</Text>}
        </View>
        <View style={estilos.atalhoUltimoAcesso}><Ionicons name="chevron-forward" size={17} color={cores.primario} /></View>
      </Pressable> : null}

      {erroConexao ? <Aviso ícone="cloud-offline-outline" tom="alerta" texto={erroConexao} /> : null}

      {sugestaoGPS?.items?.length || sugestaoGPS?.registeredItems?.length ? <View style={estilos.cartaoSugestaoGPS}>
        <View style={estilos.cabecalhoSugestaoGPS}><Ionicons name="sparkles" size={18} color={cores.primario} /><Text style={estilos.tituloSugestaoGPS}>Sugestão para este local</Text></View>
        <Text style={estilos.textoSugestaoGPS}>{sugestaoGPS.destination}</Text>
        {sugestaoGPS.registeredItems?.length ? <Text style={estilos.textoSugestaoGPS}>Da sua lista: {sugestaoGPS.registeredItems.join(', ')}.</Text> : null}
        {sugestaoGPS.items?.length ? <Text style={estilos.textoSugestaoGPS}>Considere acrescentar: {sugestaoGPS.items.join(', ')}.</Text> : null}
        <Text style={estilos.legendaSugestaoGPS}>{sugestaoGPS.ai ? 'Recomendação personalizada pela IA Gemini' : 'Sugestão local do Lembriê · IA ainda não configurada'}</Text>
      </View> : null}

      <View style={estilos.busca}>
        <Ionicons name="search-outline" size={20} color={cores.textoSuave} />
        <TextInput
          accessibilityLabel="Buscar objeto"
          value={busca}
          onChangeText={definirBusca}
          placeholder="Buscar por nome ou categoria"
          placeholderTextColor={cores.textoSuave}
          returnKeyType="search"
          style={estilos.campoBusca}
        />
        {busca ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => definirBusca('')} hitSlop={8}><Ionicons name="close-circle" size={20} color="#98A2B3" /></Pressable> : null}
      </View>

      {busca.trim() ? (
        <View style={estilos.resultadosBusca}>
          <TituloSecao título={'RESULTADOS · ' + objetosEncontrados.length} />
          {objetosEncontrados.length ? <View style={estilos.listaObjetos}>{objetosEncontrados.map((objeto) => <CartaoObjeto key={String(objeto.id)} objeto={objeto} compacto />)}</View> : <EstadoVazio ícone="search-outline" título="Nenhum objeto encontrado" texto="Confira a escrita ou tente buscar pela categoria." />}
        </View>
      ) : (
        <>

      <View style={estilos.cartaoChaveiro}>
        <View style={estilos.linhaChaveiro}>
          <View style={estilos.iconeChaveiro}><MaterialCommunityIcons name="bluetooth" size={24} color={cores.branco} /></View>
          <View style={estilos.infoChaveiro}>
            <Text style={estilos.rotuloChaveiro}>SEU CHAVEIRO</Text>
            <Text style={estilos.tituloChaveiro}>
              {detectados > 0 ? detectados + (detectados === 1 ? ' dispositivo detectado' : ' dispositivos detectados') : vinculados > 0 ? 'Aguardando o primeiro sinal' : 'Chaveiro não associado'}
            </Text>
            <Text style={estilos.textoChaveiro}>
              {detectados > 0 ? 'O aplicativo recebeu um sinal do chaveiro.' : vinculados > 0 ? 'O dispositivo está associado, mas ainda não enviou sinal.' : 'A detecção por proximidade e os alertas Bluetooth exigem um chaveiro compatível associado ao objeto.'}
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
      <View style={estilos.gradeCategoriasInicio}>
        {categoriasVisiveis.map((categoria) => {
          const quantidade = objetos.filter((objeto) => normalizarTexto(objeto.category) === normalizarTexto(categoria.nome)).length;
          return (
            <Pressable key={categoria.nome} accessibilityRole="button" onPress={() => abrirTela('objetos', { categoria: categoria.nome })} style={estilos.categoria}>
              <View style={estilos.iconeCategoria}>{categoria.objetoRepresentativo ? <ImagemObjeto nome={categoria.objetoRepresentativo.name} categoria={categoria.objetoRepresentativo.category} imagemUri={categoria.objetoRepresentativo.image_data} tamanho={12} compacto /> : <MaterialCommunityIcons name={categoria.ícone} size={20} color={cores.primario} />}</View>
              <Text style={estilos.nomeCategoria}>{categoria.nome}</Text>
              <Text style={estilos.quantidadeCategoria}>{quantidade} {quantidade === 1 ? 'item' : 'itens'}</Text>
              {categoria.rotina ? <Text style={estilos.rotuloRotinaCategoria}>Para sua rotina</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {categoriasVisiveis.length === 0 ? <Text style={estilos.semCategorias}>Cadastre um objeto para ver suas categorias.</Text> : null}

      <TituloSecao título="SEUS OBJETOS" ação={objetos.length ? 'Ver todos' : undefined} aoPressionar={() => abrirTela('objetos')} />
      {objetos.length === 0 ? (
        <EstadoVazio
          ícone="cube-outline"
          título="Sua lista começa aqui"
          texto="Cadastre suas chaves, mochila, carteira e outros itens importantes."
          ação="Cadastrar primeiro objeto"
          aoPressionar={() => abrirTela('objetos')}
        />
      ) : (
        <View style={estilos.listaObjetos}>
          {objetos.slice(0, 4).map((objeto) => <CartaoObjeto key={String(objeto.id)} objeto={objeto} compacto />)}
        </View>
      )}

      <View style={estilos.atalhos}>
        <Atalho ícone="exit-outline" título="Conferir antes de sair" texto="Monte sua lista" aoPressionar={() => abrirTela('saida')} />
        <Atalho ícone="map-outline" título="Planejar destino" texto="Veja sugestões para onde vai" aoPressionar={() => abrirTela('mapa')} />
      </View>

      {mostrarAlertas && essenciais > 0 && vinculados === 0 ? (
        <Aviso ícone="information-circle-outline" texto="A conferência manual está disponível. Para detecção por proximidade e alertas Bluetooth, associe um chaveiro compatível ao objeto." />
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
        </>
      )}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir Mapa e rotina para pesquisar um destino e planejar o que levar" onPress={() => abrirTela('mapa')} style={({ pressed }) => [estilos.mapaFlutuante, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}>
      <View style={estilos.iconeMapaFlutuante}><Ionicons name="map-outline" size={20} color={cores.primario} /></View>
      <View style={estilos.textoMapaFlutuante}><Text style={estilos.tituloMapaFlutuante}>Mapa e rotina</Text><Text numberOfLines={2} style={estilos.subtituloMapaFlutuante}>Pesquise um destino e planeje o que levar</Text></View>
      <Ionicons name="chevron-forward" size={17} color={cores.primario} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir ajuda com IA" onPress={() => abrirTela('assistente')} style={({ pressed }) => [estilos.ajudaFlutuante, pressed && { opacity: 0.86, transform: [{ scale: 0.97 }] }]}>
      <Ionicons name="sparkles" size={18} color={cores.branco} />
      <Text style={estilos.textoAjudaFlutuante}>Ajuda</Text>
    </Pressable>
    </View>
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

