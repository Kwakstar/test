namespace PressurePal {
constexpr uint8_t ANALOG_PIN = A0;
constexpr uint8_t RELAY_PIN = 8;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 200;
constexpr unsigned long HEARTBEAT_TIMEOUT_MS = 2000;
constexpr uint8_t SAMPLE_WINDOW = 10;
constexpr float ADC_TO_VOLTS = 5.0f / 1023.0f;
constexpr float VOLTS_TO_BAR = 10.0f / 5.0f;

char commandBuffer[32];
uint8_t commandLength = 0;
int sampleBuffer[SAMPLE_WINDOW];
uint8_t sampleIndex = 0;
bool sampleBufferReady = false;
bool relayOn = false;
unsigned long lastTelemetryAt = 0;
unsigned long lastHeartbeatAt = 0;

void applyRelayState(bool enabled) {
  relayOn = enabled;
  digitalWrite(RELAY_PIN, enabled ? HIGH : LOW);
}

void recordHeartbeat() {
  lastHeartbeatAt = millis();
}

void resetSamples() {
  const int firstSample = analogRead(ANALOG_PIN);
  for (uint8_t index = 0; index < SAMPLE_WINDOW; index++) {
    sampleBuffer[index] = firstSample;
  }
  sampleBufferReady = true;
}

void pushSample(int rawAdc) {
  sampleBuffer[sampleIndex] = rawAdc;
  sampleIndex = (sampleIndex + 1) % SAMPLE_WINDOW;
  if (sampleIndex == 0) {
    sampleBufferReady = true;
  }
}

int readSmoothedAdc() {
  const int rawAdc = analogRead(ANALOG_PIN);
  pushSample(rawAdc);

  uint8_t samplesToAverage = sampleBufferReady ? SAMPLE_WINDOW : sampleIndex;
  if (samplesToAverage == 0) {
    samplesToAverage = 1;
  }

  long total = 0;
  for (uint8_t index = 0; index < samplesToAverage; index++) {
    total += sampleBuffer[index];
  }

  return static_cast<int>(total / samplesToAverage);
}

float rawToVolts(int rawAdc) {
  return rawAdc * ADC_TO_VOLTS;
}

float voltsToBar(float volts) {
  return volts * VOLTS_TO_BAR;
}

void sendTelemetry() {
  const int rawAdc = readSmoothedAdc();
  const float volts = rawToVolts(rawAdc);
  const float pressureBar = voltsToBar(volts);

  Serial.print("DATA,");
  Serial.print(rawAdc);
  Serial.print(",");
  Serial.print(volts, 3);
  Serial.print(",");
  Serial.print(pressureBar, 3);
  Serial.print(",");
  Serial.println(relayOn ? "ON" : "OFF");
}

void handleCommand(const char* command) {
  if (strcmp(command, "HB") == 0) {
    recordHeartbeat();
    return;
  }

  if (strcmp(command, "RELAY,ON") == 0) {
    recordHeartbeat();
    applyRelayState(true);
    return;
  }

  if (strcmp(command, "RELAY,OFF") == 0) {
    recordHeartbeat();
    applyRelayState(false);
  }
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    const char incoming = static_cast<char>(Serial.read());
    if (incoming == '\r') {
      continue;
    }

    if (incoming == '\n') {
      commandBuffer[commandLength] = '\0';
      if (commandLength > 0) {
        handleCommand(commandBuffer);
      }
      commandLength = 0;
      continue;
    }

    if (commandLength < sizeof(commandBuffer) - 1) {
      commandBuffer[commandLength++] = incoming;
    } else {
      commandLength = 0;
    }
  }
}

void enforceHeartbeatSafety() {
  if (millis() - lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
    applyRelayState(false);
  }
}
}

void setup() {
  pinMode(PressurePal::RELAY_PIN, OUTPUT);
  PressurePal::applyRelayState(false);
  Serial.begin(115200);
  PressurePal::resetSamples();
  PressurePal::recordHeartbeat();
}

void loop() {
  PressurePal::readSerialCommands();
  PressurePal::enforceHeartbeatSafety();

  if (millis() - PressurePal::lastTelemetryAt >= PressurePal::TELEMETRY_INTERVAL_MS) {
    PressurePal::lastTelemetryAt = millis();
    PressurePal::sendTelemetry();
  }
}
