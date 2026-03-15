declare module "avrgirl-arduino" {
  class AvrgirlArduino {
    public constructor(options: { board: string; port?: string });
    public flash(hexPath: string, callback: (error?: Error | null) => void): void;
  }

  export = AvrgirlArduino;
}
