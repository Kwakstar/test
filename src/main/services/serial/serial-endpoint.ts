export interface SerialEndpoint {
  readonly path: string;
  readonly isOpen: boolean;
  on(event: "data", listener: (chunk: string) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  off(event: "data", listener: (chunk: string) => void): this;
  off(event: "close", listener: () => void): this;
  off(event: "error", listener: (error: Error) => void): this;
  open(): Promise<void>;
  write(data: string): Promise<void>;
  drain(): Promise<void>;
  close(): Promise<void>;
}

export type SerialEndpointFactory = (path: string, baudRate: number) => SerialEndpoint;
