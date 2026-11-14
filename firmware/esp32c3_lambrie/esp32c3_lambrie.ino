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
static const size_t MAX_TEXT_LINES = 10;
static const size_t CHARS_PER_LINE = 17;
static const size_t LINES_PER_PAGE = 5;

static const uint16_t COLOR_BACKGROUND = 0xF7DE;
static const uint16_t COLOR_CARD = 0xFFFF;
static const uint16_t COLOR_TEXT = 0x2185;
static const uint16_t COLOR_GREEN = 0x13CD;
static const uint16_t COLOR_GREEN_DARK = 0x12EA;
static const uint16_t COLOR_GREEN_LIGHT = 0xE7BE;
static const uint16_t COLOR_GREEN_SOFT = 0xDFF3;
static const uint16_t COLOR_MUTED = 0x6DB5;

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
BLEServer *bleServer = nullptr;
BLECharacteristic *bleEvents = nullptr;
String receivedMessage;
String items[MAX_ITEMS];
size_t itemCount = 0;
size_t currentItem = 0;
size_t itemPage = 0;
size_t menuOption = 0;
bool messageReady = false;
volatile bool bluetoothOn = true;
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
  itemPage = 0;
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

String displayText(String text) {
  text.replace("á", "a"); text.replace("à", "a"); text.replace("â", "a"); text.replace("ã", "a"); text.replace("ä", "a");
  text.replace("Á", "A"); text.replace("À", "A"); text.replace("Â", "A"); text.replace("Ã", "A"); text.replace("Ä", "A");
  text.replace("é", "e"); text.replace("è", "e"); text.replace("ê", "e"); text.replace("ë", "e");
  text.replace("É", "E"); text.replace("È", "E"); text.replace("Ê", "E"); text.replace("Ë", "E");
  text.replace("í", "i"); text.replace("ì", "i"); text.replace("î", "i"); text.replace("ï", "i");
  text.replace("Í", "I"); text.replace("Ì", "I"); text.replace("Î", "I"); text.replace("Ï", "I");
  text.replace("ó", "o"); text.replace("ò", "o"); text.replace("ô", "o"); text.replace("õ", "o"); text.replace("ö", "o");
  text.replace("Ó", "O"); text.replace("Ò", "O"); text.replace("Ô", "O"); text.replace("Õ", "O"); text.replace("Ö", "O");
  text.replace("ú", "u"); text.replace("ù", "u"); text.replace("û", "u"); text.replace("ü", "u");
  text.replace("Ú", "U"); text.replace("Ù", "U"); text.replace("Û", "U"); text.replace("Ü", "U");
  text.replace("ç", "c"); text.replace("Ç", "C");
  return text;
}

void splitItemIntoLines(String text, String lines[], size_t &lineCount) {
  text = displayText(text);
  text.trim();
  lineCount = 0;
  String line;
  size_t start = 0;

  while (start < text.length() && lineCount < MAX_TEXT_LINES) {
    while (start < text.length() && text[start] == ' ') start++;
    if (start >= text.length()) break;
    int end = text.indexOf(' ', start);
    if (end < 0) end = text.length();
    String word = text.substring(start, end);

    while (word.length() > CHARS_PER_LINE && lineCount < MAX_TEXT_LINES) {
      if (line.length()) {
        lines[lineCount++] = line;
        line = "";
        if (lineCount >= MAX_TEXT_LINES) break;
      }
      lines[lineCount++] = word.substring(0, CHARS_PER_LINE);
      word = word.substring(CHARS_PER_LINE);
    }
    if (lineCount >= MAX_TEXT_LINES) break;
    if (word.length()) {
      if (line.length() && line.length() + 1 + word.length() > CHARS_PER_LINE) {
        lines[lineCount++] = line;
        line = "";
      }
      if (line.length()) line += ' ';
      line += word;
    }
    start = end + 1;
  }

  if (line.length() && lineCount < MAX_TEXT_LINES) lines[lineCount++] = line;
  if (!lineCount) lines[lineCount++] = "(sem nome)";
}

size_t getItemPageCount() {
  String lines[MAX_TEXT_LINES];
  size_t lineCount = 0;
  splitItemIntoLines(itemCount ? items[currentItem] : "", lines, lineCount);
  return (lineCount + LINES_PER_PAGE - 1) / LINES_PER_PAGE;
}

void drawHeader(const char *title, const char *counter) {
  tft.fillScreen(COLOR_BACKGROUND);
  tft.fillRect(0, 0, 128, 27, COLOR_GREEN);
  tft.setTextWrap(false);
  tft.setTextColor(COLOR_CARD);
  tft.setTextSize(2);
  tft.setCursor(7, 5);
  tft.print(title);
  tft.setTextSize(1);
  tft.setCursor(96, 10);
  tft.print(counter);
}

void drawFooter(const char *left, const char *right) {
  tft.fillRoundRect(4, 111, 120, 15, 6, COLOR_GREEN_LIGHT);
  tft.setTextSize(1);
  tft.setTextColor(COLOR_GREEN_DARK);
  tft.setCursor(8, 115);
  tft.print(left);
  tft.setCursor(82, 115);
  tft.print(right);
}

void drawChecklist() {
  screenIsMenu = false;
  char counter[8];
  if (itemCount) snprintf(counter, sizeof(counter), "%u/%u", (unsigned)(currentItem + 1), (unsigned)itemCount);
  else snprintf(counter, sizeof(counter), "--/--");
  drawHeader("LEMBRIE", counter);

  tft.fillRoundRect(5, 32, 118, 76, COLOR_CARD);
  tft.drawRoundRect(5, 32, 118, 76, 8, COLOR_GREEN_LIGHT);
  tft.setTextColor(COLOR_MUTED);
  tft.setCursor(11, 39);
  tft.print(itemCount ? "OBJETO PENDENTE" : "CHECKLIST");

  if (!itemCount) {
    tft.setTextColor(COLOR_TEXT);
    tft.setCursor(11, 61);
    tft.print("Sem item pendente.");
    tft.setTextColor(COLOR_MUTED);
    tft.setCursor(11, 76);
    tft.print("Atualize pelo app.");
  } else {
    String lines[MAX_TEXT_LINES];
    size_t lineCount = 0;
    splitItemIntoLines(items[currentItem], lines, lineCount);
    const size_t pageCount = (lineCount + LINES_PER_PAGE - 1) / LINES_PER_PAGE;
    if (itemPage >= pageCount) itemPage = pageCount - 1;
    const size_t firstLine = itemPage * LINES_PER_PAGE;
    tft.setTextColor(COLOR_TEXT);
    for (size_t i = 0; i < LINES_PER_PAGE && firstLine + i < lineCount; i++) {
      tft.setCursor(11, 53 + i * 9);
      tft.print(lines[firstLine + i]);
    }
    if (pageCount > 1) {
      tft.setTextColor(COLOR_GREEN);
      tft.setCursor(68, 98);
      tft.print("PARTE ");
      tft.print(itemPage + 1);
      tft.print("/");
      tft.print(pageCount);
    }
  }

  drawFooter("K1: AVANCA", "K2: MENU");
}

void drawMenu() {
  screenIsMenu = true;
  drawHeader("MENU", "");
  tft.setTextSize(1);

  const char *options[] = {
    bluetoothOn ? "BLE: ligado" : "BLE: pausado",
    "Voltar checklist"
  };
  for (size_t i = 0; i < 2; i++) {
    const int y = 39 + i * 35;
    const uint16_t background = i == menuOption ? COLOR_GREEN : COLOR_CARD;
    const uint16_t foreground = i == menuOption ? COLOR_CARD : COLOR_TEXT;
    tft.fillRoundRect(6, y, 116, 29, 8, background);
    tft.setTextColor(foreground);
    tft.setCursor(12, y + 11);
    tft.print(i == menuOption ? "> " : "  ");
    tft.print(options[i]);
  }
  drawFooter("K1: MOVER", "K2: OK");
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
    if (next && itemCount > 0) {
      if (itemPage + 1 < getItemPageCount()) itemPage++;
      else {
        currentItem = (currentItem + 1) % itemCount;
        itemPage = 0;
      }
    }
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
