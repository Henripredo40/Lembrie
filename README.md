# Lembriê

Aplicativo para organizar objetos, preparar saídas e conectar um chaveiro Bluetooth.

Novo no projeto? Comece pelo [guia para entender e alterar o código](GUIA_DO_PROJETO.md).

## Rodar localmente

Requisitos: Node.js com npm e Docker Desktop. Na raiz do projeto, execute:

```powershell
.\iniciar-local.ps1
```

O script inicia a API e o MySQL no Docker, prepara as dependências se necessário e abre o app web. Se ainda não existir, cria `mobile/.env` a partir do exemplo. Para parar o app, pressione `Ctrl+C`; para parar API e banco, execute `docker compose down`. `docker compose down -v` também apaga os dados locais.

## Testes e verificações

Execute os comandos dentro da pasta indicada:

| Pasta | Comandos |
| --- | --- |
| `server` | `npm test`, `npm run typecheck`, `npm run build` |
| `mobile` | `npm run test:componentes`, `npm run test:coverage`, `npm run typecheck` |

O pipeline do GitHub executa testes, cobertura, verificação de tipos e build da API.

## Pastas

- `.github/workflows/`: pipeline de qualidade.
- `docs/qualidade/`: relatórios e apresentação do projeto.
- `firmware/esp32c3_lambrie/`: código e instruções da placa Bluetooth.
- `mobile/src/`: telas, componentes, serviços, estilos e utilitários do app.
- `server/src/`: API, rotas, serviços, autenticação e conexão com o banco.
- `server/sql/`: estrutura inicial do banco.
- `docker-compose.yml` e `render.yaml`: configuração local e publicação.

## Publicação e configurações

O arquivo `render.yaml` configura o site e a API no Render. A API publicada precisa das credenciais do TiDB Cloud com TLS; configure segredos no painel do serviço e nunca os inclua no Git. Para copiar dados locais, configure `server/.env.migrate` a partir do exemplo e execute `npm run migrate:cloud` em `server`.

Gemini é opcional e requer `GEMINI_API_KEY` na API. Sem a chave, o app mantém respostas locais. O mapa precisa de internet. Bluetooth físico funciona somente no app Android/iOS nativo, com firmware e chaveiro compatíveis.

## Observação sobre dados

Enquanto está aberto, o app envia a localização à API para reconhecer lugares e guarda apenas nomes aproximados por até 90 dias. Se Gemini estiver ativado, a pergunta e o contexto necessário são enviados ao Google. O firmware e o protocolo Bluetooth estão explicados em `firmware/esp32c3_lambrie/README.md`.
