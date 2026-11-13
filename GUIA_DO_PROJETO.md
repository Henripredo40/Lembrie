# Guia para entender e alterar o projeto

## Começar

Na raiz do repositório, execute `.\iniciar-local.ps1`. Ele inicia a API e o banco no Docker e abre o app web. O passo a passo está no [README](README.md).

## Onde fazer cada mudança

| Se quiser mudar… | Comece por… |
| --- | --- |
| Uma tela do app | `mobile/src/telas/` |
| Botões, cartões ou mapa | `mobile/src/componentes/` |
| Chamadas à API pelo app | `mobile/src/servicos/clienteApi.ts` |
| Navegação e estado geral do app | `mobile/src/App.tsx` |
| Endpoints da API | `server/src/rotas/` |
| Regras de negócio do servidor | `server/src/servicos/` |
| Login e operações offline | `server/src/middleware/` |
| Banco de dados | `server/src/config/` e `server/sql/schema.sql` |
| Bluetooth e comunicação com a placa | `mobile/src/utilitarios/` e `firmware/esp32c3_lambrie/` |
| Pipeline do GitHub | `.github/workflows/qualidade.yml` |

## Caminho de uma requisição

O app chama `clienteApi.ts`; a API recebe a chamada em uma rota de `server/src/rotas/`, aplica regras/serviços e acessa o banco por `server/src/config/banco.ts`.

## Comandos úteis

Execute-os dentro de `server` ou `mobile`, conforme indicado:

```powershell
# API
cd server
npm test
npm run test:coverage
npm run typecheck
npm run build

# App (em outro terminal)
cd mobile
npm run test:componentes
npm run test:coverage
npm run typecheck
```

Os testes ficam próximos ao código que verificam. Ao alterar uma regra, procure o teste do mesmo módulo e atualize ou acrescente um caso.

## Cuidados ao alterar

- Mantenha arquivos `.env` e senhas fora do Git; use os arquivos `.env.example` como modelo.
- Ao mudar o banco, atualize o esquema e a inicialização para manter os ambientes sincronizados.
- Ao adicionar dependências, use npm na pasta correspondente e mantenha o `package-lock.json` junto.
- Os nomes das pastas seguem a função do código. Em geral, prefira criar o arquivo no grupo existente a mover módulos e alterar muitos imports.
