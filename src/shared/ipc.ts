import type { ConnectionState, FirmwareUpdateResult, PressureTelemetry, SerialPortOption } from "./types";

export interface ControlApi {
  listPorts: () => Promise<SerialPortOption[]>;
  connect: (port: string) => Promise<ConnectionState>;
  disconnect: () => Promise<ConnectionState>;
  setRelay: (on: boolean) => Promise<ConnectionState>;
  updateFirmware: (port: string) => Promise<FirmwareUpdateResult>;
  onTelemetry: (listener: (telemetry: PressureTelemetry) => void) => () => void;
  onStatus: (listener: (status: ConnectionState) => void) => () => void;
}
