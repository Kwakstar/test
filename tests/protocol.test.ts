import assert from "node:assert/strict";
import { adcToVolts, buildHeartbeatCommand, buildRelayCommand, parseTelemetryLine, rawAdcToPressureBar, voltsToPressureBar } from "../src/shared/protocol";

export async function run(): Promise<void> {
  assert.equal(adcToVolts(0), 0);
  assert.equal(adcToVolts(1023), 5);
  assert.equal(voltsToPressureBar(2.5), 5);
  assert.equal(rawAdcToPressureBar(1023), 10);

  const telemetry = parseTelemetryLine("DATA,512,2.502,5.004,ON", "2026-03-15T10:00:00.000Z", "2026-03-15T10:00:00.500Z");
  assert.ok(telemetry);
  assert.equal(telemetry.rawAdc, 512);
  assert.equal(telemetry.volts, 2.502);
  assert.equal(telemetry.pressureBar, 5.004);
  assert.equal(telemetry.relayState, "ON");
  assert.equal(telemetry.connectedAt, "2026-03-15T10:00:00.000Z");

  assert.equal(buildHeartbeatCommand(), "HB\n");
  assert.equal(buildRelayCommand(true), "RELAY,ON\n");
  assert.equal(buildRelayCommand(false), "RELAY,OFF\n");
}
