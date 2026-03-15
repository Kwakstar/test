import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const rendererDistDir = path.join(distDir, "renderer");
const firmwareSourceDir = path.join(rootDir, "firmware", "dist");
const firmwareDistDir = path.join(distDir, "firmware");
const toolsSourceDir = path.join(rootDir, "tools");
const toolsDistDir = path.join(distDir, "tools");

mkdirSync(rendererDistDir, { recursive: true });
copyFileSync(path.join(rootDir, "src", "renderer", "index.html"), path.join(rendererDistDir, "index.html"));
copyFileSync(path.join(rootDir, "src", "renderer", "styles.css"), path.join(rendererDistDir, "styles.css"));

rmSync(firmwareDistDir, { recursive: true, force: true });
if (existsSync(firmwareSourceDir)) {
  mkdirSync(firmwareDistDir, { recursive: true });
  cpSync(firmwareSourceDir, firmwareDistDir, { recursive: true });
}

rmSync(toolsDistDir, { recursive: true, force: true });
if (existsSync(toolsSourceDir)) {
  mkdirSync(toolsDistDir, { recursive: true });
  cpSync(toolsSourceDir, toolsDistDir, { recursive: true });
}
