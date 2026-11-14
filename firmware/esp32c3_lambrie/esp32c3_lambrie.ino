#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <string.h>

// Spotpear ESP32-C3 com tela ST7735 de 1,44 polegada.
#define TFT_SCLK 3
#define TFT_MOSI 4
#define TFT_CS   2
#define TFT_DC   0
#define TFT_RST  5
#define BOTAO_K1 8
#define BOTAO_K2 10

static const char *SERVICE_UUID = "6f6d0001-7a52-4f6c-9a21-4c454d425249";
static const char *DATA_UUID = "6f6d0002-7a52-4f6c-9a21-4c454d425249";
static const char *EVENT_UUID = "6f6d0003-7a52-4f6c-9a21-4c454d425249";
static const char *DEVICE_NAME = "Lambrie ESP32C3";
static const size_t MAX_MESSAGE = 480;
static const size_t MAX_ITEMS = 20;

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
BLEServer *bleServer = nullptr;
BLECharacteristic *bleEvents = nullptr;
String receivedMessage;
String items[MAX_ITEMS];
size_t itemCount = 0;
size_t currentItem = 0;
size_t menuOption = 0;
bool messageReady = false;
bool bluetoothOn = true;
bool screenIsMenu = false;

struct Button {
  int pin;
  int lastReading = HIGH;
  int stableState = HIGH;
  unsigned long changedAt = 0;
};

Button buttonK1{BOTAO_K1};
Button buttonK2{BOTAO_K2};

String decodeBase64(const String &encoded) {
  const char *alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String decoded;
  unsigned int buffer = 0;
  int bits = 0;
  for (size_t i = 0; i < encoded.length(); i++) {
    if (encoded[i] == '=') break;
    const char *found = strchr(alphabet, encoded[i]);
    if (!found) continue;
    buffer = (buffer << 6) | (unsigned int)(found - alphabet);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      decoded += (char)((buffer >> bits) & 0xFF);
    }
  }
  return decoded;
}

class DataCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    // O app envia os dados em pacotes Base64 pequenos pelo Bluetooth.
    String chunk = decodeBase64(characteristic->getValue().c_str());
    for (size_t i = 0; i < chunk.length(); i++) {
      const char c = chunk[i];
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

class ServerCallbacks : public BLEServerCallbacks {
  void onDisconnect(BLEServer *server) override {
    if (bluetoothOn) BLEDevice::startAdvertising();
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

void loadItems(const String &text) {
  itemCount = 0;
  currentItem = 0;
  int start = 0;
  while (start <= text.length() && itemCount < MAX_ITEMS) {
    int end = text.indexOf(',', start);
    if (end < 0) end = text.length();
    String item = text.substring(start, end);
    item.trim();
    if (item.length() && item != "Checklist completo" && item != "Nenhum item pendente") {
      items[itemCount++] = item;
    }
    if (end == text.length()) break;
    start = end + 1;
  }
}

void drawChecklist() {
  screenIsMenu = false;
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(true);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 5);
  tft.println("LEMBRIE | CHECKLIST");
  tft.drawFastHLine(4, 18, 120, ST77XX_BLUE);

  if (itemCount == 0) {
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(4, 34);
    tft.println("Nenhum item pendente.");
    tft.setCursor(4, 52);
    tft.println("Cadastre e confira os");
    tft.println("objetos pelo aplicativo.");
  } else {
    tft.setTextColor(ST77XX_YELLOW);
    tft.setCursor(4, 28);
    tft.print("ITEM ");
    tft.print(currentItem + 1);
    tft.print(" DE ");
    tft.println(itemCount);
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(4, 48);
    tft.println(items[currentItem]);
  }

  tft.setTextColor(ST77XX_GREEN);
  tft.setCursor(4, 98);
  tft.println(bluetoothOn ? "Bluetooth ligado" : "Bluetooth desligado");
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 114);
  tft.println("K1: proximo  K2: menu");
}

void drawMenu() {
  screenIsMenu = true;
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(false);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 6);
  tft.println("MENU LEMBRIE");
  tft.drawFastHLine(4, 18, 120, ST77XX_BLUE);

  const char *options[] = { bluetoothOn ? "Desligar Bluetooth" : "Ligar Bluetooth", "Voltar ao checklist" };
  for (size_t i = 0; i < 2; i++) {
    tft.setCursor(4, 42 + i * 24);
    tft.setTextColor(i == menuOption ? ST77XX_YELLOW : ST77XX_WHITE);
    tft.print(i == menuOption ? "> " : "  ");
    tft.println(options[i]);
  }
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 104);
  tft.println("K1: escolher");
  tft.println("K2: confirmar");
}

void toggleBluetooth() {
  bluetoothOn = !bluetoothOn;
  if (bluetoothOn) {
    BLEDevice::startAdvertising();
  } else {
    BLEDevice::stopAdvertising();
    if (bleServer && bleServer->getConnectedCount() > 0) {
      bleServer->disconnect(bleServer->getConnId());
    }
  }
  drawMenu();
}

bool pressed(Button &button) {
  const int reading = digitalRead(button.pin);
  if (reading != button.lastReading) {
    button.lastReading = reading;
    button.changedAt = millis();
  }
  if (millis() - button.changedAt < 35 || reading == button.stableState) return false;
  button.stableState = reading;
  return reading == LOW;
}

void handleButtons() {
  const bool next = pressed(buttonK1);
  const bool select = pressed(buttonK2);
  if (!next && !select) return;

  if (!screenIsMenu) {
    if (next && itemCount > 0) currentItem = (currentItem + 1) % itemCount;
    else if (select) { menuOption = 0; drawMenu(); return; }
    drawChecklist();
    return;
  }

  if (next) {
    menuOption = (menuOption + 1) % 2;
    drawMenu();
  } else if (menuOption == 0) {
    toggleBluetooth();
  } else {
    drawChecklist();
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BOTAO_K1, INPUT_PULLUP);
  pinMode(BOTAO_K2, INPUT_PULLUP);

  // A tela é inicializada uma vez e não recebe comando para dormir/desligar.
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  drawChecklist();

  BLEDevice::init(DEVICE_NAME);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  BLEService *service = bleServer->createService(SERVICE_UUID);
  BLECharacteristic *data = service->createCharacteristic(
    DATA_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  data->setCallbacks(new DataCallbacks());
  bleEvents = service->createCharacteristic(
    EVENT_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  bleEvents->addDescriptor(new BLE2902());
  bleEvents->setValue("{}");
  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();

  drawChecklist();
  Serial.println("Lambrie pronto. K1 troca de item e K2 abre o menu.");
}

void loop() {
  handleButtons();

  if (messageReady) {
    messageReady = false;
    const String json = receivedMessage;
    receivedMessage = "";
    const String newItems = jsonString(json, "items");
    if (newItems.length() || json.indexOf("\"items\":\"\"") >= 0) {
      loadItems(newItems);
      drawChecklist();
      Serial.println("Checklist atualizado pelo aplicativo.");
    }
  }

  delay(20);
}
