import { EventEmitter } from "node:events";
import { SerialPort } from "serialport";
import type { SerialEndpoint } from "./serial-endpoint";

export class RuntimeSerialEndpoint extends EventEmitter implements SerialEndpoint {
  private readonly port: SerialPort;
  public readonly path: string;

  public constructor(path: string, baudRate: number) {
    super();
    this.path = path;
    this.port = new SerialPort({
      path,
      baudRate,
      autoOpen: false
    });

    this.port.on("data", (chunk: Buffer) => {
      this.emit("data", chunk.toString("utf8"));
    });

    this.port.on("close", () => {
      this.emit("close");
    });

    this.port.on("error", (error: Error) => {
      this.emit("error", error);
    });
  }

  public get isOpen(): boolean {
    return this.port.isOpen;
  }

  public open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.open((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  public write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.write(data, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  public drain(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.drain((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  public close(): Promise<void> {
    if (!this.port.isOpen) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.port.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

export function createRuntimeSerialEndpoint(path: string, baudRate: number): SerialEndpoint {
  return new RuntimeSerialEndpoint(path, baudRate);
}
