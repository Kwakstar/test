export type RelayState = "ON" | "OFF";

export type ConnectionPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "flashing"
  | "error";

export interface PressureTelemetry {
  rawAdc: number;
  volts: number;
  pressureBar: number;
  relayState: RelayState;
  connectedAt: string;
  updatedAt: string;
}

export interface ConnectionState {
  port: string | null;
  phase: ConnectionPhase;
  connected: boolean;
  flashing: boolean;
  relayState: RelayState;
  lastError: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
}

export interface UiControlState {
  canConnect: boolean;
  canDisconnect: boolean;
  canToggleRelay: boolean;
  canUpdateFirmware: boolean;
}

export interface SerialPortOption {
  path: string;
  label: string;
  manufacturer: string | null;
}

export interface FirmwareUpdateResult {
  success: boolean;
  port: string;
  hexPath: string;
  message: string;
}
