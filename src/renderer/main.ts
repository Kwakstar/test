import type { ConnectionState, PressureTelemetry, SerialPortOption } from "../shared/types";

type BannerTone = "neutral" | "success" | "danger";
type RelayState = "ON" | "OFF";

interface DashboardState {
  ports: SerialPortOption[];
  selectedPort: string;
  connection: ConnectionState;
  telemetry: PressureTelemetry | null;
  bannerTone: BannerTone;
  bannerText: string;
  loadingPorts: boolean;
  diagnosticsText: string;
  autoConnectAttempted: boolean;
}

function createDefaultConnectionState(): ConnectionState {
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

function getUiControlState(connection: ConnectionState) {
  const hasPort = Boolean(connection.port);
  const busy = connection.phase === "connecting" || connection.flashing;

  return {
    canConnect: hasPort && !connection.connected && !busy,
    canDisconnect: connection.connected && !connection.flashing,
    canToggleRelay: connection.connected && !connection.flashing,
    canUpdateFirmware: hasPort && !connection.connected && !busy
  };
}

function formatPressureBar(pressureBar: number | null | undefined): string {
  return Number.isFinite(pressureBar ?? Number.NaN) ? `${(pressureBar ?? 0).toFixed(2)} bar` : "--.-- bar";
}

function phaseLabel(phase: ConnectionState["phase"]): string {
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

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing expected element: ${id}`);
  }

  return element as T;
}

const pressureValue = getElement<HTMLParagraphElement>("pressureValue");
const adcValue = getElement<HTMLElement>("adcValue");
const voltsValue = getElement<HTMLElement>("voltsValue");
const lastUpdate = getElement<HTMLParagraphElement>("lastUpdate");
const statusPill = getElement<HTMLSpanElement>("statusPill");
const portSelect = getElement<HTMLSelectElement>("portSelect");
const manualPortInput = getElement<HTMLInputElement>("manualPortInput");
const portDiagnostics = getElement<HTMLParagraphElement>("portDiagnostics");
const portNote = getElement<HTMLParagraphElement>("portNote");
const connectButton = getElement<HTMLButtonElement>("connectButton");
const updateButton = getElement<HTMLButtonElement>("updateButton");
const relayButton = getElement<HTMLButtonElement>("relayButton");
const relayLamp = getElement<HTMLSpanElement>("relayLamp");
const relayLabel = getElement<HTMLSpanElement>("relayLabel");
const messageBanner = getElement<HTMLElement>("messageBanner");
const refreshPortsButton = getElement<HTMLButtonElement>("refreshPortsButton");

const state: DashboardState = {
  ports: [],
  selectedPort: "COM6",
  connection: createDefaultConnectionState(),
  telemetry: null,
  bannerTone: "neutral",
  bannerText: "Starting up and checking the Arduino connection...",
  loadingPorts: false,
  diagnosticsText: "Startup diagnostic: waiting for renderer and preload bridge.",
  autoConnectAttempted: false
};

function apiAvailable(): boolean {
  return typeof window.controlApi !== "undefined";
}

function normalizedPortInput(): string {
  return manualPortInput.value.trim().toUpperCase();
}

function effectiveConnectionState(): ConnectionState {
  return {
    ...state.connection,
    port: state.connection.port ?? (normalizedPortInput() || state.selectedPort || null)
  };
}

function setBanner(text: string, tone: BannerTone): void {
  state.bannerTone = tone;
  state.bannerText = text;
  render();
}

function syncManualInput(): void {
  if (!manualPortInput.value.trim() && state.selectedPort) {
    manualPortInput.value = state.selectedPort;
  }
}

function renderPortOptions(): void {
  const currentSelection = state.selectedPort;
  portSelect.innerHTML = "";

  if (state.ports.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = state.loadingPorts ? "Searching COM ports..." : "No COM ports detected";
    portSelect.append(option);
    portSelect.value = "";
    return;
  }

  for (const port of state.ports) {
    const option = document.createElement("option");
    option.value = port.path;
    option.textContent = port.label;
    portSelect.append(option);
  }

  const selectionIsValid = state.ports.some((port) => port.path === currentSelection);
  state.selectedPort = selectionIsValid ? currentSelection : state.ports[0].path;
  portSelect.value = state.selectedPort;
}

function render(): void {
  renderPortOptions();
  syncManualInput();

  const ui = getUiControlState(effectiveConnectionState());
  const statusClass = effectiveConnectionState().phase === "idle" ? "waiting" : effectiveConnectionState().phase;

  pressureValue.textContent = formatPressureBar(state.telemetry?.pressureBar);
  adcValue.textContent = state.telemetry ? `${state.telemetry.rawAdc}` : "--";
  voltsValue.textContent = state.telemetry ? `${state.telemetry.volts.toFixed(2)} V` : "--.-- V";
  lastUpdate.textContent = state.telemetry
    ? `Last sample at ${new Date(state.telemetry.updatedAt).toLocaleTimeString()}`
    : "Waiting for live data from the Arduino.";

  statusPill.textContent = phaseLabel(state.connection.phase);
  statusPill.className = `status-pill ${statusClass}`;
  portDiagnostics.textContent = state.diagnosticsText;

  if (state.connection.connected) {
    portNote.textContent = `Connected to ${state.connection.port ?? normalizedPortInput()}. Live telemetry is streaming.`;
  } else if (state.loadingPorts) {
    portNote.textContent = "Scanning your computer for Arduino serial ports...";
  } else if (state.ports.length === 0) {
    portNote.textContent = "Dropdown is empty, but you can type COM6 manually and the app will also auto-try COM6.";
  } else {
    portNote.textContent = `${state.ports.length} port(s) found. Choose one or type the port manually below.`;
  }

  connectButton.textContent = state.connection.connected ? "Disconnect" : state.connection.phase === "connecting" ? "Connecting..." : "Connect";
  connectButton.disabled = state.connection.connected ? !ui.canDisconnect : !(normalizedPortInput() && ui.canConnect);
  updateButton.textContent = state.connection.flashing ? "Updating..." : "Update Firmware";
  updateButton.disabled = !(normalizedPortInput() && ui.canUpdateFirmware);
  refreshPortsButton.disabled = state.loadingPorts || state.connection.connected || !apiAvailable();
  refreshPortsButton.textContent = state.loadingPorts ? "Refreshing..." : "Refresh Ports";

  const valveIsOn = state.connection.relayState === "ON";
  relayButton.textContent = valveIsOn ? "Turn Valve OFF" : "Turn Valve ON";
  relayButton.className = `relay-button ${valveIsOn ? "relay-on" : "relay-off"}`;
  relayButton.disabled = !ui.canToggleRelay;
  relayLamp.className = `lamp ${valveIsOn ? "lamp-on" : "lamp-off"}`;
  relayLabel.textContent = `Valve ${valveIsOn ? "ON" : "OFF"}`;

  messageBanner.textContent = state.bannerText;
  messageBanner.className = `message-banner ${state.bannerTone}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function refreshPorts(showSuccessMessage = false): Promise<void> {
  if (!apiAvailable()) {
    state.diagnosticsText = "Preload bridge missing: window.controlApi is not available.";
    setBanner("Renderer loaded, but preload bridge is missing.", "danger");
    return;
  }

  state.loadingPorts = true;
  render();

  try {
    const ports = await window.controlApi.listPorts();
    state.ports = ports;

    if (ports.length > 0) {
      state.selectedPort = ports[0].path;
      manualPortInput.value = manualPortInput.value.trim() ? manualPortInput.value : ports[0].path;
      state.diagnosticsText = `App detected ${ports.length} port(s): ${ports.map((port) => port.label).join(" | ")}`;
    } else {
      state.diagnosticsText = "App did not return any COM ports. Manual input fallback remains available.";
    }

    if (showSuccessMessage) {
      if (ports.length > 0) {
        setBanner(`Found ${ports.length} COM port(s). Auto-trying ${normalizedPortInput() || "COM6"} next.`, "success");
      } else {
        setBanner("No COM ports came back in the dropdown. Auto-trying COM6 anyway.", "danger");
      }
    }
  } catch (error) {
    state.diagnosticsText = `Port scan failed: ${formatError(error)}`;
    setBanner(`Unable to list COM ports: ${formatError(error)}. Auto-trying COM6 anyway.`, "danger");
  } finally {
    state.loadingPorts = false;
    render();
  }
}

async function handleConnectClick(): Promise<void> {
  if (!apiAvailable()) {
    setBanner("Connect failed because the preload bridge is missing.", "danger");
    state.diagnosticsText = "window.controlApi is undefined.";
    render();
    return;
  }

  try {
    if (state.connection.connected) {
      await window.controlApi.disconnect();
      setBanner("Arduino disconnected. The app returned the valve command to OFF.", "neutral");
      await refreshPorts();
      return;
    }

    const targetPort = normalizedPortInput();
    if (!targetPort) {
      setBanner("Type a COM port such as COM6 before connecting.", "danger");
      return;
    }

    state.diagnosticsText = `Trying to connect to ${targetPort}...`;
    render();
    await window.controlApi.connect(targetPort);
    state.selectedPort = targetPort;
    setBanner(`Connected to ${targetPort}. Pressure updates should appear within one second.`, "success");
  } catch (error) {
    state.diagnosticsText = `Connection error on ${normalizedPortInput()}: ${formatError(error)}`;
    setBanner(`Connection failed: ${formatError(error)}`, "danger");
  }
}

async function autoConnectIfPossible(): Promise<void> {
  if (state.autoConnectAttempted || state.connection.connected || !apiAvailable()) {
    return;
  }

  state.autoConnectAttempted = true;
  const targetPort = normalizedPortInput() || "COM6";
  manualPortInput.value = targetPort;
  state.selectedPort = targetPort;
  setBanner(`Auto-connecting to ${targetPort}...`, "neutral");
  await handleConnectClick();
}

async function handleUpdateClick(): Promise<void> {
  if (!apiAvailable()) {
    setBanner("Update failed because the preload bridge is missing.", "danger");
    return;
  }

  const targetPort = normalizedPortInput();
  if (!targetPort) {
    setBanner("Type a COM port such as COM6 before updating firmware.", "danger");
    return;
  }

  try {
    setBanner(`Updating firmware on ${targetPort}. Keep the USB cable connected until the process finishes.`, "neutral");
    const result = await window.controlApi.updateFirmware(targetPort);
    state.selectedPort = targetPort;
    setBanner(result.message, "success");
    await refreshPorts();
  } catch (error) {
    setBanner(`Firmware update failed: ${formatError(error)}`, "danger");
  }
}

async function handleRelayClick(): Promise<void> {
  if (!apiAvailable()) {
    setBanner("Valve control failed because the preload bridge is missing.", "danger");
    return;
  }

  try {
    const nextState = state.connection.relayState !== "ON";
    await window.controlApi.setRelay(nextState);
    setBanner(nextState ? "Solenoid valve command sent: ON." : "Solenoid valve command sent: OFF.", "success");
  } catch (error) {
    setBanner(`Valve command failed: ${formatError(error)}`, "danger");
  }
}

portSelect.addEventListener("change", () => {
  state.selectedPort = portSelect.value;
  manualPortInput.value = portSelect.value;
  render();
});

manualPortInput.addEventListener("input", () => {
  render();
});

refreshPortsButton.addEventListener("click", () => {
  void refreshPorts(true);
});

connectButton.addEventListener("click", () => {
  void handleConnectClick();
});

updateButton.addEventListener("click", () => {
  void handleUpdateClick();
});

relayButton.addEventListener("click", () => {
  void handleRelayClick();
});

if (apiAvailable()) {
  state.diagnosticsText = "Renderer and preload bridge loaded. Scanning ports now.";

  const unsubscribeTelemetry = window.controlApi.onTelemetry((telemetry) => {
    state.telemetry = telemetry;
    state.connection = {
      ...state.connection,
      connected: true,
      phase: "connected",
      relayState: telemetry.relayState as RelayState,
      connectedAt: telemetry.connectedAt,
      updatedAt: telemetry.updatedAt
    };
    state.diagnosticsText = `Telemetry stream active on ${state.connection.port ?? normalizedPortInput()}.`;
    render();
  });

  const unsubscribeStatus = window.controlApi.onStatus((connection) => {
    state.connection = connection;
    if (connection.port) {
      state.selectedPort = connection.port;
      manualPortInput.value = connection.port;
    }

    if (connection.phase === "error" && connection.lastError) {
      state.bannerTone = "danger";
      state.bannerText = connection.lastError;
      state.diagnosticsText = `Status error: ${connection.lastError}`;
    }

    render();
  });

  const refreshTimer = window.setInterval(() => {
    if (!state.connection.connected && !state.loadingPorts) {
      void refreshPorts();
    }
  }, 2000);

  window.addEventListener("beforeunload", () => {
    unsubscribeTelemetry();
    unsubscribeStatus();
    window.clearInterval(refreshTimer);
  });

  render();
  void refreshPorts(true).then(() => autoConnectIfPossible());
} else {
  state.diagnosticsText = "window.controlApi is missing. The UI loaded, but Electron preload did not attach.";
  setBanner("UI loaded, but Electron bridge is missing. Please restart the app.", "danger");
}
