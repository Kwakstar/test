import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { app } from "electron";
import type { FirmwareUpdateResult } from "../../../shared/types";

const BUNDLED_HEX_FILE = "arduino-pressure-controller.uno.hex";
const BOARD_FQBN = "arduino:avr:uno";

export interface FlashRequest {
  port: string;
  hexFilePath: string;
}

function resolveArduinoCliCommand(): string {
  const candidates = [
    process.env.ARDUINO_CLI,
    path.join(process.resourcesPath, "tools", "arduino-cli.exe"),
    path.resolve(__dirname, "..", "..", "..", "..", "tools", "arduino-cli.exe"),
    path.resolve(__dirname, "..", "..", "..", "..", "..", "tools", "arduino-cli.exe"),
    "arduino-cli"
  ].filter((candidate): candidate is string => Boolean(candidate));

  const localCandidate = candidates.find((candidate) => candidate.endsWith(".exe") && existsSync(candidate));
  return localCandidate ?? candidates[candidates.length - 1];
}

function runArduinoCli(args: string[]): Promise<void> {
  const cliCommand = resolveArduinoCliCommand();

  return new Promise((resolve, reject) => {
    const child = spawn(cliCommand, args, {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `arduino-cli exited with code ${exitCode ?? "unknown"}.`));
    });
  });
}

export class RuntimeFirmwareFlasher {
  public async flash(request: FlashRequest): Promise<FirmwareUpdateResult> {
    if (!existsSync(request.hexFilePath)) {
      throw new Error(`Bundled firmware not found at ${request.hexFilePath}. Run "npm run firmware:build" after installing Arduino CLI.`);
    }

    await runArduinoCli([
      "upload",
      "--fqbn",
      BOARD_FQBN,
      "--port",
      request.port,
      "--input-file",
      request.hexFilePath,
      "--verify"
    ]);

    return {
      success: true,
      port: request.port,
      hexPath: request.hexFilePath,
      message: "Firmware updated successfully. Reconnect to resume live monitoring."
    };
  }
}

export function resolveBundledHexPath(): string {
  const candidates = [
    path.join(process.resourcesPath, "firmware", BUNDLED_HEX_FILE),
    path.resolve(__dirname, "..", "..", "..", "..", "firmware", BUNDLED_HEX_FILE),
    path.join(app.getAppPath(), "firmware", "dist", BUNDLED_HEX_FILE)
  ];

  const existingCandidate = candidates.find((candidate) => existsSync(candidate));
  return existingCandidate ?? candidates[1];
}
