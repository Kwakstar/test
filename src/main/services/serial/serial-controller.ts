import { HEARTBEAT_INTERVAL_MS, SERIAL_BAUD_RATE, buildHeartbeatCommand, buildRelayCommand, createDefaultConnectionState, parseTelemetryLine } from "../../../shared/protocol";
import type { ConnectionState, PressureTelemetry } from "../../../shared/types";
import type { SerialEndpoint, SerialEndpointFactory } from "./serial-endpoint";

interface SerialControllerOptions {
  endpointFactory: SerialEndpointFactory;
  onTelemetry: (telemetry: PressureTelemetry) => void;
  onStatus: (status: ConnectionState) => void;
  clock?: () => Date;
  heartbeatIntervalMs?: number;
}

export class SerialController {
  private readonly endpointFactory: SerialEndpointFactory;
  private readonly onTelemetry: (telemetry: PressureTelemetry) => void;
  private readonly onStatus: (status: ConnectionState) => void;
  private readonly clock: () => Date;
  private readonly heartbeatIntervalMs: number;
  private endpoint: SerialEndpoint | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lineBuffer = "";
  private detachListeners: Array<() => void> = [];
  private state: ConnectionState = createDefaultConnectionState();

  public constructor(options: SerialControllerOptions) {
    this.endpointFactory = options.endpointFactory;
    this.onTelemetry = options.onTelemetry;
    this.onStatus = options.onStatus;
    this.clock = options.clock ?? (() => new Date());
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  }

  public getState(): ConnectionState {
    return { ...this.state };
  }

  public publishStatus(partial: Partial<ConnectionState>): ConnectionState {
    return this.updateState(partial);
  }

  public async connect(port: string): Promise<ConnectionState> {
    if (this.endpoint !== null) {
      await this.disconnect();
    }

    this.lineBuffer = "";
    this.updateState({
      port,
      phase: "connecting",
      connected: false,
      flashing: false,
      relayState: "OFF",
      lastError: null
    });

    const endpoint = this.endpointFactory(port, SERIAL_BAUD_RATE);
    this.endpoint = endpoint;
    this.attachEndpoint(endpoint);

    try {
      await endpoint.open();
      const connectedAt = this.nowIso();
      this.updateState({
        port,
        phase: "connected",
        connected: true,
        flashing: false,
        relayState: "OFF",
        connectedAt,
        lastError: null
      });

      this.startHeartbeat();
      await this.safeWrite(buildHeartbeatCommand());
      return this.getState();
    } catch (error) {
      this.stopHeartbeat();
      this.releaseEndpoint(endpoint);
      this.updateState({
        port,
        phase: "error",
        connected: false,
        flashing: false,
        relayState: "OFF",
        lastError: this.errorMessage(error)
      });
      throw error;
    }
  }

  public async disconnect(): Promise<ConnectionState> {
    this.stopHeartbeat();

    const endpoint = this.endpoint;
    if (endpoint === null) {
      if (this.state.phase !== "idle") {
        this.updateState({
          phase: "disconnected",
          connected: false,
          flashing: false,
          relayState: "OFF"
        });
      }

      return this.getState();
    }

    this.releaseEndpoint(endpoint);

    try {
      if (endpoint.isOpen) {
        await endpoint.write(buildRelayCommand(false));
        await endpoint.drain();
      }
    } catch {
      this.updateState({
        lastError: "The relay OFF command could not be confirmed before disconnect."
      });
    }

    try {
      await endpoint.close();
    } finally {
      this.updateState({
        phase: "disconnected",
        connected: false,
        flashing: false,
        relayState: "OFF"
      });
    }

    return this.getState();
  }

  public async setRelay(on: boolean): Promise<ConnectionState> {
    if (this.endpoint === null || !this.state.connected) {
      throw new Error("Connect to the Arduino before controlling the solenoid valve.");
    }

    await this.safeWrite(buildRelayCommand(on));
    return this.updateState({
      relayState: on ? "ON" : "OFF",
      lastError: null
    });
  }

  private attachEndpoint(endpoint: SerialEndpoint): void {
    const handleData = (chunk: string) => {
      this.handleDataChunk(chunk);
    };
    const handleClose = () => {
      this.stopHeartbeat();
      this.updateState({
        connected: false,
        flashing: false,
        phase: "disconnected",
        relayState: "OFF"
      });
    };
    const handleError = (error: Error) => {
      this.stopHeartbeat();
      this.updateState({
        connected: false,
        flashing: false,
        phase: "error",
        relayState: "OFF",
        lastError: this.errorMessage(error)
      });
    };

    endpoint.on("data", handleData);
    endpoint.on("close", handleClose);
    endpoint.on("error", handleError);

    this.detachListeners = [
      () => endpoint.off("data", handleData),
      () => endpoint.off("close", handleClose),
      () => endpoint.off("error", handleError)
    ];
  }

  private releaseEndpoint(endpoint: SerialEndpoint): void {
    if (this.endpoint === endpoint) {
      this.endpoint = null;
    }

    for (const detach of this.detachListeners) {
      detach();
    }
    this.detachListeners = [];
  }

  private handleDataChunk(chunk: string): void {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split(/\r?\n/);
    this.lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const telemetry = parseTelemetryLine(line, this.state.connectedAt, this.nowIso());
      if (telemetry === null) {
        continue;
      }

      this.onTelemetry(telemetry);
      this.updateState({
        connected: true,
        flashing: false,
        phase: "connected",
        relayState: telemetry.relayState,
        connectedAt: telemetry.connectedAt,
        lastError: null
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      void this.safeWrite(buildHeartbeatCommand()).catch(() => undefined);
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async safeWrite(data: string): Promise<void> {
    if (this.endpoint === null || !this.endpoint.isOpen) {
      throw new Error("The serial connection is not open.");
    }

    await this.endpoint.write(data);
  }

  private updateState(partial: Partial<ConnectionState>): ConnectionState {
    this.state = {
      ...this.state,
      ...partial,
      updatedAt: partial.updatedAt ?? this.nowIso()
    };

    const snapshot = { ...this.state };
    this.onStatus(snapshot);
    return snapshot;
  }

  private nowIso(): string {
    return this.clock().toISOString();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
