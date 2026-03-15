import path from "node:path";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const testsDir = path.join(rootDir, "dist-tests", "tests");

function collectTestFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

let failures = 0;
const testFiles = collectTestFiles(testsDir);

for (const testFile of testFiles) {
  try {
    const moduleUrl = pathToFileURL(testFile).href;
    const testModule = await import(moduleUrl);
    if (typeof testModule.run !== "function") {
      throw new Error("Missing exported run() function.");
    }

    await testModule.run();
    console.log(`PASS ${path.relative(rootDir, testFile)}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${path.relative(rootDir, testFile)}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`All ${testFiles.length} test files passed.`);
