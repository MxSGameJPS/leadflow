function normalizedText(signal = {}) {
  return `${signal.title || ""} ${signal.content || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function includesAny(text, terms) {
  return terms.some(term => text.includes(term));
}

export function detectMatchedService(signal = {}) {
  const text = normalizedText(signal);
  if (includesAny(text, ["aplicativo", " app ", "android", "ios", "play store", "app store"])) return "app";
  if (includesAny(text, ["ecommerce", "e-commerce", "loja virtual", "loja online", "vender online"])) return "ecommerce";
  if (includesAny(text, ["sistema", "software", "crm", "erp", "pdv", "estoque", "comanda", "plataforma web"])) return "system";
  if (includesAny(text, ["automatizar", "automacao", "integracao", "integrar", "workflow"])) return "automation";
  if (includesAny(text, ["site", "landing page", "pagina web", "website", "wordpress"])) return "website";
  return "unknown";
}

export function fallbackIntentClassification(signal = {}) {
  const text = normalizedText(signal);
  const explicitTerms = [
    "preciso de", "precisamos de", "procuro", "procuramos", "contratar", "contratando",
    "orcamento", "quanto custa", "alguem indica", "alguem faz", "quem faz", "desenvolvedor",
    "empresa para", "freelancer para", "freela para", "quero criar", "queremos criar",
  ];
  const painTerms = [
    "nao funciona", "planilha", "perdendo pedidos", "pedidos no whatsapp", "controle manual",
    "meu site", "site lento", "site caiu", "organizar pedidos", "automatizar", "integrar",
  ];
  const researchTerms = [
    "como criar", "como fazer", "tutorial", "curso de", "aprender", "exemplo de codigo",
    "vaga de desenvolvedor", "sou desenvolvedor", "portfolio", "meu portfolio",
  ];
  const urgentTerms = ["urgente", "urgencia", "hoje", "essa semana", "esta semana", "o quanto antes", "imediato"];
  const explicitIntent = includesAny(text, explicitTerms);
  const pain = includesAny(text, painTerms);
  const researchOnly = includesAny(text, researchTerms) && !explicitIntent && !pain;
  const matchedService = detectMatchedService(signal);
  const hasFit = matchedService !== "unknown";
  const isOpportunity = !researchOnly && (explicitIntent || pain) && hasFit;

  let buyerStage = "research";
  if (explicitIntent) buyerStage = "ready";
  else if (pain) buyerStage = "problem_aware";

  let intentLevel = "low";
  if (explicitIntent) intentLevel = "high";
  else if (pain) intentLevel = "medium";

  return {
    isOpportunity,
    matchedService,
    intentType: explicitIntent ? "explicit_request" : pain ? "pain_signal" : researchOnly ? "research" : "other",
    buyerStage,
    intentLevel,
    urgencyScore: includesAny(text, urgentTerms) ? 90 : explicitIntent ? 55 : pain ? 35 : 10,
    fitScore: hasFit ? 90 : 35,
    confidence: explicitIntent ? 0.82 : pain ? 0.62 : 0.42,
    explicitIntent,
    reason: explicitIntent
      ? "O texto contém um pedido comercial explícito compatível com os serviços do LeadFlow."
      : pain
        ? "O texto descreve uma dor que pode ser resolvida com desenvolvimento sob medida."
        : "O sinal não demonstrou intenção comercial suficiente.",
  };
}

function recencyPoints(publishedAt, now = new Date()) {
  if (!publishedAt) return 6;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return 6;
  const days = Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 1) return 20;
  if (days <= 3) return 17;
  if (days <= 7) return 13;
  if (days <= 14) return 9;
  if (days <= 30) return 5;
  return 1;
}

const LEVEL_POINTS = { high: 30, medium: 20, low: 8, unknown: 4 };
const STAGE_POINTS = { ready: 20, evaluating: 14, problem_aware: 8, research: 3, unknown: 3 };

export function calculateIntentScore(signal = {}, classification = {}, now = new Date()) {
  const intent = LEVEL_POINTS[classification.intentLevel] ?? 4;
  const buyer = STAGE_POINTS[classification.buyerStage] ?? 3;
  const recency = recencyPoints(signal.publishedAt, now);
  const fit = Math.round(Math.max(0, Math.min(100, Number(classification.fitScore || 0))) * 0.15);
  const urgency = Math.round(Math.max(0, Math.min(100, Number(classification.urgencyScore || 0))) * 0.10);
  const confidence = Math.round(Math.max(0, Math.min(1, Number(classification.confidence || 0))) * 5);
  return Math.max(0, Math.min(100, intent + buyer + recency + fit + urgency + confidence));
}

export function intentBand(score) {
  const value = Number(score || 0);
  if (value >= 85) return "hot";
  if (value >= 70) return "high";
  if (value >= 50) return "medium";
  return "low";
}

export function gradeFromIntentScore(score) {
  const value = Number(score || 0);
  if (value >= 85) return "A";
  if (value >= 70) return "B";
  if (value >= 50) return "C";
  return "D";
}

export function shouldKeepIntentSignal(classification = {}, score = 0, minimum = 45) {
  return classification.isOpportunity === true && Number(score || 0) >= Number(minimum || 45);
}
