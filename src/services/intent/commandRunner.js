import { spawn } from "node:child_process";
import path from "node:path";

const MAX_OUTPUT = 4 * 1024 * 1024;

export class IntentCommandError extends Error {
  constructor(message, { code = "COMMAND_FAILED", command = "", stderr = "" } = {}) {
    super(message);
    this.name = "IntentCommandError";
    this.code = code;
    this.command = command;
    this.stderr = stderr;
  }
}

export async function runIntentCommand(command, args = [], { timeoutMs = 30000, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args.map(value => String(value)), {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      windowsHide: true,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new IntentCommandError(`O comando ${command} excedeu ${timeoutMs} ms.`, {
        code: "COMMAND_TIMEOUT",
        command,
        stderr,
      }));
    }, Math.max(1000, Number(timeoutMs) || 30000));

    const append = (current, chunk) => {
      const next = current + chunk.toString("utf8");
      return next.length > MAX_OUTPUT ? next.slice(-MAX_OUTPUT) : next;
    };

    child.stdout?.on("data", chunk => { stdout = append(stdout, chunk); });
    child.stderr?.on("data", chunk => { stderr = append(stderr, chunk); });
    child.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const missing = error?.code === "ENOENT";
      reject(new IntentCommandError(
        missing ? `${command} não está instalado ou não está no PATH.` : `${command} falhou: ${error.message}`,
        { code: missing ? "COMMAND_NOT_FOUND" : "COMMAND_FAILED", command, stderr },
      ));
    });
    child.on("close", code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
      reject(new IntentCommandError(
        `${command} terminou com código ${code}${stderr.trim() ? `: ${stderr.trim().slice(0, 700)}` : "."}`,
        { code: "COMMAND_EXIT", command, stderr },
      ));
    });
  });
}