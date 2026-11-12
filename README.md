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
- Chat contextual por IA (Gemini) e sugestões de itens por destino, com fallback local enquanto a chave do modelo não estiver configurada.

O Lembriê exige permissão de localização para uso após o login. Enquanto o app ou site estiver aberto, ele verifica a posição em intervalos e envia as coordenadas à API para identificar lugares; não executa rastreamento em segundo plano nem salva coordenadas. Guarda somente nomes aproximados dos locais visitados por até 90 dias para analisar frequência e sugerir itens. A busca de lugares e as coordenadas mostradas no mapa são enviadas ao OpenStreetMap. Quando Gemini estiver ativado, a pergunta, o destino e os nomes/categorias dos objetos são enviados ao Google; as chamadas usam `store:false` para não guardar histórico de interação no serviço. A visualização inclui a atribuição dos colaboradores.

O assistente usa Gemini quando `GEMINI_API_KEY` está configurada no servidor. Crie uma chave em [Google AI Studio — API Keys](https://aistudio.google.com/app/apikey) e adicione-a como variável secreta no serviço `lembre-api` do Render. `GEMINI_MODEL` pode ser definido para escolher outro modelo compatível. Sem a chave, o app continua usando respostas e sugestões locais. O resultado é contextual e não substitui informações profissionais ou de emergência.

## Como abrir e demonstrar o aplicativo

A versão local precisa de **Node.js com npm** e **MySQL**. O aplicativo web é suficiente para demonstrar as telas e o fluxo principal; Bluetooth físico exige Android/iOS nativo e um chaveiro compatível.

### Preparar o projeto

1. No GitHub, abra o repositório e escolha **Code > Download ZIP** (ou clone o repositório com Git). Extraia o ZIP e abra a pasta do projeto no PowerShell.
2. Na raiz do projeto, suba a API e o MySQL com Docker Compose:

```powershell
docker compose up --build
```

O Compose cria o banco, espera a verificação de saúde do MySQL e inicia a API. Na primeira inicialização, a API cria e atualiza as tabelas automaticamente. A API fica em `http://localhost:3000/health`. Os dados ficam no volume Docker `dados_mysql`.

Se preferir executar a API fora do Docker, importe `server/sql/schema.sql` no MySQL, copie `server/.env.example` para `server/.env` e configure a conexão local conforme descrito em [Banco de dados e API local](#banco-de-dados-e-api-local).

3. Em outro terminal, instale as dependências do app e abra a versão web:

```powershell
Copy-Item server/.env.example server/.env
Set-Location server
npm ci
```

4. Edite `server/.env`: informe `DB_USER`, `DB_PASSWORD` e, se necessário, `DB_NAME` conforme o MySQL local. Defina também um `JWT_SECRET` longo. Salve o arquivo e inicie a API:

```powershell
npm run dev
```

5. Em outro terminal, a partir da pasta raiz do projeto, instale as dependências do app e inicie a versão web:

```powershell
Set-Location mobile
npm ci
npx expo start --web
```

O Expo mostra o endereço local no terminal (normalmente `http://localhost:8081`). Abra-o no navegador. A configuração de exemplo aponta o app para a API em `http://localhost:3000`; confira `mobile/.env.example` se esse endereço precisar mudar. A API deve responder em `http://localhost:3000/health` antes de testar login e dados.

### Roteiro de demonstração

1. Crie uma conta de avaliação pela tela inicial; a conta fica no banco MySQL local.
2. Cadastre alguns objetos, marque pelo menos um como essencial e mostre busca, edição e categorias.
3. Abra **Saída**, escolha um destino e confira a lista sugerida; salve uma saída e consulte o histórico.
4. Mostre perfil, configurações e as telas de mapa/rotina. Recursos de mapa precisam de internet e de acesso aos serviços OpenStreetMap.
5. Abra **Assistente** para mostrar as respostas locais. A integração Gemini é opcional e só funciona se a chave estiver configurada no servidor.

Para parar os serviços locais, use `docker compose down`; para apagar também o banco de demonstração, use `docker compose down -v`. Para apresentar em outro computador ou pela internet, publique API, banco e site e compartilhe o endereço do site; os passos de publicação estão em [Publicar no Render + TiDB Cloud](#publicar-no-render--tidb-cloud). Não compartilhe arquivos `.env` nem credenciais. Para uma demonstração reproduzível, use uma conta e um banco de avaliação sem dados pessoais reais.

O mapa usa MapLibre e o estilo Liberty do OpenFreeMap por padrão, sem chave de API. Para trocar o estilo, configure `EXPO_PUBLIC_MAP_STYLE_URL` em `mobile/.env`. O mapa nativo exige gerar e instalar um novo build de desenvolvimento após adicionar o módulo MapLibre; o Expo Go padrão não contém esse módulo.

### Uso sem conexão

Depois de entrar na conta com internet pelo menos uma vez, o app mantém no aparelho uma cópia dos objetos, eventos, perfil, preferências, perfis de saída e planos de rotina. Se a API cair, alterações compatíveis ficam numa fila local associada à conta e aparecem no app como pendentes. Ao voltar ao primeiro plano com a API disponível, a fila é enviada em ordem e o servidor confirma cada operação antes de removê-la. A fila continua guardada se o app fechar ou o aparelho reiniciar.

O modo offline cobre cadastro/edição/remoção de objetos, alterações de nome, preferências, eventos, perfis de saída e planos de rotina. Troca de e-mail, senha, login, localização, busca de endereços, mapa e assistente online precisam de conexão. As alterações locais ficam em AsyncStorage no app nativo ou no armazenamento do navegador; não ficam no contêiner da API.

### Verificações para avaliação técnica

Na pasta `server`, rode `npm test`, `npm run typecheck` e `npm run build`. Na pasta `mobile`, rode `npm run typecheck`. Esses comandos verificam regras unitárias da API, tipos e compilação; eles não substituem a demonstração manual no navegador.

## Usabilidade e acessibilidade

A interface usa textos de apoio mais legíveis, áreas maiores para ações frequentes, foco visível ao navegar por teclado e avisos sem bloquear a navegação no site. A revisão consulta as recomendações abertas do [WCAG 2.2](https://www.w3.org/TR/WCAG22/) e os padrões de navegação do [Material Design para Android](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns). O [React Native Paper](https://github.com/callstack/react-native-paper), projeto aberto sob licença MIT, serviu como referência de componentes; as dependências do mapa estão listadas em `mobile/package.json`.

## Chaveiro Bluetooth

O app busca dispositivos BLE, conecta, descobre os serviços e características anunciados, envia o resumo para a tela e oferece o comando **Localizar chaveiro**, tentando reconectar ao dispositivo associado. Após conectar, arma no firmware um alerta sonoro acionado quando a conexão BLE se perde; o usuário pode desarmá-lo ao desconectar manualmente. O alerta usa a perda de conexão como indicação de afastamento, não mede distância em metros. A placa Spotpear precisa de um buzzer ativo externo de 3,3 V ligado ao GPIO6 conforme `firmware/esp32c3_lambrie/README.md`. Bluetooth exige um build Android ou iOS com o módulo nativo; o Expo Go padrão não inclui react-native-ble-plx.

## Organização do código

- mobile/src/App.tsx: composição principal e navegação do aplicativo.
- mobile/src/telas/: uma tela TypeScript por arquivo.
- mobile/src/estilos/: estilos TypeScript das telas e dos componentes.
- mobile/src/componentes/: componentes TypeScript, campos, botões, ilustrações e `MapaLibre.web.tsx`/`MapaLibre.native.tsx`.
- mobile/src/utilitarios/: utilitários TypeScript, categorias, imagens locais e datas.
- server/src/server.ts: configuração HTTP e composição das rotas.
- server/src/rotas/: endpoints separados por conta, objetos/rotina, planejamento/assistente e lugares.
- server/src/servicos/: regras de sugestões e formatação de lugares.
- server/src/middleware/: autenticação das requisições.
- server/src/config/banco.ts e iniciarBanco.ts: conexão e inicialização/migração do MySQL.
- mobile/src/utilitarios/filaSemConexao.ts: cache local e envio posterior de alterações.
- docker-compose.yml e server/Dockerfile: ambiente local reproduzível para API e MySQL.
- server/src/servicos/\*.test.ts e mobile/src/utilitarios/regrasFilaSemConexao.test.ts: testes unitários sem depender do banco ou da rede.
- server/sql/schema.sql: estrutura inicial do MySQL.

### Qualidade e referência às normas ISO

O projeto usa a **ISO/IEC 25010:2023** como modelo para avaliar qualidade do produto (por exemplo, manutenibilidade, confiabilidade, segurança e eficiência) e a **ISO/IEC/IEEE 12207:2026** como referência para organizar atividades do ciclo de vida. São referências para orientar melhorias; esta documentação e os testes não significam certificação nem conformidade formal com as normas.

| Objetivo          | Prática no projeto                                                   | Como verificar                                         |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Manutenibilidade  | Separar telas, componentes, configuração e regras de negócio         | Revisar dependências e responsabilidade dos módulos    |
| Confiabilidade    | Testar regras puras isoladas e validar tipos                         | `cd server; npm test` e `npm run typecheck`            |
| Segurança         | Manter autenticação transversal em middleware e segredos no ambiente | Revisar rotas protegidas e arquivos `.env` fora do Git |
| Reprodutibilidade | Instalar versões registradas nos arquivos de lock                    | `npm ci` em `server` e `mobile`                        |

Para executar os testes da API, entre na pasta `server`, instale dependências com `npm ci` e rode `npm test`. A suíte cobre as regras puras de sugestões e lugares, o registro das rotas por domínio e a resposta saudável do endpoint `/health` com banco simulado. `npm run typecheck` verifica os tipos e `npm run build` gera a versão compilada. Testes que precisam de MySQL, e-mail, mapas ou internet ainda exigem serviços configurados.

## Banco de dados e API local

> **Aviso para quem for testar localmente:** as pastas geradas `server/node_modules` e `server/dist` não ficam no projeto. Para preparar o servidor neste computador, entre em `server` e execute `npm ci`; depois inicie com `npm run dev`. O arquivo `server/.env` também precisa estar configurado para o banco local. O deploy do Render instala as dependências e compila o servidor automaticamente.

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
