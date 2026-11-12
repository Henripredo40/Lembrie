# Firmware Lambrie para Spotpear ESP32-C3 1.44"

Este sketch faz a tela ST7735 mostrar o destino e os itens essenciais recebidos do app Lembriê por Bluetooth Low Energy.

Para os alertas sonoros, a placa precisa de um **buzzer ativo externo de 3,3 V** (a placa não tem buzzer integrado). Ligue o sinal ao **GPIO6**, VCC a **3V3** e GND a **GND**. Use um módulo com transistor/driver; não ligue um buzzer que exceda a corrente segura do GPIO diretamente.

## Preparar e gravar

1. No Arduino IDE, mantenha **ESP32C3 Dev Module** e a porta da placa selecionadas.
2. Instale **Adafruit GFX Library** e **Adafruit ST7735 and ST7789 Library**. O suporte BLE vem com o pacote de placas ESP32.
3. Abra `esp32c3_lambrie.ino` e carregue para a placa.
4. A tela deve exibir “Aguardando celular”. O dispositivo anunciará o nome `Lambrie ESP32C3`.

## Protocolo BLE

- Serviço: `6f6d0001-7a52-4f6c-9a21-4c454d425249`
- Característica de escrita: `6f6d0002-7a52-4f6c-9a21-4c454d425249`
- Conteúdo UTF-8: JSON com `destination` e `items`, terminado por uma quebra de linha (`\n`).
- Comando de localização: `{"command":"locate"}\n` — toca três bipes curtos.
- Armar alerta de afastamento: `{"command":"arm"}\n` — ao perder a conexão BLE, o chaveiro toca seis bipes.
- Desarmar alerta: `{"command":"disarm"}\n` — usado antes de uma desconexão solicitada pelo usuário.

Exemplo: `{"destination":"Escola","items":"Chaves, Carteira, Remedio"}\n`

O app Android envia o texto em pedaços BLE de 18 bytes e inclui a quebra de linha só no final. O firmware limita a mensagem a 480 caracteres e mostra o texto na tela; o limite visual é menor, então mantenha o destino e a lista curtos.

O alerta automático é baseado na perda da conexão BLE, não em uma distância exata em metros. Paredes, interferência, bateria e o modelo do celular podem afetar quando a conexão cai. A conexão fica ativa enquanto o processo do app permanece em execução; o sistema operacional pode encerrá-la em segundo plano.

## Limitação da primeira versão

O sketch recebe dados enquanto o celular está conectado e não guarda o resumo após desligar a placa. No app, monte a lista em **Antes de sair**, abra **Bluetooth**, conecte a `Lambrie ESP32C3` e use **Enviar resumo da saída para a tela**. O app manda o destino e os itens essenciais ainda não conferidos.

O alerta de afastamento fica armado após conectar pelo app. O app tenta restabelecer essa conexão ao entrar na conta; para procurar o chaveiro quando ele estiver próximo, abra **Bluetooth** e toque em **Localizar chaveiro** no objeto associado. Se estiver fora de alcance, o app informa que não conseguiu conectar.
