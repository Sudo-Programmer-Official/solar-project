import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

async function main() {
  const root = process.cwd();
  const testFiles = [
    ...(await collectTests(path.join(root, "apps"))),
    ...(await collectTests(path.join(root, "packages"))),
  ].sort();

  if (testFiles.length === 0) {
    console.error("No test files found.");
    process.exitCode = 1;
    return;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tests exited with code ${code ?? 1}`));
      }
    });
    child.on("error", reject);
  });
}

async function collectTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTests(absolute)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(absolute);
    }
  }
  return files;
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
