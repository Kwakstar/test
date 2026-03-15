import type { ConnectionState, PressureTelemetry, RelayState, UiControlState } from "./types";

export const SERIAL_BAUD_RATE = 115200;
export const HEARTBEAT_INTERVAL_MS = 500;
export const HEARTBEAT_TIMEOUT_MS = 2000;
export const TELEMETRY_INTERVAL_MS = 200;
export const ANALOG_MAX = 1023;
export const MAX_SENSOR_VOLTS = 5;
export const MAX_PRESSURE_BAR = 10;

export function createDefaultConnectionState(): ConnectionState {
  return {
    port: null,
    phase: "idle",
    connected: false,
    flashing: false,
    relayState: "OFF",
    lastError: null,
    connectedAt: null,
    updatedAt: null
  };
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function roundTo(value: number, decimals = 3): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

export function adcToVolts(rawAdc: number): number {
  return roundTo((clamp(rawAdc, 0, ANALOG_MAX) / ANALOG_MAX) * MAX_SENSOR_VOLTS);
}

export function voltsToPressureBar(volts: number): number {
  return roundTo((clamp(volts, 0, MAX_SENSOR_VOLTS) / MAX_SENSOR_VOLTS) * MAX_PRESSURE_BAR);
}

export function rawAdcToPressureBar(rawAdc: number): number {
  return voltsToPressureBar(adcToVolts(rawAdc));
}

export function buildHeartbeatCommand(): string {
  return "HB\n";
}

export function buildRelayCommand(on: boolean): string {
  return on ? "RELAY,ON\n" : "RELAY,OFF\n";
}

export function parseRelayState(value: string): RelayState | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "ON" || normalized === "OFF") {
    return normalized;
  }

  return null;
}

export function parseTelemetryLine(line: string, connectedAt: string | null, updatedAt = new Date().toISOString()): PressureTelemetry | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("DATA,")) {
    return null;
  }

  const [prefix, rawAdcToken, voltsToken, pressureToken, relayToken] = trimmed.split(",");
  if (prefix !== "DATA") {
    return null;
  }

  const rawAdc = Number.parseInt(rawAdcToken, 10);
  const volts = Number.parseFloat(voltsToken);
  const pressureBar = Number.parseFloat(pressureToken);
  const relayState = parseRelayState(relayToken ?? "");

  if (!Number.isFinite(rawAdc) || !Number.isFinite(volts) || !Number.isFinite(pressureBar) || relayState === null) {
    return null;
  }

  return {
    rawAdc,
    volts: roundTo(volts),
    pressureBar: roundTo(pressureBar),
    relayState,
    connectedAt: connectedAt ?? updatedAt,
    updatedAt
  };
}

export function getUiControlState(connection: ConnectionState): UiControlState {
  const hasPort = Boolean(connection.port);
  const busy = connection.phase === "connecting" || connection.flashing;

  return {
    canConnect: hasPort && !connection.connected && !busy,
    canDisconnect: connection.connected && !connection.flashing,
    canToggleRelay: connection.connected && !connection.flashing,
    canUpdateFirmware: hasPort && !connection.connected && !busy
  };
}

export function formatPressureBar(pressureBar: number | null | undefined): string {
  return Number.isFinite(pressureBar ?? Number.NaN) ? `${(pressureBar ?? 0).toFixed(2)} bar` : "--.-- bar";
}

export function phaseLabel(phase: ConnectionState["phase"]): string {
  switch (phase) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "flashing":
      return "Updating Firmware";
    case "error":
      return "Attention Needed";
    default:
      return "Waiting";
  }
}
