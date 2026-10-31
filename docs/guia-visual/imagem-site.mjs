import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = dirname(fileURLToPath(import.meta.url));
const screens = [
  {
    file: '00-visao-geral.svg', number: '01', section: 'Conheça o Lembriê', title: 'Tudo o que importa,\nno seu ritmo.',
    subtitle: 'Um guia visual pelas principais áreas do site e do app.',
    page: 'Visão geral', icon: '✦',
    cards: [['Início', 'Encontre seus objetos e sugestões úteis.'], ['Objetos', 'Cadastre, organize e marque essenciais.'], ['Mapa e rotina', 'Pesquise destinos e planeje o que levar.'], ['Saída', 'Revise sua lista antes de sair.'], ['Bluetooth', 'Associe um chaveiro compatível.'], ['Ajuda e conta', 'Tire dúvidas e cuide da segurança.']],
    noteTitle: 'Seu espaço pessoal', note: 'As telas se conectam: seus objetos alimentam as listas, as sugestões de saída e a ajuda personalizada.', tag: 'GUIA DO SITE E APP',
  },
  {
    file: '01-inicio.svg', number: '02', section: '01 · Início', title: 'Veja o que precisa\nlevar por perto.',
    subtitle: 'A tela inicial reúne seus objetos e atalhos para o dia a dia.',
    page: 'Início', icon: '⌂',
    cards: [['Buscar objeto', 'Pesquise pelo nome ou pela categoria.'], ['Sugestão para este local', 'Veja recomendações relacionadas ao lugar detectado.'], ['Seu chaveiro', 'Confira se há algum dispositivo associado.'], ['Ações rápidas', 'Acesse lista de saída, mapa e objetos.']],
    noteTitle: 'Comece por aqui', note: 'Use a busca para localizar um item cadastrado. Toque em um atalho para abrir a função correspondente.', tag: 'ORGANIZE O DIA',
  },
  {
    file: '02-objetos.svg', number: '03', section: '02 · Objetos', title: 'Cadastre do seu jeito.\nEncontre sem esforço.',
    subtitle: 'Seus itens ficam organizados por categoria e importância.',
    page: 'Meus objetos', icon: '◇',
    cards: [['Nome e categoria', 'Escolha uma categoria pronta ou personalize.'], ['Imagem do item', 'Adicione uma foto para reconhecer itens personalizados.'], ['Marcar como essencial', 'Destaque o que costuma ser indispensável.'], ['Sua lista', 'Pesquise, edite ou remova itens cadastrados.']],
    noteTitle: 'Dica', note: 'Use nomes claros, como “Chave de casa” ou “Estojo de remédios”. Marque como essencial os itens que quer revisar sempre.', tag: 'SUA LISTA PESSOAL',
  },
  {
    file: '03-mapa-rotina.svg', number: '04', section: '03 · Mapa e rotina', title: 'Planeje o destino\ne o que vai levar.',
    subtitle: 'Pesquise um endereço, confira o ponto no mapa e salve sua rotina.',
    page: 'Mapa e rotina', icon: '⌖',
    cards: [['Buscar endereço ou CEP', 'Digite o local e escolha uma sugestão.'], ['Conferir no mapa', 'Arraste o mapa e toque para ajustar o ponto.'], ['Destino selecionado', 'Revise o endereço antes de salvar.'], ['O que levar', 'Associe objetos ao destino e à rotina.']],
    noteTitle: 'Mais precisão', note: 'Selecione uma sugestão de endereço quando ela aparecer e confira o marcador no mapa antes de salvar o destino.', tag: 'DESTINOS E ROTINA',
  },
  {
    file: '04-saida.svg', number: '05', section: '04 · Saída', title: 'Confira sua lista\nantes de sair.',
    subtitle: 'Uma conferência simples ajuda a lembrar dos itens importantes.',
    page: 'Lista de saída', icon: '✓',
    cards: [['Itens essenciais', 'Aparecem em destaque para facilitar a revisão.'], ['Marcar como conferido', 'Toque no item quando ele já estiver com você.'], ['Sugestões por destino', 'Use a rotina e o local para preparar a lista.'], ['Finalizar conferência', 'Revise os itens antes de sair.']],
    noteTitle: 'Checklist prático', note: 'A lista usa os objetos que você cadastrou. As sugestões podem variar conforme o destino e os dados disponíveis.', tag: 'PRONTO PARA SAIR',
  },
  {
    file: '05-bluetooth.svg', number: '06', section: '05 · Bluetooth', title: 'Associe um chaveiro\na um objeto.',
    subtitle: 'Quando tiver um chaveiro compatível, conecte-o pelo app instalado no celular.',
    page: 'Bluetooth', icon: 'ᛒ',
    cards: [['Escolher objeto', 'Selecione qual item será associado.'], ['Buscar dispositivos', 'Ative o Bluetooth e coloque o chaveiro em modo de pareamento.'], ['Conectar', 'Escolha o dispositivo encontrado e confirme.'], ['Verificar status', 'Consulte a conexão e o sinal na lista.']],
    noteTitle: 'Precisa do chaveiro físico', note: 'A associação só funciona com um dispositivo BLE compatível ligado e próximo. A tela web pode não ter acesso à busca Bluetooth.', tag: 'CONEXÃO BLE',
  },
  {
    file: '06-ajuda.svg', number: '07', section: '06 · Ajuda', title: 'Pergunte sobre o app\nou o que levar.',
    subtitle: 'O assistente ajuda com as funções do Lembriê e suas listas.',
    page: 'Ajuda personalizada', icon: '✧',
    cards: [['Perguntas rápidas', 'Acesse dúvidas comuns sobre objetos, mapa e Bluetooth.'], ['Conversa', 'Escreva sua pergunta em linguagem natural.'], ['Sugestões', 'Peça ideias de itens para um destino.'], ['Respostas da conta', 'Pergunte quais objetos estão cadastrados ou são essenciais.']],
    noteTitle: 'Perguntas que funcionam', note: 'Experimente “Quais objetos estão cadastrados?” ou “O que levar para o trabalho?”. As respostas dependem da conexão com o serviço.', tag: 'ASSISTENTE LEMBRIÊ',
  },
  {
    file: '07-perfil-seguranca.svg', number: '08', section: '07 · Perfil e segurança', title: 'Cuide dos seus dados\ne da sua conta.',
    subtitle: 'Atualize suas informações e confira os acessos registrados.',
    page: 'Meu perfil', icon: '◎',
    cards: [['Dados da conta', 'Revise seu nome e e-mail.'], ['Último acesso', 'Confira horário, duração e tipo de dispositivo quando disponíveis.'], ['Alterar senha', 'Atualize sua senha com segurança.'], ['Recuperação', 'Use o código enviado ao e-mail quando o recurso estiver configurado.']],
    noteTitle: 'Acesso recente', note: 'As informações exibidas dependem do que o serviço conseguiu registrar. A localização pode ser aproximada.', tag: 'CONTA PROTEGIDA',
  },
  {
    file: '08-historico.svg', number: '09', section: '08 · Histórico', title: 'Acompanhe suas\natividades recentes.',
    subtitle: 'Consulte registros de uso e mantenha suas preferências organizadas.',
    page: 'Histórico', icon: '◷',
    cards: [['Atividades', 'Veja ações recentes registradas na conta.'], ['Data e horário', 'Cada evento mostra quando foi anotado.'], ['Preferências', 'Ajuste notificações e recursos da rotina.'], ['Atualizar', 'Recarregue a tela para buscar registros recentes.']],
    noteTitle: 'Se estiver vazio', note: 'O histórico é preenchido conforme você usa os recursos que registram atividades.', tag: 'REGISTROS DA CONTA',
  },
];

function esc(text) {
  return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function multiline(text, x, y, size, color, weight = 600, lineHeight = 1.18) {
  return text.split('\n').map((line, index) => `<text x="${x}" y="${y + index * size * lineHeight}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(line)}</text>`).join('');
}

function makeSvg(screen) {
  let y = 290;
  const cards = screen.cards.map(([heading, body], index) => {
    const height = 84;
    const item = `<rect x="96" y="${y}" width="432" height="${height}" rx="18" fill="#fff" stroke="#e1ebe7"/><circle cx="124" cy="${y + 27}" r="13" fill="#e8f5f1"/><text x="124" y="${y + 32}" text-anchor="middle" font-size="14" fill="#16796d" font-weight="700">${index + 1}</text><text x="150" y="${y + 30}" font-size="17" fill="#18332f" font-weight="700">${esc(heading)}</text><text x="150" y="${y + 56}" font-size="13" fill="#667975">${esc(body)}</text>`;
    y += height + 10;
    return item;
  }).join('');
  const title = multiline(screen.title, 650, 262, 43, '#153c36', 750, 1.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960" viewBox="0 0 1280 960" role="img" aria-labelledby="title desc">
  <title id="title">${esc(screen.section)} — Guia visual Lembriê</title><desc id="desc">${esc(screen.subtitle)} Ilustração explicativa da tela ${esc(screen.page)}.</desc>
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edf7f4"/><stop offset="1" stop-color="#f8faf9"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#173b35" flood-opacity=".12"/></filter></defs>
  <rect width="1280" height="960" fill="url(#bg)"/><circle cx="1170" cy="110" r="125" fill="#dff0eb"/><circle cx="1120" cy="850" r="190" fill="#e8f4f0"/>
  <text x="72" y="74" font-size="16" font-weight="800" letter-spacing="3" fill="#16796d">LEMBRIÊ  /  GUIA VISUAL</text><text x="1204" y="74" text-anchor="end" font-size="14" font-weight="700" fill="#71827e">${esc(screen.number)} / 09</text>
  <rect x="72" y="112" width="1136" height="1" fill="#dce9e5"/>
  <text x="72" y="158" font-size="15" font-weight="800" letter-spacing="2" fill="#16796d">${esc(screen.section.toLocaleUpperCase('pt-BR'))}</text>
  <text x="72" y="191" font-size="18" fill="#667975">${esc(screen.subtitle)}</text>
  <g filter="url(#shadow)"><rect x="72" y="228" width="480" height="680" rx="36" fill="#fff"/><rect x="88" y="244" width="448" height="648" rx="25" fill="#f5f8f7"/></g>
  <rect x="88" y="244" width="448" height="77" rx="25" fill="#fff"/><path d="M88 296h448v25H88z" fill="#fff"/><rect x="106" y="262" width="42" height="42" rx="14" fill="#16796d"/><text x="127" y="291" text-anchor="middle" font-size="24" fill="#fff" font-weight="700">${esc(screen.icon)}</text><text x="162" y="278" font-size="11" font-weight="800" letter-spacing="2" fill="#16796d">LEMBRIÊ</text><text x="162" y="301" font-size="19" font-weight="750" fill="#17332f">${esc(screen.page)}</text><circle cx="502" cy="283" r="17" fill="#e8f5f1"/><text x="502" y="289" text-anchor="middle" font-size="17" fill="#16796d">↻</text>
  <rect x="106" y="339" width="412" height="53" rx="15" fill="#fff" stroke="#e1ebe7"/><text x="125" y="371" font-size="15" fill="#8a9894">⌕  Buscar ou explorar</text>
  ${cards}
  <rect x="88" y="846" width="448" height="46" rx="0" fill="#fff"/><path d="M88 846h448" stroke="#e1ebe7"/><text x="132" y="875" text-anchor="middle" font-size="18" fill="#83908d">⌂</text><text x="220" y="875" text-anchor="middle" font-size="18" fill="#83908d">◇</text><text x="312" y="875" text-anchor="middle" font-size="18" fill="#83908d">ᛒ</text><text x="402" y="875" text-anchor="middle" font-size="18" fill="#16796d">✓</text><text x="493" y="875" text-anchor="middle" font-size="18" fill="#83908d">▦</text>
  <rect x="650" y="222" width="128" height="32" rx="16" fill="#dcefe9"/><text x="714" y="243" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="1.2" fill="#16796d">${esc(screen.tag)}</text>
  ${title}
  <text x="650" y="${screen.title.includes('\n') ? 374 : 322}" font-size="18" fill="#5d706b">Veja como usar esta área:</text>
  <rect x="650" y="410" width="558" height="242" rx="24" fill="#fff" stroke="#e1ebe7"/>
  ${screen.cards.slice(0, 4).map(([heading, body], index) => `<circle cx="683" cy="${450 + index * 48}" r="13" fill="#e8f5f1"/><text x="683" y="${455 + index * 48}" text-anchor="middle" font-size="12" font-weight="800" fill="#16796d">${index + 1}</text><text x="710" y="${447 + index * 48}" font-size="16" font-weight="750" fill="#203b36">${esc(heading)}</text><text x="710" y="${467 + index * 48}" font-size="13" fill="#70807c">${esc(body.length > 53 ? body.slice(0, 50) + '…' : body)}</text>`).join('')}
  <rect x="650" y="678" width="558" height="150" rx="24" fill="#eaf5f1"/><text x="682" y="720" font-size="14" font-weight="800" letter-spacing="1.1" fill="#16796d">${esc(screen.noteTitle.toLocaleUpperCase('pt-BR'))}</text><text x="682" y="757" font-size="16" fill="#39544e">${esc(screen.note)}</text><text x="682" y="790" font-size="13" fill="#6e827d">Ilustração explicativa · Os dados reais variam conforme a conta.</text>
  <text x="72" y="938" font-size="12" fill="#71827e">LEMBRIÊ  ·  Seus objetos, sua rotina e suas listas em um só lugar.</text><text x="1208" y="938" text-anchor="end" font-size="12" fill="#71827e">${esc(screen.number)} — ${esc(screen.page)}</text>
  </svg>`;
}

await mkdir(out, { recursive: true });
for (const screen of screens) await writeFile(join(out, screen.file), makeSvg(screen), 'utf8');
const links = screens.map((screen) => `- [${screen.section}](./${screen.file}) — ${screen.subtitle}`).join('\n');
await writeFile(join(out, 'README.md'), `# Guia visual do Lembriê\n\nImagens ilustrativas para apresentar as principais áreas do site e do app. Cada arquivo SVG pode ser aberto no navegador ou visualizado diretamente no GitHub.\n\n> As telas são mockups explicativos. Textos, estados e recomendações na instalação real podem variar conforme conta, permissões, conexão e dispositivo.\n\n${links}\n\n## Arquivos\n\nOs SVGs estão neste diretório para ficarem separados do código do aplicativo e da API. Para regenerar as imagens, execute node imagem-site.mjs.\n`, 'utf8');
