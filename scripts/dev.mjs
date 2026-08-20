import { spawn } from "node:child_process";

const processes = [];

function start(command, args, label) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
      shutdown(code);
    }
  });
  child.on("error", (error) => {
    console.error(`${label} failed`, error instanceof Error ? error.message : error);
    shutdown(1);
  });
  processes.push(child);
}

function shutdown(code = 0) {
  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exitCode = code;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("npm", ["run", "dev:api"], "dev:api");
start("npm", ["run", "dev:web"], "dev:web");
