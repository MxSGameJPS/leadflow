import path from "node:path";
import os from "node:os";
import { access } from "node:fs/promises";
import { runIntentCommand } from "../commandRunner.js";

let cached = null;
let expiresAt = 0;

async function candidates() {
  const explicit = String(process.env.LEADFLOW_PYTHON || "").trim();
  const items = [];
  if (explicit) items.push({ command: explicit, prefix: [] });
  const home = os.homedir();
  const localPaths = process.platform === "win32"
    ? [
        path.join(home, ".leadflow-intent-venv", "Scripts", "python.exe"),
        path.join(home, ".agent-reach-venv", "Scripts", "python.exe"),
      ]
    : [
        path.join(home, ".leadflow-intent-venv", "bin", "python"),
        path.join(home, ".agent-reach-venv", "bin", "python"),
      ];
  for (const candidate of localPaths) {
    try { await access(candidate); items.push({ command: candidate, prefix: [] }); } catch {}
  }
  if (process.platform === "win32") items.push({ command: "py", prefix: ["-3"] });
  items.push({ command: "python", prefix: [] }, { command: "python3", prefix: [] });
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.command}|${item.prefix.join(" ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getScraplingHealth({ force = false } = {}) {
  if (!force && cached && Date.now() < expiresAt) return cached;
  let lastError = "Python não encontrado.";
  for (const candidate of await candidates()) {
    try {
      const result = await runIntentCommand(candidate.command, [
        ...candidate.prefix,
        "-c",
        "import scrapling; print(getattr(scrapling, '__version__', 'ok'))",
      ], { timeoutMs: 12000 });
      cached = { installed: true, python: candidate, version: result.stdout || "ok", error: "" };
      expiresAt = Date.now() + 60_000;
      return cached;
    } catch (error) {
      lastError = error.message || String(error);
    }
  }
  cached = { installed: false, python: null, version: "", error: lastError };
  expiresAt = Date.now() + 30_000;
  return cached;
}

export async function enrichSignalWithScrapling(signal, health = null) {
  if (!signal?.sourceUrl) return signal;
  const status = health || await getScraplingHealth();
  if (!status.installed || !status.python) return signal;
  const script = path.join(process.cwd(), "scripts", "intent-scrape.py");
  const dynamic = String(process.env.LEADFLOW_INTENT_SCRAPLING_DYNAMIC || "").toLowerCase() === "true";
  try {
    const result = await runIntentCommand(status.python.command, [
      ...status.python.prefix,
      script,
      signal.sourceUrl,
      ...(dynamic ? ["--dynamic"] : []),
    ], { timeoutMs: dynamic ? 60_000 : 30_000 });
    const data = JSON.parse(result.stdout);
    const enrichedContent = String(data.content || "").trim();
    return {
      ...signal,
      title: signal.title || data.title || null,
      content: enrichedContent.length > String(signal.content || "").length ? enrichedContent.slice(0, 12000) : signal.content,
    };
  } catch {
    return signal;
  }
}

export async function enrichSignalsWithScrapling(signals = [], { max = 8 } = {}) {
  const health = await getScraplingHealth();
  if (!health.installed) return { signals, health, enriched: 0 };
  const result = [...signals];
  let enriched = 0;
  let attempted = 0;
  for (let index = 0; index < result.length && attempted < max; index++) {
    const item = result[index];
    if (!item.sourceUrl || String(item.content || "").length >= 700) continue;
    attempted++;
    const next = await enrichSignalWithScrapling(item, health);
    if (String(next.content || "").length > String(item.content || "").length) enriched++;
    result[index] = next;
  }
  return { signals: result, health, enriched };
}
