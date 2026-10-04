import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_OUTPUT = 4 * 1024 * 1024;
const WINDOWS_SHELL_META = /[\u0000\r\n"&|<>^%!]/;

export class IntentCommandError extends Error {
  constructor(message, { code = "COMMAND_FAILED", command = "", stderr = "" } = {}) {
    super(message);
    this.name = "IntentCommandError";
    this.code = code;
    this.command = command;
    this.stderr = stderr;
  }
}

function validateCommand(command) {
  const value = String(command || "").trim();
  if (!value) {
    throw new IntentCommandError("Comando vazio.", { code: "COMMAND_INVALID" });
  }
  if (path.isAbsolute(value)) return value;
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new IntentCommandError(`Comando inválido: ${value}`, {
      code: "COMMAND_INVALID",
      command: value,
    });
  }
  return value;
}

export function quoteWindowsCmdArg(value) {
  const text = String(value);
  if (WINDOWS_SHELL_META.test(text)) {
    throw new IntentCommandError(
      "Argumento recusado pelo executor seguro do Windows por conter caractere especial de shell.",
      { code: "COMMAND_UNSAFE_ARGUMENT" },
    );
  }
  return `"${text}"`;
}

function whereWindows(command) {
  try {
    const result = spawnSync("where.exe", [command], {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 5000,
    });
    if (result.status !== 0 || !result.stdout) return [];
    return result.stdout
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function commonWindowsShims(command) {
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const npmPrefix = String(process.env.npm_config_prefix || "").trim();
  const roots = [
    path.join(appData, "npm"),
    npmPrefix,
  ].filter(Boolean);

  const files = [];
  for (const root of roots) {
    files.push(
      path.join(root, `${command}.exe`),
      path.join(root, `${command}.com`),
      path.join(root, `${command}.cmd`),
      path.join(root, `${command}.bat`),
    );
  }
  return files.filter(existsSync);
}

function resolveWindowsCommand(command) {
  if (process.platform !== "win32" || path.isAbsolute(command)) return command;
  const candidates = [...whereWindows(command), ...commonWindowsShims(command)];
  const executable = candidates.find(item => /\.(exe|com)$/i.test(item));
  if (executable) return executable;
  const shim = candidates.find(item => /\.(cmd|bat)$/i.test(item));
  return shim || command;
}

export function buildWindowsCmdLine(command, args = []) {
  const parts = [
    quoteWindowsCmdArg(command),
    ...args.map(quoteWindowsCmdArg),
  ];
  // cmd.exe /s /c requires an extra outer quote pair when the executable
  // itself is quoted. Example:
  //   ""C:\\path\\tool.cmd" "arg one" "arg two""
  return `"${parts.join(" ")}"`;
}

function prepareCommand(command, args) {
  const validated = validateCommand(command);
  const stringArgs = args.map(value => String(value));

  if (process.platform !== "win32") {
    return { command: validated, args: stringArgs, windowsVerbatimArguments: false };
  }

  const resolved = resolveWindowsCommand(validated);
  if (!/\.(cmd|bat)$/i.test(resolved)) {
    return { command: resolved, args: stringArgs, windowsVerbatimArguments: false };
  }

  const comspec = process.env.ComSpec || process.env.COMSPEC || "cmd.exe";
  return {
    command: comspec,
    args: ["/d", "/s", "/v:off", "/c", buildWindowsCmdLine(resolved, stringArgs)],
    windowsVerbatimArguments: true,
  };
}

export async function runIntentCommand(command, args = [], { timeoutMs = 30000, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    let prepared;
    try {
      prepared = prepareCommand(command, args);
    } catch (error) {
      reject(error);
      return;
    }

    const child = spawn(prepared.command, prepared.args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      windowsHide: true,
      shell: false,
      windowsVerbatimArguments: prepared.windowsVerbatimArguments === true,
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