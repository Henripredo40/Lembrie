# Lembriê

Aplicativo móvel em português para organizar objetos, planejar saídas e preparar a conexão com um chaveiro Bluetooth.

## Recursos

- Cadastro, entrada, sessão persistente e recuperação de senha.
- Perfil com edição de nome e e-mail e troca de senha.
- Objetos com categorias, ilustrações locais, busca, edição e marcação de itens essenciais.
- Busca, conexão e associação BLE, com diagnóstico de serviços e características do firmware.
- Lista de saída, sugestões de itens por destino, perfis salvos e histórico.
- Mapa com busca de lugares, posição atual sob demanda e atribuição do OpenStreetMap.
- Reconhecimento opcional de rotina baseado apenas nos destinos que a pessoa escolhe salvar.
- Chat ligado aos objetos e destinos da conta, com respostas baseadas nas regras locais do aplicativo.

O app não rastreia deslocamentos em segundo plano. A rotina registra um destino somente quando a pessoa toca em “Salvar destino na minha rotina”; desligar esse recurso apaga os destinos salvos. A busca de lugares e as coordenadas mostradas no mapa são enviadas ao OpenStreetMap. A visualização inclui a atribuição dos colaboradores.

O chat não usa um serviço externo de inteligência artificial: responde com os objetos cadastrados, destinos salvos e sugestões do app. O resultado é contextual e não substitui informações profissionais ou de emergência.

## Usabilidade e acessibilidade

A interface usa textos de apoio mais legíveis, áreas maiores para ações frequentes, foco visível ao navegar por teclado e avisos sem bloquear a navegação no site. A revisão consulta as recomendações abertas do [WCAG 2.2](https://www.w3.org/TR/WCAG22/) e os padrões de navegação do [Material Design para Android](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns). O [React Native Paper](https://github.com/callstack/react-native-paper), projeto aberto sob licença MIT, serviu como referência de componentes; nenhuma dependência nova foi adicionada nem código de terceiros foi copiado.

## Chaveiro Bluetooth

O app busca dispositivos BLE, conecta, descobre os serviços e características anunciados e atualiza o estado da conexão na conta. O firmware ainda precisa definir os UUIDs usados pelo chaveiro, o formato do comando do alarme e as regras de detecção de afastamento para habilitar localização sonora e alertas automáticos. Bluetooth exige um build Android ou iOS com o módulo nativo; o Expo Go padrão não inclui react-native-ble-plx.

## Organização do código

- mobile/src/App.tsx: sessão, navegação e integração com a API.
- mobile/src/telas/: uma tela TypeScript por arquivo.
- mobile/src/estilos/: estilos TypeScript das telas e dos componentes.
- mobile/src/componentes/: componentes TypeScript, campos, botões, ilustrações e mapa.
- mobile/src/utils/: utilitários TypeScript, categorias, imagens locais e datas.
- server/src/server.ts: rotas de autenticação, perfil, objetos, lugares, rotina e assistente.
- server/sql/schema.sql: estrutura inicial do MySQL.

## Banco de dados e API local

1. Importe server/sql/schema.sql no MySQL.
2. Copie server/.env.example para server/.env e preencha os dados do banco e um segredo JWT longo.
3. Em um terminal do PowerShell, inicie a API:

    cd C:\Users\pnune\Downloads\Lembrie_projeto_completo\server
    npm install
    npm run dev

A verificação da API fica em http://localhost:3000/health. A troca do e-mail do perfil e a recuperação de senha só são concluídas após digitar o código enviado à caixa de entrada correspondente. O remetente não precisa ser o e-mail da pessoa: cada destinatário recebe o código no endereço informado ou cadastrado. Em produção, configure `RESEND_API_KEY` e `RESEND_FROM` para enviar pela API Resend; localmente também é possível usar as variáveis SMTP. Sem um provedor configurado, o app informa o erro e não imprime códigos no terminal.

## Publicar no Render + TiDB Cloud

O Blueprint `render.yaml` publica a API Node e o site Expo como dois serviços gratuitos do Render. O banco fica no TiDB Cloud Starter, que fala o protocolo MySQL usado pelo app. O Render fornece endereços `onrender.com` e HTTPS sem precisar comprar domínio. A faixa gratuita do TiDB informa 5 GiB de armazenamento por linhas e 50 milhões de unidades de requisição mensais; ao atingir a cota, novas conexões podem ser bloqueadas até a cota voltar. A API grátis do Render pode dormir após 15 minutos sem acesso e levar cerca de um minuto para despertar. Consulte as [cotas do TiDB Cloud Starter](https://docs.pingcap.com/tidbcloud/select-cluster-tier/) e os [limites do Render gratuito](https://render.com/docs/free).

### Criar e conectar os serviços

1. Crie uma instância **TiDB Cloud Starter** gratuita e defina a senha do banco. Na página **Connect**, copie o hostname e o usuário exatamente como aparecem; a conexão pública usa TLS e normalmente a porta `4000`. O usuário inclui o prefixo da instância. O banco inicial `test` pode ser usado pelo Lembriê. [Guia de conexão TiDB](https://docs.pingcap.com/tidbcloud/connect-via-standard-connection-serverless/).
2. No TiDB, mantenha acesso TLS e adicione à lista de rede os endereços de saída do serviço `lembre-api` no Render. No painel do serviço, abra **Connect > Outbound** para copiar as faixas de IP. Durante a migração, permita também temporariamente o IP público do seu computador; remova essa regra quando terminar. [Faixas de saída do Render](https://render.com/docs/outbound-ip-addresses).
3. Crie um repositório Git privado contendo o projeto completo. O Render precisa ler esse repositório para aplicar o Blueprint e publicar atualizações. Não inclua arquivos `.env`, chaves ou senhas.
4. No Render, escolha **New > Blueprint**, conecte o repositório e aplique o arquivo `render.yaml`. O Blueprint cria `lembre-api` e `lembre-web`; preencha `DB_HOST`, `DB_USER` e `DB_PASSWORD` com os dados do TiDB. `DB_PORT=4000`, `DB_NAME=test`, `DB_SSL=true` e o segredo JWT já ficam configurados.
5. Aguarde a API inicializar e criar as tabelas. Antes de divulgar o site, copie seus dados locais usando o procedimento abaixo. O site aparecerá no endereço `lembre-web.onrender.com` (ou no nome escolhido pelo Render) e a API em seu próprio endereço `onrender.com`.

### Códigos de e-mail

O plano grátis do Render bloqueia SMTP nas portas 25, 465 e 587. A API agora aceita o serviço HTTP do Resend usando `RESEND_API_KEY` e `RESEND_FROM`; o SMTP continua disponível para desenvolvimento local. No Render, adicione essas duas variáveis nas configurações da API depois de criar a conta Resend e configurar um remetente aceito/verificado. Sem essa configuração, recuperação de senha e confirmação de e-mail não enviarão códigos. O plano gratuito Resend publica limite de 3.000 mensagens por mês e 100 por dia. [Limites de SMTP no Render](https://render.com/docs/free), [preços do Resend](https://resend.com/pricing?product=transactional).

### Copiar os dados do MySQL local

O script pode copiar contas e hashes de senha, objetos, dispositivos, histórico, preferências, rotinas e perfis de saída. Códigos temporários de redefinição e troca de e-mail não são copiados. Ele para sem gravar se encontrar registros nas tabelas de destino.

1. Mantenha o MySQL local ligado e confirme que `server/.env` aponta para ele. No Windows, copie `server/.env.migrate.example` para `server/.env.migrate` e preencha o hostname TiDB em `TARGET_DB_HOST`, porta `4000`, usuário completo da instância, senha, banco `test` e `TARGET_DB_SSL=true`.
2. Depois que a API do Render criar as tabelas vazias, execute `npm run migrate:cloud` dentro de `server`. O script lê a origem em `server/.env` e o destino em `server/.env.migrate`.
3. Remova do TiDB a regra temporária com o IP do seu computador. Mantenha permitidas as faixas de saída do Render para a API acessar o banco.

Para publicar novas mudanças, envie-as ao repositório; o Render recompila os serviços. A web usa a URL da API configurada pelo Blueprint. Para gerar um app Android/iOS nativo, configure `EXPO_PUBLIC_API_URL` com a URL HTTPS da API no ambiente do EAS e crie um novo build. O Bluetooth físico continua exigindo o app nativo e firmware compatível.

## Aplicativo no celular Android

1. Copie mobile/.env.example para mobile/.env.
2. No PowerShell, execute ipconfig e copie o IPv4 do computador para EXPO_PUBLIC_API_URL, por exemplo http://192.168.0.24:3000. Celular e computador precisam estar na mesma rede Wi-Fi enquanto a API estiver no computador.
3. Em outro terminal, instale as dependências e inicie o Metro:

    cd C:\Users\pnune\Downloads\Lembrie_projeto_completo\mobile
    npm install
    npx expo start --dev-client --host lan

O novo app usa localização e WebView nativas; gere e instale um build de desenvolvimento atualizado antes de conectar:

    npx eas-cli build --platform android --profile development

Instale o aplicativo pelo link/QR do EAS. Deixe os terminais da API e do Metro abertos durante o uso local. Para usar o aplicativo longe do computador, a API e o banco precisam ser publicados em um servidor acessível pela internet, e EXPO_PUBLIC_API_URL precisa apontar para o endereço HTTPS publicado.

O projeto mantém o slug Expo, o identificador Android/iOS e o ID do EAS existentes para preservar a configuração e as credenciais atuais. O nome visível e o ícone do aplicativo mudaram para Lembriê.


