import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const toolsCli = path.join(rootDir, "tools", "arduino-cli.exe");
const cliCommand = process.env.ARDUINO_CLI ?? (existsSync(toolsCli) ? toolsCli : "arduino-cli");
const sketchDir = path.join(rootDir, "firmware", "arduino-pressure-controller");
const outputDir = path.join(rootDir, "firmware", "dist");
const outputHex = path.join(outputDir, "arduino-pressure-controller.uno.hex");

function runCli(args) {
  const result = spawnSync(cliCommand, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`arduino-cli exited with code ${result.status ?? "unknown"}.`);
  }
}

try {
  runCli(["version"]);
} catch (error) {
  throw new Error(
    `Arduino CLI was not found. Install it or place arduino-cli.exe in ${path.join(rootDir, "tools")}. Original error: ${error instanceof Error ? error.message : String(error)}`
  );
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

runCli(["compile", "--fqbn", "arduino:avr:uno", "--output-dir", outputDir, sketchDir]);

const hexFiles = readdirSync(outputDir).filter((fileName) => fileName.endsWith(".hex") && !fileName.includes("with_bootloader"));
if (hexFiles.length === 0) {
  throw new Error("No HEX file was produced by arduino-cli.");
}

copyFileSync(path.join(outputDir, hexFiles[0]), outputHex);
console.log(`Bundled firmware ready at ${outputHex}`);
