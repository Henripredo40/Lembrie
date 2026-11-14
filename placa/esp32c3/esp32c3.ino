#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>
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
static const size_t MAX_MESSAGE = 4096;
static const size_t MAX_ITEMS = 50;
static const size_t MAX_TEXT_LINES = 40;
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

static const uint16_t logoLembre[400] PROGMEM = {
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0x4A39, 0xFFFF, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0xFFFF, 0xFFFF, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39,
  0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39, 0x4A39
};

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
Preferences armazenamento;
BLEServer *bleServer = nullptr;
BLECharacteristic *bleEvents = nullptr;
String receivedMessage;
String destination = "Antes de sair";
String items[MAX_ITEMS];
size_t itemCount = 0;
size_t currentItem = 0;
size_t itemPage = 0;
size_t menuOption = 0;
bool messageReady = false;
volatile bool bluetoothOn = true;
bool screenIsMenu = false;
bool displayIsOn = true;
bool showingDepartureAlert = false;
bool showingOverview = true;

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

void loadItemsFromJson(const String &json) {
  itemCount = 0;
  currentItem = 0;
  itemPage = 0;
  String newDestination = jsonString(json, "destination");
  if (newDestination.length()) destination = newDestination;
  int start = json.indexOf("\"items\"");
  if (start < 0) return;
  start = json.indexOf('[', start);
  if (start < 0) {
    loadItems(jsonString(json, "items"));
    return;
  }
  String item;
  bool insideItem = false;
  bool escaped = false;
  for (int i = start + 1; i < json.length() && itemCount < MAX_ITEMS; i++) {
    const char c = json[i];
    if (!insideItem) {
      if (c == ']') break;
      if (c == '"') { insideItem = true; item = ""; }
    } else if (escaped) {
      if (c == 'n') item += '\n';
      else if (c == 'r') item += '\r';
      else if (c == 't') item += '\t';
      else item += c;
      escaped = false;
    } else if (c == '\\') {
      escaped = true;
    } else if (c == '"') {
      item.trim();
      if (item.length()) items[itemCount++] = item;
      insideItem = false;
    } else {
      item += c;
    }
  }
}

void saveChecklist() {
  const size_t oldCount = armazenamento.getUInt("qtd", 0);
  armazenamento.putString("destino", destination);
  armazenamento.putUInt("qtd", itemCount);
  for (size_t i = 0; i < itemCount; i++) {
    const String key = "item" + String(i);
    armazenamento.putString(key.c_str(), items[i]);
  }
  for (size_t i = itemCount; i < oldCount; i++) {
    const String key = "item" + String(i);
    armazenamento.remove(key.c_str());
  }
}

void loadSavedChecklist() {
  destination = armazenamento.getString("destino", "Antes de sair");
  const uint32_t quantidadeSalva = armazenamento.getUInt("qtd", 0);
  itemCount = quantidadeSalva > MAX_ITEMS ? MAX_ITEMS : quantidadeSalva;
  currentItem = 0;
  itemPage = 0;
  for (size_t i = 0; i < itemCount; i++) {
    const String key = "item" + String(i);
    items[i] = armazenamento.getString(key.c_str(), "");
  }
}

void confirmCurrentItem() {
  if (!itemCount) {
    currentItem = 0;
    itemPage = 0;
    drawChecklist();
    return;
  }
  if (currentItem >= itemCount) return;
  const size_t checkedIndex = currentItem;
  for (size_t i = checkedIndex; i + 1 < itemCount; i++) items[i] = items[i + 1];
  itemCount--;
  if (currentItem >= itemCount && itemCount) currentItem = itemCount - 1;
  itemPage = 0;
  saveChecklist();
  if (bleEvents) {
    const String evento = String("{\"checked\":") + String(checkedIndex) + "}";
    bleEvents->setValue(evento.c_str());
    bleEvents->notify();
    bleEvents->setValue("{}");
  }
  drawChecklist();
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

void drawLargeLogo(int16_t x, int16_t y) {
  for (int16_t row = 0; row < 20; row++) {
    for (int16_t col = 0; col < 20; col++) {
      const uint16_t color = pgm_read_word(&logoLembre[row * 20 + col]);
      tft.fillRect(x + col * 3, y + row * 3, 3, 3, color);
    }
  }
}

void drawStartupScreen(uint8_t progress, const char *status) {
  tft.fillScreen(COLOR_BACKGROUND);
  tft.fillRoundRect(4, 4, 120, 120, 10, COLOR_CARD);
  tft.drawRoundRect(4, 4, 120, 120, 10, COLOR_GREEN_LIGHT);
  drawLargeLogo(34, 13);

  tft.setTextColor(COLOR_GREEN_DARK);
  tft.setTextSize(2);
  tft.setCursor(22, 78);
  tft.print("LEMBRIE");

  tft.setTextSize(1);
  tft.setTextColor(COLOR_MUTED);
  const int16_t statusX = (128 - strlen(status) * 6) / 2;
  tft.setCursor(statusX, 98);
  tft.print(status);

  tft.drawRoundRect(14, 111, 100, 7, 3, COLOR_GREEN_LIGHT);
  const int16_t barWidth = (progress > 100 ? 100 : progress) * 92 / 100;
  if (barWidth > 0) tft.fillRoundRect(18, 113, barWidth, 3, 2, COLOR_GREEN);
}

void drawChecklist() {
  screenIsMenu = false;
  showingDepartureAlert = false;
  showingOverview = false;
  if (!displayIsOn) return;
  char counter[8];
  if (itemCount) snprintf(counter, sizeof(counter), "%u/%u", (unsigned)(currentItem + 1), (unsigned)itemCount);
  else snprintf(counter, sizeof(counter), "--/--");
  drawHeader("LEMBRIE", counter);

  tft.fillRoundRect(5, 32, 118, 76, 8, COLOR_CARD);
  tft.drawRoundRect(5, 32, 118, 76, 8, COLOR_GREEN_LIGHT);
  tft.setTextColor(COLOR_MUTED);
  tft.setCursor(11, 39);
  tft.print(itemCount ? "PEGAR ITEM" : "CHECKLIST");

  if (!itemCount) {
    tft.setTextColor(COLOR_TEXT);
    tft.setCursor(11, 61);
    tft.print("Nenhum item marcado.");
    tft.setTextColor(COLOR_MUTED);
    tft.setCursor(11, 76);
    tft.print("Atualize pelo app.");
  } else {
    tft.setTextColor(COLOR_MUTED);
    tft.setCursor(82, 39);
    tft.print("OK?");
    tft.drawRect(104, 37, 12, 12, COLOR_GREEN_DARK);
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

  drawFooter("K1: AVANCA", "K2:MENU");
}

void drawOverview() {
  screenIsMenu = false;
  showingDepartureAlert = false;
  showingOverview = true;
  if (!displayIsOn) return;
  char counter[12];
  snprintf(counter, sizeof(counter), "%u", (unsigned)itemCount);
  drawHeader("LEMBRIE", counter);
  tft.fillRoundRect(5, 32, 118, 76, 8, COLOR_CARD);
  tft.drawRoundRect(5, 32, 118, 76, 8, COLOR_GREEN_LIGHT);
  drawLargeLogo(34, 39);
  drawFooter("K1: ITENS", "K2:MENU");
}

size_t getAlertPageCount() {
  String lines[MAX_TEXT_LINES];
  size_t lineCount = 0;
  splitItemIntoLines(itemCount ? items[currentItem] : "", lines, lineCount);
  return (lineCount + 2) / 3;
}

void drawDepartureAlert() {
  screenIsMenu = false;
  showingDepartureAlert = true;
  if (!displayIsOn) return;
  char counter[8];
  if (itemCount) snprintf(counter, sizeof(counter), "%u/%u", (unsigned)(currentItem + 1), (unsigned)itemCount);
  else snprintf(counter, sizeof(counter), "--/--");
  drawHeader("ALERTA", counter);
  tft.fillRoundRect(5, 32, 118, 76, 8, COLOR_CARD);
  tft.drawRoundRect(5, 32, 118, 76, 8, COLOR_GREEN_LIGHT);

  tft.fillTriangle(23, 36, 9, 61, 37, 61, 0xF800);
  tft.drawTriangle(23, 36, 9, 61, 37, 61, COLOR_TEXT);
  tft.fillRect(21, 43, 4, 10, COLOR_CARD);
  tft.fillCircle(23, 57, 2, COLOR_CARD);
  tft.setTextColor(COLOR_TEXT);
  tft.setCursor(42, 41);
  tft.print("SAINDO DO");
  tft.setCursor(42, 52);
  tft.print("PERIMETRO");

  if (!itemCount) {
    tft.setCursor(11, 78);
    tft.print("Confira sua lista");
  } else {
    String lines[MAX_TEXT_LINES];
    size_t lineCount = 0;
    splitItemIntoLines(items[currentItem], lines, lineCount);
    const size_t pageCount = (lineCount + 2) / 3;
    if (itemPage >= pageCount) itemPage = pageCount - 1;
    const size_t firstLine = itemPage * 3;
    for (size_t i = 0; i < 3 && firstLine + i < lineCount; i++) {
      tft.setCursor(11, 70 + i * 9);
      tft.print(lines[firstLine + i]);
    }
  }
  drawFooter("K1: PROX", "K2:MENU");
}

void drawMenuOption(size_t option) {
  const char *options[] = {
    bluetoothOn ? "BLE: ligado" : "BLE: pausado",
    "Voltar resumo",
    "Primeiro item",
    "Testar alerta",
    "Conferir item",
    "Apagar tela"
  };
  const int y = 29 + option * 13;
  tft.fillRect(20, y + 1, 100, 10, COLOR_CARD);
  tft.setTextSize(1);
  tft.setTextColor(COLOR_TEXT);
  tft.setCursor(22, y + 2);
  tft.print(options[option]);
}

void drawMenuMarker(size_t option) {
  const int y = 31 + option * 13;
  tft.fillTriangle(8, y, 16, y + 5, 8, y + 10, COLOR_GREEN_DARK);
}

void animateMenuSelection(size_t previousOption, size_t nextOption) {
  const int startY = 31 + previousOption * 13;
  const int endY = 31 + nextOption * 13;
  int markerY = startY;
  for (int step = 1; step <= 4; step++) {
    const int nextY = startY + (endY - startY) * step / 4;
    tft.fillRect(7, markerY, 10, 11, COLOR_CARD);
    tft.fillTriangle(8, nextY, 16, nextY + 5, 8, nextY + 10, COLOR_GREEN_DARK);
    markerY = nextY;
    delay(12);
  }
}

void drawMenu() {
  screenIsMenu = true;
  if (!displayIsOn) return;
  drawHeader("MENU", "");
  tft.fillRoundRect(4, 28, 120, 80, 8, COLOR_CARD);
  for (size_t i = 0; i < 6; i++) drawMenuOption(i);
  drawMenuMarker(menuOption);
  tft.fillRoundRect(4, 111, 120, 15, 6, COLOR_GREEN_LIGHT);
  tft.setTextSize(1);
  tft.setTextColor(COLOR_GREEN_DARK);
  tft.setCursor(7, 115);
  tft.print("1:BAIXO 2:CIMA 3:OK");
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
  drawMenuOption(menuOption);
}

void toggleDisplay() {
  displayIsOn = !displayIsOn;
  if (!displayIsOn) {
    tft.fillScreen(ST77XX_BLACK);
  } else {
    if (screenIsMenu) drawMenu();
    else if (showingDepartureAlert) drawDepartureAlert();
    else if (showingOverview) drawOverview();
    else drawChecklist();
  }
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
  const unsigned long k1LongPressMs = 800;
  const unsigned long multiClickWindowMs = 650;
  const unsigned long comboDebounceMs = 35;
  static bool pendingK1 = false;
  static bool comboLatched = false;
  static unsigned long bothPressedAt = 0;
  static unsigned long k1PressedAt = 0;
  static unsigned long lastK2ClickAt = 0;
  static unsigned int k2ClickCount = 0;
  const unsigned long now = millis();
  const bool k1Event = pressed(buttonK1);
  const bool k2Event = pressed(buttonK2);
  const bool bothDown = buttonK1.stableState == LOW && buttonK2.stableState == LOW;

  if (bothDown) {
    if (bothPressedAt == 0) bothPressedAt = now;
    pendingK1 = false;
    k2ClickCount = 0;
    if (!comboLatched && now - bothPressedAt >= comboDebounceMs) {
      comboLatched = true;
      toggleDisplay();
    }
    return;
  }
  bothPressedAt = 0;
  if (buttonK1.stableState == HIGH && buttonK2.stableState == HIGH) comboLatched = false;
  if (comboLatched) return;

  if (k1Event) { pendingK1 = true; k1PressedAt = now; }
  if (k2Event) {
    if (now - lastK2ClickAt > multiClickWindowMs) k2ClickCount = 0;
    if (k2ClickCount < 3) k2ClickCount++;
    lastK2ClickAt = now;
  }

  if (pendingK1 && buttonK1.stableState == LOW && now - k1PressedAt >= k1LongPressMs) {
    pendingK1 = false;
    toggleDisplay();
  } else if (pendingK1 && buttonK1.stableState == HIGH) {
    pendingK1 = false;
    if (screenIsMenu) return;
    if (showingOverview) {
      itemPage = 0;
      currentItem = 0;
      drawChecklist();
    } else if (itemCount) {
      const size_t pageCount = showingDepartureAlert ? getAlertPageCount() : getItemPageCount();
      if (itemPage + 1 < pageCount) itemPage++;
      else if (currentItem + 1 < itemCount) { currentItem++; itemPage = 0; }
      else if (!showingDepartureAlert) { itemPage = 0; drawOverview(); }
      else { currentItem = 0; itemPage = 0; }
      if (!showingOverview) {
        if (showingDepartureAlert) drawDepartureAlert();
        else drawChecklist();
      }
    }
  }

  if (k2ClickCount && now - lastK2ClickAt >= multiClickWindowMs) {
    const unsigned int clicks = k2ClickCount;
    k2ClickCount = 0;
    if (screenIsMenu) {
      if (clicks == 1) {
        if (menuOption < 5) {
          const size_t previousOption = menuOption;
          menuOption++;
          animateMenuSelection(previousOption, menuOption);
        }
      } else if (clicks == 2) {
        if (menuOption > 0) {
          const size_t previousOption = menuOption;
          menuOption--;
          animateMenuSelection(previousOption, menuOption);
        }
      } else if (menuOption == 0) {
        toggleBluetooth();
      } else if (menuOption == 1) {
        if (showingDepartureAlert) drawDepartureAlert();
        else drawOverview();
      } else if (menuOption == 2) {
        currentItem = 0;
        itemPage = 0;
        drawChecklist();
      } else if (menuOption == 3) {
        currentItem = 0;
        itemPage = 0;
        drawDepartureAlert();
      } else if (menuOption == 4) {
        confirmCurrentItem();
      } else {
        toggleDisplay();
      }
    } else {
      menuOption = 0;
      drawMenu();
    }
  }
}

void setup() {
  Serial.begin(115200);
  armazenamento.begin("lembre", false);
  loadSavedChecklist();
  pinMode(BOTAO_K1, INPUT_PULLUP);
  pinMode(BOTAO_K2, INPUT_PULLUP);

  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  drawStartupScreen(25, "Checklist carregado");

  BLEDevice::init(DEVICE_NAME);
  drawStartupScreen(60, "Iniciando Bluetooth");
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

  drawStartupScreen(100, "Tudo pronto!");
  delay(400);
  drawOverview();
  Serial.println("Lambrie pronto. K1 troca de item e K2 abre o menu.");
}

void loop() {
  handleButtons();

  if (messageReady) {
    messageReady = false;
    const String json = receivedMessage;
    receivedMessage = "";
    const String command = jsonString(json, "command");
    if (command == "alert") {
      displayIsOn = true;
      drawDepartureAlert();
      // iniciarSom(6, 300, 250); // reativar quando instalar o buzzer externo.
      Serial.println("Aviso de saida recebido; buzzer temporariamente desativado.");
    } else if (json.indexOf("\"items\"") >= 0) {
      loadItemsFromJson(json);
      saveChecklist();
      if (json.indexOf("\"alert\":true") >= 0) {
        displayIsOn = true;
        drawDepartureAlert();
      }
      else drawOverview();
      Serial.println("Checklist atualizado pelo aplicativo.");
    }
  }

  delay(20);
}
