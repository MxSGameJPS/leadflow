import { classifyIntentSignals } from "../ai/intentClassifierService.js";
import { importLeads, listLeads } from "../../repositories/leadRepository.js";
import { getIntentSignal, setIntentSignalStatus, upsertIntentSignals } from "../../repositories/intentRepository.js";
import { buildIntentQueries, cleanIntentQuery, serviceLabel } from "./intentQueries.js";
import { calculateIntentScore, gradeFromIntentScore, intentBand, shouldKeepIntentSignal } from "./intentScoring.js";
import { searchWithAgentReach } from "./providers/agentReachProvider.js";
import { enrichSignalsWithScrapling } from "./providers/scraplingProvider.js";

const ALLOWED_SOURCES = new Set(["web", "freelance", "reddit", "twitter", "facebook"]);
const ALLOWED_SERVICES = new Set(["all", "website", "system", "app", "ecommerce", "automation"]);

function cleanSources(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(item => ALLOWED_SOURCES.has(item)))];
}

export function normalizeIntentSearchInput(input = {}) {
  const service = ALLOWED_SERVICES.has(input.service) ? input.service : "all";
  const sources = cleanSources(input.sources);
  return {
    service,
    sources: sources.length ? sources : ["web", "freelance"],
    query: cleanIntentQuery(input.query),
    maxQueries: Math.max(1, Math.min(8, Number(input.maxQueries) || 4)),
    limitPerQuery: Math.max(2, Math.min(15, Number(input.limitPerQuery) || 6)),
    minimumScore: Math.max(0, Math.min(100, Number(input.minimumScore ?? process.env.LEADFLOW_INTENT_MIN_SCORE ?? 45))),
    providerId: String(input.providerId || "").trim(),
  };
}

export async function discoverIntentSignals(input = {}) {
  const options = normalizeIntentSearchInput(input);
  const queries = buildIntentQueries(options);
  const collection = await searchWithAgentReach({ queries, sources: options.sources, limitPerQuery: options.limitPerQuery });
  if (!collection.signals.length) {
    return {
      ...options,
      queries,
      found: 0,
      qualified: 0,
      saved: { added: 0, updated: 0, total: 0 },
      warnings: collection.warnings || [],
      classifier: { providerName: "", model: "", fallbackUsed: false },
      health: collection.health,
    };
  }

  const enriched = await enrichSignalsWithScrapling(collection.signals, { max: 8 });
  const classifiedItems = [];
  let classifierMeta = { providerName: "", model: "", fallbackUsed: false };
  const warnings = [...(collection.warnings || [])];

  for (let start = 0; start < enriched.signals.length; start += 10) {
    const batch = enriched.signals.slice(start, start + 10);
    const classified = await classifyIntentSignals(batch, { providerId: options.providerId });
    classifierMeta = {
      providerName: classified.providerName || classifierMeta.providerName,
      model: classified.model || classifierMeta.model,
      fallbackUsed: classifierMeta.fallbackUsed || classified.fallbackUsed,
    };
    if (classified.warning && !warnings.includes(classified.warning)) warnings.push(classified.warning);
    for (let index = 0; index < batch.length; index++) {
      const signal = batch[index];
      const classification = classified.items[index];
      const intentScore = calculateIntentScore(signal, classification);
      if (!shouldKeepIntentSignal(classification, intentScore, options.minimumScore)) continue;
      if (options.service !== "all" && classification.matchedService !== options.service) continue;
      classifiedItems.push({
        ...signal,
        ...classification,
        intentScore,
        band: intentBand(intentScore),
        status: "new",
      });
    }
  }

  const saved = await upsertIntentSignals(classifiedItems);
  return {
    ...options,
    queries,
    found: collection.signals.length,
    qualified: classifiedItems.length,
    enriched: enriched.enriched,
    saved,
    warnings,
    classifier: classifierMeta,
    health: collection.health,
  };
}

function leadName(signal) {
  const author = String(signal.author || "").trim();
  if (author && author.length >= 2 && author.length <= 120) return author;
  const title = String(signal.title || "").trim();
  if (title) return title.slice(0, 120);
  return `Oportunidade ${serviceLabel(signal.matchedService)}`;
}

export async function sendIntentSignalToCrm(id) {
  const signal = await getIntentSignal(id);
  if (!signal) throw new Error("Sinal de intenção não encontrado.");
  const externalId = `intent:${signal.fingerprint}`;
  const notes = [
    "Lead encontrado pelo Intent Engine.",
    signal.sourceUrl ? `Origem: ${signal.sourceUrl}` : "",
    signal.reason ? `Leitura da intenção: ${signal.reason}` : "",
    `Score de intenção: ${signal.intentScore}/100.`,
  ].filter(Boolean).join("\n");

  await importLeads([{
    externalId,
    source: `Intenção · ${signal.source}`,
    name: leadName(signal),
    segment: serviceLabel(signal.matchedService),
    score: Number(signal.intentScore || 0),
    grade: gradeFromIntentScore(signal.intentScore),
    problem: signal.content,
    reason: signal.reason || "Intenção de compra encontrada em fonte pública.",
    offer: `Avaliar oportunidade de ${serviceLabel(signal.matchedService).toLowerCase()}.`,
    nextAction: "Abrir a fonte original, identificar a empresa/pessoa responsável e preparar abordagem contextual.",
    stage: "novo",
    notes,
    weakSite: true,
  }]);

  const lead = (await listLeads()).find(item => item.externalId === externalId) || null;
  await setIntentSignalStatus(signal.id, "saved", lead?.id || null);
  return { signal: await getIntentSignal(signal.id), lead };
}
