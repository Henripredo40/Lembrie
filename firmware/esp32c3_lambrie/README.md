# Firmware do Lembriê

O sketch controla a tela e o Bluetooth da placa Spotpear ESP32-C3 1.44". Ele mostra os itens enviados pelo app e permite navegar pelo visor usando os dois botões laterais.

## Controles do chaveiro

- **K1 (GPIO8):** próximo objeto; no menu, muda a opção.
- **K2 (GPIO10):** abre o menu; dentro dele, confirma a opção.
- **Cadastrar objeto:** escolha essa opção com o celular conectado e deixe a tela Bluetooth do app aberta. O app pede o nome, salva na conta e envia o novo objeto para o visor.
- **BLE ligado/desligado:** para ou retoma a divulgação do chaveiro. Ao desligar, uma conexão existente é encerrada. Para ligar novamente, use o menu físico.

Os botões K1/K2 e seus pinos são os indicados para este modelo pela [Spotpear](https://spotpear.com/ESP32-C3-desktop-trinket-Mini-TV-Portable-Pendant-LVGL-1.44inch-LCD-ST7735/forum-answer/416.html).

## Gravar na placa

1. No Arduino IDE, selecione **ESP32C3 Dev Module** e a porta USB.
2. Instale **Adafruit GFX Library** e **Adafruit ST7735 and ST7789 Library**. O suporte BLE vem com o pacote ESP32.
3. Abra `esp32c3_lambrie.ino` e carregue para a placa.

Para o alerta sonoro, conecte um buzzer ativo externo de 3,3 V ao GPIO6, 3V3 e GND. Use módulo com driver; a placa não tem buzzer integrado.

## Comunicação e alertas

- Serviço BLE: `6f6d0001-7a52-4f6c-9a21-4c454d425249`.
- Escrita do app: `6f6d0002-7a52-4f6c-9a21-4c454d425249`.
- Eventos do chaveiro para o app: `6f6d0003-7a52-4f6c-9a21-4c454d425249`.
- A placa aceita JSON de até 480 caracteres em pacotes de 18 bytes.
- `locate` toca três bipes; `arm` ativa o aviso de desconexão; `disarm` desativa esse aviso.

A desconexão BLE indica afastamento aproximado, não mede distância. O resumo exibido não é mantido depois que a placa é desligada.
