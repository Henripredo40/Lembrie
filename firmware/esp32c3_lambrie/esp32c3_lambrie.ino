#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <string>

// Tela Spotpear ESP32-C3 1.44" ST7735, 128x128.
#define TFT_SCLK 3
#define TFT_MOSI 4
#define TFT_CS   2
#define TFT_DC   0
#define TFT_RST  5
#define BOTAO_K1 8
#define BOTAO_K2 10

// Serviço usado pelo app para enviar resumos e receber pedidos do chaveiro.
static const char *SERVICE_UUID  = "6f6d0001-7a52-4f6c-9a21-4c454d425249";
static const char *DATA_UUID     = "6f6d0002-7a52-4f6c-9a21-4c454d425249";
static const char *EVENT_UUID    = "6f6d0003-7a52-4f6c-9a21-4c454d425249";
static const char *DEVICE_NAME   = "Lambrie ESP32C3";
static const size_t MAX_MESSAGE  = 480;
static const int BUZZER_PIN      = 6;
static const size_t MAX_ITENS    = 20;

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
BLEServer *servidorBLE = nullptr;
BLECharacteristic *eventosBLE = nullptr;
String receivedMessage;
bool messageReady = false;
bool bluetoothAtivo = true;
bool alertaAfastamentoArmado = false;
bool solicitarAlertaAfastamento = false;
bool solicitarLocalizacao = false;
bool conexãoBleAtiva = false;
unsigned long instanteDesconexão = 0;
bool somAtivo = false;
bool buzzerLigado = false;
int pulsosRestantes = 0;
unsigned int tempoLigadoMs = 0;
unsigned int tempoDesligadoMs = 0;
unsigned long proximaEtapaSom = 0;

String destinoAtual;
String itensAtuais[MAX_ITENS];
size_t quantidadeItens = 0;
size_t indiceItemAtual = 0;
enum Tela { TELA_RESUMO, TELA_MENU, TELA_CADASTRO, TELA_MENSAGEM };
Tela telaAtual = TELA_RESUMO;
size_t opcaoMenu = 0;
unsigned long mensagemAte = 0;
String mensagemTitulo;
String mensagemTexto;

struct BotaoEstado {
  int pino;
  int leituraAtual = HIGH;
  int estadoEstavel = HIGH;
  unsigned long mudouEm = 0;
};
BotaoEstado botaoK1{BOTAO_K1};
BotaoEstado botaoK2{BOTAO_K2};

bool pressionado(BotaoEstado &botao) {
  const int leitura = digitalRead(botao.pino);
  if (leitura != botao.leituraAtual) {
    botao.leituraAtual = leitura;
    botao.mudouEm = millis();
  }
  if (millis() - botao.mudouEm < 35 || leitura == botao.estadoEstavel) return false;
  botao.estadoEstavel = leitura;
  return leitura == LOW;
}

void iniciarSom(int pulsos, unsigned int ligadoMs, unsigned int desligadoMs) {
  pulsosRestantes = pulsos;
  tempoLigadoMs = ligadoMs;
  tempoDesligadoMs = desligadoMs;
  somAtivo = pulsos > 0;
  buzzerLigado = somAtivo;
  digitalWrite(BUZZER_PIN, buzzerLigado ? HIGH : LOW);
  proximaEtapaSom = millis() + tempoLigadoMs;
}

void atualizarSom() {
  if (!somAtivo || millis() < proximaEtapaSom) return;
  if (buzzerLigado) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerLigado = false;
    pulsosRestantes--;
    if (pulsosRestantes <= 0) {
      somAtivo = false;
      return;
    }
    proximaEtapaSom = millis() + tempoDesligadoMs;
  } else {
    digitalWrite(BUZZER_PIN, HIGH);
    buzzerLigado = true;
    proximaEtapaSom = millis() + tempoLigadoMs;
  }
}

class LambrieCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String value = characteristic->getValue();
    for (size_t i = 0; i < value.length(); i++) {
      const char c = value[i];
      if (c == '\n') {
        messageReady = true;
      } else if (receivedMessage.length() < MAX_MESSAGE) {
        receivedMessage += c;
      } else {
        receivedMessage = "";
      }
    }
  }
};

class LambrieServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    conexãoBleAtiva = true;
    solicitarAlertaAfastamento = false;
  }

  void onDisconnect(BLEServer *server) override {
    conexãoBleAtiva = false;
    instanteDesconexão = millis();
    solicitarAlertaAfastamento = alertaAfastamentoArmado;
    if (bluetoothAtivo) BLEDevice::startAdvertising();
  }
};

String jsonString(const String &json, const char *key) {
  const String token = String("\"") + key + "\"";
  int start = json.indexOf(token);
  if (start < 0) return "";
  start = json.indexOf(':', start + token.length());
  if (start < 0) return "";
  start = json.indexOf('"', start + 1);
  if (start < 0) return "";
  String result;
  bool escaped = false;
  for (int i = start + 1; i < json.length(); i++) {
    const char c = json[i];
    if (escaped) { result += c; escaped = false; }
    else if (c == '\\') escaped = true;
    else if (c == '"') break;
    else result += c;
  }
  return result;
}

void carregarItens(const String &texto) {
  quantidadeItens = 0;
  indiceItemAtual = 0;
  int início = 0;
  while (início <= texto.length() && quantidadeItens < MAX_ITENS) {
    int fim = texto.indexOf(',', início);
    if (fim < 0) fim = texto.length();
    String item = texto.substring(início, fim);
    item.trim();
    if (item.length()) itensAtuais[quantidadeItens++] = item;
    if (fim == texto.length()) break;
    início = fim + 1;
  }
  if (!quantidadeItens) itensAtuais[quantidadeItens++] = "Nenhum item recebido";
}

void desenharResumo() {
  telaAtual = TELA_RESUMO;
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(true);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 4);
  tft.println("LEMBRIE | SAIDA");
  tft.drawFastHLine(4, 17, 120, ST77XX_BLUE);
  tft.setTextColor(ST77XX_YELLOW);
  tft.setCursor(4, 22);
  tft.println("DESTINO:");
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4, 33);
  tft.println(destinoAtual.length() ? destinoAtual : "Aguardando app");
  tft.setTextColor(ST77XX_GREEN);
  tft.setCursor(4, 58);
  tft.print("OBJETO ");
  tft.print(indiceItemAtual + 1);
  tft.print("/");
  tft.println(quantidadeItens);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4, 72);
  String itemVisivel = itensAtuais[indiceItemAtual];
  if (itemVisivel.length() > 34) itemVisivel = itemVisivel.substring(0, 31) + "...";
  tft.println(itemVisivel);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 101);
  tft.println("K1: proximo  K2: menu");
  tft.setTextColor(bluetoothAtivo ? ST77XX_GREEN : ST77XX_RED);
  tft.setCursor(4, 116);
  tft.print(bluetoothAtivo ? "BLE ligado" : "BLE desligado");
  if (conexãoBleAtiva) tft.print(" | app ligado");
}

void desenharMenu() {
  telaAtual = TELA_MENU;
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(false);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 6);
  tft.println("CONFIG. CHAVEIRO");
  tft.drawFastHLine(4, 18, 120, ST77XX_BLUE);
  const char *opções[] = {"Cadastrar objeto", bluetoothAtivo ? "BLE: ligado" : "BLE: desligado", "Voltar"};
  for (size_t i = 0; i < 3; i++) {
    tft.setCursor(4, 38 + i * 22);
    tft.setTextColor(i == opcaoMenu ? ST77XX_YELLOW : ST77XX_WHITE);
    tft.print(i == opcaoMenu ? "> " : "  ");
    tft.println(opções[i]);
  }
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 108);
  tft.println("K1: escolher");
  tft.println("K2: confirmar");
}

void desenharCadastro(const String &texto) {
  telaAtual = TELA_CADASTRO;
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(true);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 6);
  tft.println("CADASTRAR OBJETO");
  tft.drawFastHLine(4, 18, 120, ST77XX_BLUE);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4, 31);
  tft.println(texto);
  tft.setTextColor(ST77XX_YELLOW);
  tft.setCursor(4, 94);
  tft.println("Use o app Lambrie");
  tft.println("para digitar e salvar.");
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 116);
  tft.println("K1: voltar  K2: menu");
}

void mostrarMensagem(const String &titulo, const String &texto) {
  telaAtual = TELA_MENSAGEM;
  mensagemTitulo = titulo;
  mensagemTexto = texto;
  mensagemAte = millis() + 5000;
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(true);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_GREEN);
  tft.setCursor(4, 10);
  tft.println(titulo);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4, 35);
  tft.println(texto);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 108);
  tft.println("K1 ou K2: continuar");
}

void solicitarCadastroNoApp() {
  if (!bluetoothAtivo || !conexãoBleAtiva || !eventosBLE) {
    desenharCadastro("Conecte o chaveiro ao app primeiro.");
    return;
  }
  const std::string evento = "{\"event\":\"register_object\"}";
  eventosBLE->setValue(evento);
  eventosBLE->notify();
  desenharCadastro("Pedido enviado. Informe o nome no app; o objeto sera salvo na sua conta.");
}

void alternarBluetooth() {
  bluetoothAtivo = !bluetoothAtivo;
  alertaAfastamentoArmado = false;
  solicitarAlertaAfastamento = false;
  if (bluetoothAtivo) {
    BLEDevice::startAdvertising();
    mostrarMensagem("BLUETOOTH LIGADO", "O chaveiro pode ser encontrado pelo app.");
  } else {
    BLEDevice::stopAdvertising();
    if (servidorBLE && servidorBLE->getConnectedCount() > 0) {
      servidorBLE->disconnect(servidorBLE->getConnId());
    }
    mostrarMensagem("BLUETOOTH DESLIGADO", "Use o menu do chaveiro para ligar novamente.");
  }
}

void tratarBotoes() {
  const bool próximo = pressionado(botaoK1);
  const bool selecionar = pressionado(botaoK2);
  if (!próximo && !selecionar) return;

  if (telaAtual == TELA_RESUMO) {
    if (próximo) {
      indiceItemAtual = (indiceItemAtual + 1) % quantidadeItens;
      desenharResumo();
    } else {
      opcaoMenu = 0;
      desenharMenu();
    }
    return;
  }
  if (telaAtual == TELA_MENU) {
    if (próximo) {
      opcaoMenu = (opcaoMenu + 1) % 3;
      desenharMenu();
    } else if (opcaoMenu == 0) {
      solicitarCadastroNoApp();
    } else if (opcaoMenu == 1) {
      alternarBluetooth();
    } else {
      desenharResumo();
    }
    return;
  }
  if (telaAtual == TELA_CADASTRO) {
    if (próximo) desenharResumo();
    else desenharMenu();
    return;
  }
  if (telaAtual == TELA_MENSAGEM) desenharMenu();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(BOTAO_K1, INPUT_PULLUP);
  pinMode(BOTAO_K2, INPUT_PULLUP);
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  carregarItens("");
  desenharResumo();

  BLEDevice::init(DEVICE_NAME);
  servidorBLE = BLEDevice::createServer();
  servidorBLE->setCallbacks(new LambrieServerCallbacks());
  BLEService *service = servidorBLE->createService(SERVICE_UUID);
  BLECharacteristic *data = service->createCharacteristic(
    DATA_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  data->setCallbacks(new LambrieCallbacks());
  eventosBLE = service->createCharacteristic(
    EVENT_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  eventosBLE->addDescriptor(new BLE2902());
  eventosBLE->setValue("{}");
  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("Lambrie BLE pronto; use K1 e K2 para navegar.");
}

void loop() {
  tratarBotoes();

  if (solicitarAlertaAfastamento && conexãoBleAtiva) solicitarAlertaAfastamento = false;
  if (solicitarAlertaAfastamento && millis() - instanteDesconexão >= 1000) {
    solicitarAlertaAfastamento = false;
    if (alertaAfastamentoArmado && !conexãoBleAtiva) {
      iniciarSom(6, 300, 250);
      Serial.println("Conexao perdida: alerta sonoro de afastamento.");
    }
  }
  if (solicitarLocalizacao) {
    solicitarLocalizacao = false;
    iniciarSom(3, 120, 120);
    Serial.println("Comando localizar recebido.");
  }
  if (messageReady) {
    messageReady = false;
    const String json = receivedMessage;
    receivedMessage = "";
    const String destination = jsonString(json, "destination");
    const String items = jsonString(json, "items");
    const String command = jsonString(json, "command");
    if (command == "arm") {
      alertaAfastamentoArmado = true;
      Serial.println("Alerta de afastamento armado.");
    } else if (command == "disarm") {
      alertaAfastamentoArmado = false;
      Serial.println("Alerta de afastamento desarmado.");
    } else if (command == "locate") {
      solicitarLocalizacao = true;
    } else if (command == "registration_done") {
      if (eventosBLE) eventosBLE->setValue("{}");
      mostrarMensagem("OBJETO CADASTRADO", "O objeto foi salvo e sincronizado com o app.");
    } else if (command == "registration_error") {
      if (eventosBLE) eventosBLE->setValue("{}");
      mostrarMensagem("CADASTRO NAO SALVO", "Confira o app e tente novamente.");
    } else if (destination.length() || items.length()) {
      if (eventosBLE) eventosBLE->setValue("{}");
      destinoAtual = destination;
      carregarItens(items);
      desenharResumo();
      Serial.println("Resumo recebido do app:");
      Serial.println(json);
    }
  }
  if (telaAtual == TELA_MENSAGEM && millis() >= mensagemAte) desenharMenu();
  atualizarSom();
  delay(20);
}
