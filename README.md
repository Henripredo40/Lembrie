# Lembriê

Aplicativo para cadastrar objetos, montar listas de saída e usar um chaveiro ESP32-C3.

## Rodar no computador

Instale Node.js, npm e Docker Desktop. Na raiz do projeto, execute:

```powershell
.\iniciar-local.ps1
```

O script inicia a API e o banco e abre o app web. Para parar o banco e a API, execute `docker compose down`.

## Pastas

- `aplicativo/codigo/`: telas, componentes, estilos e utilitários do app.
- `servidor/codigo/`: API, rotas, serviços e configuração do banco.
- `servidor/banco/`: esquema inicial do banco.
- `placa/esp32c3/`: sketch e instruções da ESP32-C3.
- `.github/workflows/`: verificações do GitHub.

## App, placa e avisos

Em **Antes de sair**, marque **Lembrar** nos itens que quer ver na placa. Marque o quadradinho maior quando já tiver pegado o item. Ao sair do perímetro salvo, o celular gera uma notificação e só envia o aviso visual à placa se ela já estiver conectada por Bluetooth. O visor preto volta a mostrar o alerta e os itens marcados ainda não conferidos. A placa não tem GPS próprio. O buzzer está comentado e desativado por enquanto.

Para ativar o acompanhamento em segundo plano, permita localização “o tempo todo” e notificações quando o app pedir. O sistema do celular monitora o perímetro mesmo com o app em outra tela; o envio à placa depende da conexão Bluetooth estar ativa.

K1 avança pelos itens; segurar K1 por cerca de um segundo apaga ou reacende a tela. K2 abre o menu. No menu, 1 clique desce, 2 cliques sobem e 3 cliques confirmam. O atalho K1+K2 também alterna a tela.

O firmware guarda a última lista na memória interna da placa. Reiniciar ou desligar não apaga os itens; uma nova lista enviada pelo app substitui a anterior.

## Publicação e configuração

`render.yaml` configura o site e a API no Render. A API publicada precisa das credenciais do banco com TLS. Configure `GEMINI_API_KEY` no Render para ativar as respostas do Gemini; sem a chave, o app usa as respostas locais.

Os perímetros salvos ficam no celular até serem editados ou removidos. O mapa usa dados do OpenStreetMap. Veja as instruções da [placa](placa/esp32c3/README.md).
