import { contextBridge, ipcRenderer } from "electron";
import type { ControlApi } from "../shared/ipc";
import type { ConnectionState, PressureTelemetry } from "../shared/types";

function subscribe<T extends PressureTelemetry | ConnectionState>(
  channel: "telemetry:data" | "telemetry:status",
  listener: (payload: T) => void
): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T) => {
    listener(payload);
  };

  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

const api: ControlApi = {
  listPorts: () => ipcRenderer.invoke("serial:listPorts"),
  connect: (port) => ipcRenderer.invoke("serial:connect", port),
  disconnect: () => ipcRenderer.invoke("serial:disconnect"),
  setRelay: (on) => ipcRenderer.invoke("serial:setRelay", on),
  updateFirmware: (port) => ipcRenderer.invoke("firmware:update", port),
  onTelemetry: (listener) => subscribe("telemetry:data", listener),
  onStatus: (listener) => subscribe("telemetry:status", listener)
};

contextBridge.exposeInMainWorld("controlApi", api);
