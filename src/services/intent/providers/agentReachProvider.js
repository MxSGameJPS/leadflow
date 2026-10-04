import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runIntentCommand } from "../commandRunner.js";
import { buildFreelanceQueries, cleanIntentQuery } from "../intentQueries.js";
import { dedupeSignals, extractSignalsFromCommandOutput } from "../intentNormalizer.js";

let cachedHealth = null;
let healthExpiresAt = 0;
let cachedCommand = null;

async function firstExisting(paths) {
  for (const item of paths) {
    try { await access(item); return item; } catch {}
  }
  return null;
}

async function agentReachCommand() {
  if (cachedCommand) return cachedCommand;
  const explicit = String(process.env.LEADFLOW_AGENT_REACH_COMMAND || "").trim();
  if (explicit) return (cachedCommand = explicit);
  const home = os.homedir();
  const local = process.platform === "win32"
    ? await firstExisting([
        path.join(home, ".leadflow-intent-venv", "Scripts", "agent-reach.exe"),
        path.join(home, ".agent-reach-venv", "Scripts", "agent-reach.exe"),
        path.join(home, ".agent-reach-venv", "Scripts", "agent-reach-script.py"),
        path.join(home, ".local", "bin", "agent-reach.exe"),
      ])
    : await firstExisting([
        path.join(home, ".leadflow-intent-venv", "bin", "agent-reach"),
        path.join(home, ".agent-reach-venv", "bin", "agent-reach"),
        path.join(home, ".local", "bin", "agent-reach"),
      ]);
  return (cachedCommand = local || "agent-reach");
}

function parseDoctor(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    if (parsed?.channels && typeof parsed.channels === "object") return parsed.channels;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getAgentReachHealth({ force = false } = {}) {
  if (!force && cachedHealth && Date.now() < healthExpiresAt) return cachedHealth;
  const command = await agentReachCommand();
  try {
    const result = await runIntentCommand(command, ["doctor", "--json"], { timeoutMs: 25000 });
    const channels = parseDoctor(result.stdout);
    cachedHealth = { installed: true, command, channels, error: "" };
  } catch (error) {
    cachedHealth = { installed: false, command, channels: {}, error: error.message || String(error) };
  }
  healthExpiresAt = Date.now() + 30_000;
  return cachedHealth;
}

function channel(health, key) {
  return health?.channels?.[key] || {};
}

function warningFor(source, message) {
  return `${source}: ${String(message || "falha desconhecida").slice(0, 800)}`;
}

async function searchExa(query, limit) {
  const result = await runIntentCommand("mcporter", [
    "call",
    "exa.web_search_exa",
    `query=${query}`,
    `numResults=${limit}`,
  ], { timeoutMs: 45_000 });
  return result.stdout;
}

async function searchSocial(source, query, limit, health) {
  const active = String(channel(health, source === "twitter" ? "twitter" : source).active_backend || "").toLowerCase();
  if (source === "reddit") {
    if (active.includes("opencli")) return (await runIntentCommand("opencli", ["reddit", "search", query, "-f", "yaml"], { timeoutMs: 45_000 })).stdout;
    if (active.includes("rdt")) return (await runIntentCommand("rdt", ["search", query, "--limit", String(limit)], { timeoutMs: 45_000 })).stdout;
    throw new Error("Reddit ainda não possui um backend autenticado. Configure o canal no Agent-Reach.");
  }
  if (source === "facebook") {
    if (!active.includes("opencli")) throw new Error("Facebook exige OpenCLI com uma sessão de Chrome controlada pelo usuário.");
    return (await runIntentCommand("opencli", ["facebook", "search", query, "-f", "yaml"], { timeoutMs: 45_000 })).stdout;
  }
  if (source === "twitter") {
    if (active.includes("opencli")) return (await runIntentCommand("opencli", ["twitter", "search", query, "-f", "yaml"], { timeoutMs: 45_000 })).stdout;
    if (!active) throw new Error("X / Twitter ainda não possui backend ativo no Agent-Reach.");
    if (!process.env.TWITTER_AUTH_TOKEN || !process.env.TWITTER_CT0) {
      throw new Error("O backend twitter-cli exige TWITTER_AUTH_TOKEN e TWITTER_CT0 no processo atual; configure-os sem gravar cookies no projeto ou use OpenCLI.");
    }
    return (await runIntentCommand("twitter", ["search", query, "-n", String(limit)], { timeoutMs: 45_000 })).stdout;
  }
  throw new Error(`Fonte social não suportada: ${source}`);
}

async function runOne({ source, query, limit, health }) {
  if (source === "web") {
    const output = await searchExa(query, limit);
    return extractSignalsFromCommandOutput(output, { source: "web", query });
  }
  if (["reddit", "twitter", "facebook"].includes(source)) {
    const output = await searchSocial(source, query, limit, health);
    return extractSignalsFromCommandOutput(output, { source, query });
  }
  throw new Error(`Fonte não suportada pelo Agent-Reach: ${source}`);
}

export async function searchWithAgentReach({ queries = [], sources = [], limitPerQuery = 8 } = {}) {
  const health = await getAgentReachHealth();
  if (!health.installed) {
    return {
      signals: [],
      warnings: ["Agent-Reach não está instalado ou não foi localizado. Use a área de diagnóstico da tela Intenção para configurar o coletor."],
      health,
    };
  }

  const signals = [];
  const warnings = [];
  const safeQueries = queries.map(item => cleanIntentQuery(item)).filter(Boolean).slice(0, 12);
  const safeSources = [...new Set(sources)].filter(item => ["web", "freelance", "reddit", "twitter", "facebook"].includes(item));
  const limit = Math.max(1, Math.min(20, Number(limitPerQuery) || 8));

  for (const source of safeSources) {
    for (const query of safeQueries) {
      if (source === "freelance") {
        for (const item of buildFreelanceQueries(query)) {
          try {
            const output = await searchExa(item.query, Math.max(3, Math.ceil(limit / 2)));
            signals.push(...extractSignalsFromCommandOutput(output, { source: "freelance", query }));
          } catch (error) {
            warnings.push(warningFor(item.source, error.message));
          }
        }
        continue;
      }

      try {
        signals.push(...await runOne({ source, query, limit, health }));
      } catch (error) {
        warnings.push(warningFor(source, error.message));
      }
    }
  }

  return { signals: dedupeSignals(signals), warnings, health };
}
