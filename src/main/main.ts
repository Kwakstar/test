import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { SerialPort } from "serialport";
import { createRuntimeSerialEndpoint } from "./services/serial/runtime-serial-endpoint";
import { SerialController } from "./services/serial/serial-controller";
import { RuntimeFirmwareFlasher, resolveBundledHexPath } from "./services/firmware/flasher";
import type { ConnectionState, PressureTelemetry, SerialPortOption } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let quittingSafely = false;
const defaultAutoConnectPort = process.env.DEFAULT_ARDUINO_PORT ?? "COM6";

function broadcast(channel: "telemetry:data" | "telemetry:status", payload: PressureTelemetry | ConnectionState): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

const serialController = new SerialController({
  endpointFactory: createRuntimeSerialEndpoint,
  onTelemetry: (telemetry) => {
    broadcast("telemetry:data", telemetry);
  },
  onStatus: (status) => {
    broadcast("telemetry:status", status);
  }
});

const firmwareFlasher = new RuntimeFirmwareFlasher();

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function getIndexHtmlPath(): string {
  return path.join(__dirname, "..", "..", "renderer", "index.html");
}

function toSerialPortOptions(ports: Awaited<ReturnType<typeof SerialPort.list>>): SerialPortOption[] {
  return ports
    .map((port) => {
      const labelParts = [port.path, port.manufacturer, port.vendorId && port.productId ? `${port.vendorId}:${port.productId}` : null].filter(
        (part): part is string => Boolean(part)
      );

      return {
        path: port.path,
        label: labelParts.join("  |  "),
        manufacturer: port.manufacturer ?? null
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function tryAutoConnect(): Promise<void> {
  try {
    const ports = await SerialPort.list();
    const hasDefaultPort = ports.some((port) => port.path.toUpperCase() === defaultAutoConnectPort.toUpperCase());
    if (!hasDefaultPort) {
      serialController.publishStatus({
        port: defaultAutoConnectPort,
        phase: "error",
        connected: false,
        flashing: false,
        relayState: "OFF",
        lastError: `Auto-connect skipped: ${defaultAutoConnectPort} was not found.`
      });
      return;
    }

    await serialController.connect(defaultAutoConnectPort);
  } catch (error) {
    serialController.publishStatus({
      port: defaultAutoConnectPort,
      phase: "error",
      connected: false,
      flashing: false,
      relayState: "OFF",
      lastError: `Auto-connect failed: ${formatError(error)}`
    });
  }
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: "#fff4f6",
    title: "Pressure Pal Control Room",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await mainWindow.loadFile(getIndexHtmlPath());
  broadcast("telemetry:status", serialController.getState());
  void tryAutoConnect();
}

function registerIpcHandlers(): void {
  ipcMain.handle("serial:listPorts", async () => {
    const ports = await SerialPort.list();
    return toSerialPortOptions(ports);
  });

  ipcMain.handle("serial:connect", async (_event, port: string) => {
    return serialController.connect(port);
  });

  ipcMain.handle("serial:disconnect", async () => {
    return serialController.disconnect();
  });

  ipcMain.handle("serial:setRelay", async (_event, on: boolean) => {
    return serialController.setRelay(on);
  });

  ipcMain.handle("firmware:update", async (_event, port: string) => {
    try {
      await serialController.disconnect();
      serialController.publishStatus({
        port,
        phase: "flashing",
        connected: false,
        flashing: true,
        relayState: "OFF",
        lastError: null
      });

      const result = await firmwareFlasher.flash({
        port,
        hexFilePath: resolveBundledHexPath()
      });

      serialController.publishStatus({
        port,
        phase: "disconnected",
        connected: false,
        flashing: false,
        relayState: "OFF",
        lastError: null
      });

      return result;
    } catch (error) {
      serialController.publishStatus({
        port,
        phase: "error",
        connected: false,
        flashing: false,
        relayState: "OFF",
        lastError: formatError(error)
      });
      throw error;
    }
  });
}

app.on("before-quit", (event) => {
  if (quittingSafely) {
    return;
  }

  event.preventDefault();
  quittingSafely = true;
  void serialController.disconnect().finally(() => {
    app.quit();
  });
});

app.whenReady()
  .then(async () => {
    registerIpcHandlers();
    await createMainWindow();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow();
      }
    });
  })
  .catch((error) => {
    console.error("Failed to start Pressure Pal Control Room.", formatError(error));
    app.exit(1);
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
