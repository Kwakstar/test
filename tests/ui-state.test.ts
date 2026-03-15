import assert from "node:assert/strict";
import { createDefaultConnectionState, getUiControlState } from "../src/shared/protocol";

export async function run(): Promise<void> {
  const disconnectedConnection = {
    ...createDefaultConnectionState(),
    port: "COM4",
    phase: "disconnected" as const
  };

  const disconnectedUi = getUiControlState(disconnectedConnection);
  assert.equal(disconnectedUi.canConnect, true);
  assert.equal(disconnectedUi.canToggleRelay, false);
  assert.equal(disconnectedUi.canUpdateFirmware, true);

  const connectedConnection = {
    ...createDefaultConnectionState(),
    port: "COM4",
    phase: "connected" as const,
    connected: true
  };

  const connectedUi = getUiControlState(connectedConnection);
  assert.equal(connectedUi.canDisconnect, true);
  assert.equal(connectedUi.canToggleRelay, true);
  assert.equal(connectedUi.canUpdateFirmware, false);
}
