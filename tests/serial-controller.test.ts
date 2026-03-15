import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { buildRelayCommand } from "../src/shared/protocol";
import type { ConnectionState, PressureTelemetry } from "../src/shared/types";
import { SerialController } from "../src/main/services/serial/serial-controller";
import type { SerialEndpoint, SerialEndpointFactory } from "../src/main/services/serial/serial-endpoint";

class FakeEndpoint extends EventEmitter implements SerialEndpoint {
  public readonly path: string;
  public isOpen = false;
  public readonly writes: string[] = [];

  public constructor(path: string) {
    super();
    this.path = path;
  }

  public async open(): Promise<void> {
    this.isOpen = true;
  }

  public async write(data: string): Promise<void> {
    this.writes.push(data);
  }

  public async drain(): Promise<void> {}

  public async close(): Promise<void> {
    this.isOpen = false;
    this.emit("close");
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function run(): Promise<void> {
  const endpoint = new FakeEndpoint("COM7");
  const statusUpdates: ConnectionState[] = [];
  const telemetryUpdates: PressureTelemetry[] = [];
  const controller = new SerialController({
    endpointFactory: (() => endpoint) as SerialEndpointFactory,
    onStatus: (status) => {
      statusUpdates.push(status);
    },
    onTelemetry: (telemetry) => {
      telemetryUpdates.push(telemetry);
    },
    clock: () => new Date("2026-03-15T10:00:00.000Z"),
    heartbeatIntervalMs: 5
  });

  await controller.connect("COM7");
  assert.equal(endpoint.writes[0], "HB\n");

  await wait(30);

  const heartbeatWrites = endpoint.writes.filter((command) => command === "HB\n");
  assert.ok(heartbeatWrites.length >= 2);

  endpoint.emit("data", "DATA,500,2.444,4.888,ON\n");
  assert.equal(telemetryUpdates.length, 1);
  assert.equal(telemetryUpdates[0]?.relayState, "ON");

  await controller.disconnect();
  assert.equal(endpoint.writes.at(-1), buildRelayCommand(false));
  assert.equal(statusUpdates.at(-1)?.phase, "disconnected");
}
