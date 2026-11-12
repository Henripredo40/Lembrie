#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

// Spotpear ESP32-C3 Spaceman/Pendant, LCD ST7735 128x128.
#define TFT_SCLK 3
#define TFT_MOSI 4
#define TFT_CS   2
#define TFT_DC   0
#define TFT_RST  5

// Lambrie BLE service. The Android app writes a UTF-8 JSON document to DATA.
static const char *SERVICE_UUID = "6f6d0001-7a52-4f6c-9a21-4c454d425249";
static const char *DATA_UUID    = "6f6d0002-7a52-4f6c-9a21-4c454d425249";
static const char *DEVICE_NAME  = "Lambrie ESP32C3";
static const size_t MAX_MESSAGE = 480;

Adafruit_ST7735 tft(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
String receivedMessage;
bool messageReady = false;

class LambrieCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String value = characteristic->getValue();
    for (size_t i = 0; i < value.length(); i++) {
      char c = value[i];
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

String jsonString(const String &json, const char *key) {
  String token = String("\"") + key + "\"";
  int start = json.indexOf(token);
  if (start < 0) return "";
  start = json.indexOf(':', start + token.length());
  if (start < 0) return "";
  start = json.indexOf('"', start + 1);
  if (start < 0) return "";
  String result;
  bool escaped = false;
  for (int i = start + 1; i < json.length(); i++) {
    char c = json[i];
    if (escaped) { result += c; escaped = false; }
    else if (c == '\\') escaped = true;
    else if (c == '"') break;
    else result += c;
  }
  return result;
}

void drawScreen(const String &destination, const String &items) {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(true);
  tft.setTextSize(1);
  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 4);
  tft.println("LEMBRIE | SAIDA");
  tft.drawFastHLine(4, 17, 120, ST77XX_BLUE);
  tft.setTextColor(ST77XX_YELLOW);
  tft.setCursor(4, 23);
  tft.println("DESTINO:");
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4, 35);
  tft.println(destination.length() ? destination : "(nao informado)");
  tft.setTextColor(ST77XX_GREEN);
  tft.setCursor(4, 56);
  tft.println("LEVAR:");
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(4, 68);
  if (!items.length()) tft.println("Nenhum essencial");
  else tft.println(items);
}

void setup() {
  Serial.begin(115200);
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  drawScreen("Aguardando celular", "Conecte pelo app");

  BLEDevice::init(DEVICE_NAME);
  BLEServer *server = BLEDevice::createServer();
  BLEService *service = server->createService(SERVICE_UUID);
  BLECharacteristic *data = service->createCharacteristic(
    DATA_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  data->setCallbacks(new LambrieCallbacks());
  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("Lambrie BLE pronto; aguardando dados do app.");
}

void loop() {
  if (messageReady) {
    messageReady = false;
    String json = receivedMessage;
    receivedMessage = "";
    String destination = jsonString(json, "destination");
    String items = jsonString(json, "items");
    drawScreen(destination, items);
    Serial.println("Resumo recebido do app:");
    Serial.println(json);
  }
  delay(20);
}
