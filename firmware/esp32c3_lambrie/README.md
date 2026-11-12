# Firmware Lambrie para Spotpear ESP32-C3 1.44"

Este sketch faz a tela ST7735 mostrar o destino e os itens essenciais recebidos do app Lembriê por Bluetooth Low Energy.

## Preparar e gravar

1. No Arduino IDE, mantenha **ESP32C3 Dev Module** e a porta da placa selecionadas.
2. Instale **Adafruit GFX Library** e **Adafruit ST7735 and ST7789 Library**. O suporte BLE vem com o pacote de placas ESP32.
3. Abra `esp32c3_lambrie.ino` e carregue para a placa.
4. A tela deve exibir “Aguardando celular”. O dispositivo anunciará o nome `Lambrie ESP32C3`.

## Protocolo BLE

- Serviço: `6f6d0001-7a52-4f6c-9a21-4c454d425249`
- Característica de escrita: `6f6d0002-7a52-4f6c-9a21-4c454d425249`
- Conteúdo UTF-8: JSON com `destination` e `items`, terminado por uma quebra de linha (`\n`).

Exemplo: `{"destination":"Escola","items":"Chaves, Carteira, Remedio"}\n`

O app Android envia o texto em pedaços BLE de 18 bytes e inclui a quebra de linha só no final. O firmware limita a mensagem a 480 caracteres e mostra o texto na tela; o limite visual é menor, então mantenha o destino e a lista curtos.

## Limitação da primeira versão

O sketch recebe dados enquanto o celular está conectado e não guarda o resumo após desligar a placa. No app, monte a lista em **Antes de sair**, abra **Bluetooth**, conecte a `Lambrie ESP32C3` e use **Enviar resumo da saída para a tela**. O app manda o destino e os itens essenciais ainda não conferidos.
