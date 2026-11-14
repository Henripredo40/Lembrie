# Firmware do Lembriê

O visor mostra apenas os itens marcados como **Lembrar** no app. A lista fica salva na memória da placa e continua lá depois de reiniciar. Uma lista nova enviada pelo app substitui a anterior.

## Botões e menu

- **K1 (GPIO8):** avança páginas e itens. Segurar por um segundo apaga ou acende o visor.
- **K2 (GPIO10):** abre o menu; no menu, um clique desce, dois sobem e três confirmam.
- **K1 + K2:** alterna o visor entre preto e aceso.
- **Conferir item:** remove o item atual da placa e desmarca **Lembrar** no app quando ele está conectado.
- **Testar alerta:** mostra o aviso de saída no visor.
- **BLE:** pausa ou retoma a divulgação da placa.

Quando o app detectar a saída do perímetro em segundo plano, envia o alerta por BLE somente se a placa já estiver conectada. O firmware acende o visor preto e mostra o aviso com os itens selecionados. Se a placa não estiver conectada, ela não recebe o alerta. A placa não tem GPS próprio e o buzzer segue desativado.

O visor preto mantém a placa ligada e ouvindo o Bluetooth; ao receber um alerta, o firmware volta a desenhar a tela. O esquema deste modelo não indica um pino para desligar eletricamente a tela.

## Gravar na placa

1. No Arduino IDE, selecione **ESP32C3 Dev Module** e a porta USB.
2. Instale **Adafruit GFX Library** e **Adafruit ST7735 and ST7789 Library**. O suporte BLE e `Preferences` vêm com o pacote ESP32.
3. Abra `esp32c3.ino` e carregue para a placa.

As ligações K1/K2 e os pinos seguem o esquema da Spotpear para este modelo.
