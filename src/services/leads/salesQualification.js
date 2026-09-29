const STATUS_POINTS = Object.freeze({
  unknown: 0,
  low: 7,
  medium: 15,
  high: 25,
});

const STATUS_LABELS = Object.freeze({
  unknown: "Não confirmado",
  low: "Baixo",
  medium: "Moderado",
  high: "Forte",
});

const ACTIVE_STAGES = new Set(["contatado", "sem_resposta", "com_resposta", "proposta", "proposta_rejeitada", "negociacao"]);

function numberValue(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusValue(value) {
  return Object.prototype.hasOwnProperty.call(STATUS_POINTS, value) ? value : "unknown";
}

function text(value) {
  return String(value ?? "").trim();
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function grade(score) {
  if (score >= 75) return "A";
  if (score >= 50) return "B";
  if (score >= 25) return "C";
  return "D";
}

function statusScore(value) {
  return STATUS_POINTS[statusValue(value)];
}

function inferNeedScore(lead = {}) {
  let score = 0;
  if (!lead.site) score += 16;
  else if (lead.weakSite !== false) score += 13;
  if (text(lead.problem)) score += 5;
  const reviews = numberValue(lead.googleReviews);
  if (reviews >= 100) score += 2;
  return Math.min(25, score);
}

function inferAuthorityScore(q = {}) {
  let score = statusScore(q.authorityStatus);
  if (q.decisionMaker === true) score = Math.max(score, 23);
  else if (text(q.authorityContact) && text(q.authorityRole)) score = Math.max(score, 10);
  else if (text(q.authorityContact)) score = Math.max(score, 6);
  return Math.min(25, score);
}

function inferTimelineScore(lead = {}, q = {}) {
  let score = statusScore(q.timelineStatus);
  if (text(q.targetDate) || text(lead.followUpAt)) score = Math.max(score, 7);
  if (["proposta", "proposta_rejeitada", "negociacao"].includes(lead.stage)) score = Math.max(score, 16);
  else if (lead.stage === "com_resposta") score = Math.max(score, 10);
  else if (ACTIVE_STAGES.has(lead.stage)) score = Math.max(score, 5);
  return Math.min(25, score);
}

function completenessScore(values) {
  if (!values.length) return 0;
  return clamp(values.reduce((sum, value) => sum + (value ? 1 : 0), 0) / values.length * 100);
}

function meddic(lead = {}, q = {}) {
  const metrics = text(q.metrics) ? 100 : (numberValue(lead.proposalValue) > 0 ? 35 : 0);
  const economicBuyer = q.decisionMaker === true ? 100 : (text(q.authorityContact) ? 50 : 0);
  const decisionCriteria = text(q.decisionCriteria) ? 100 : 0;
  const decisionProcess = text(q.decisionProcess) ? 100 : 0;
  const identifyPain = text(q.needEvidence) || text(lead.problem) ? 100 : ((!lead.site || lead.weakSite !== false) ? 60 : 0);
  const championStatus = statusValue(q.championStatus);
  const champion = championStatus === "high" ? 100
    : championStatus === "medium" ? 70
      : championStatus === "low" ? 35
        : (text(q.championContact) ? 35 : 0);
  return {
    metrics,
    economicBuyer,
    decisionCriteria,
    decisionProcess,
    identifyPain,
    champion,
    overall: clamp((metrics + economicBuyer + decisionCriteria + decisionProcess + identifyPain + champion) / 6),
  };
}

function confidence(lead = {}, q = {}) {
  const manual = [
    statusValue(q.budgetStatus) !== "unknown",
    Boolean(text(q.budgetEvidence)),
    statusValue(q.authorityStatus) !== "unknown" || Boolean(text(q.authorityContact)),
    Boolean(text(q.authorityEvidence)),
    statusValue(q.needStatus) !== "unknown" || Boolean(text(q.needEvidence)),
    statusValue(q.timelineStatus) !== "unknown" || Boolean(text(q.targetDate)),
    Boolean(text(q.timelineEvidence)),
    statusValue(q.championStatus) !== "unknown" || Boolean(text(q.championContact)),
    Boolean(text(q.decisionCriteria)),
    Boolean(text(q.decisionProcess)),
    Boolean(text(q.metrics)),
  ];
  const facts = [
    Boolean(text(lead.phone || lead.whatsapp)),
    Boolean(text(lead.site || lead.instagram)),
    Boolean(text(lead.googleRating)),
    Boolean(text(lead.problem)),
    Boolean(text(lead.followUpAt)),
  ];
  const value = completenessScore([...manual, ...facts]);
  return {
    score: value,
    level: value >= 70 ? "Alta" : value >= 40 ? "Média" : "Baixa",
  };
}

function weakestDimension(breakdown) {
  return Object.entries(breakdown).sort((a, b) => a[1].score - b[1].score)[0]?.[0] || "budget";
}

function nextStepFor(score, breakdown, meddicResult) {
  const weakest = weakestDimension(breakdown);
  const labels = {
    budget: "confirmar orçamento e faixa de investimento",
    authority: "identificar quem decide e quem influencia a compra",
    need: "aprofundar a dor e o impacto do problema atual",
    timeline: "confirmar prazo, prioridade e evento que dispara a decisão",
  };
  if (score >= 75 && meddicResult.overall >= 65) return "Avançar para proposta/fechamento validando critérios finais e próximo compromisso concreto.";
  if (meddicResult.economicBuyer < 50) return "Identificar o decisor econômico antes de aprofundar a proposta.";
  if (meddicResult.decisionCriteria === 0) return "Perguntar quais critérios o cliente usará para decidir entre fazer, adiar ou contratar.";
  if (meddicResult.decisionProcess === 0) return "Mapear como a decisão será tomada, quem participa e qual é o próximo passo formal.";
  return "Priorizar a próxima conversa para " + labels[weakest] + ".";
}

export function calculateSalesQualification(lead = {}, qualification = {}) {
  const budget = statusScore(qualification.budgetStatus);
  const authority = inferAuthorityScore(qualification);
  const manualNeed = statusScore(qualification.needStatus);
  const need = statusValue(qualification.needStatus) === "unknown" ? inferNeedScore(lead) : manualNeed;
  const timeline = inferTimelineScore(lead, qualification);
  const total = clamp(budget + authority + need + timeline, 0, 100);
  const meddicResult = meddic(lead, qualification);
  const confidenceResult = confidence(lead, qualification);
  const breakdown = {
    budget: { score: budget, max: 25, label: "Orçamento" },
    authority: { score: authority, max: 25, label: "Autoridade" },
    need: { score: need, max: 25, label: "Necessidade" },
    timeline: { score: timeline, max: 25, label: "Prazo" },
  };
  const gaps = [];
  if (budget < 12) gaps.push("Orçamento ainda não validado");
  if (authority < 12) gaps.push("Decisor econômico não confirmado");
  if (need < 12) gaps.push("Dor comercial pouco comprovada");
  if (timeline < 12) gaps.push("Prazo/urgência pouco definidos");
  if (meddicResult.decisionCriteria === 0) gaps.push("Critérios de decisão não registrados");
  if (meddicResult.decisionProcess === 0) gaps.push("Processo de decisão não mapeado");
  if (meddicResult.champion < 50) gaps.push("Champion interno ainda não identificado");

  return {
    score: total,
    grade: grade(total),
    breakdown,
    meddic: meddicResult,
    confidence: confidenceResult,
    gaps,
    nextStep: nextStepFor(total, breakdown, meddicResult),
    statusLabels: STATUS_LABELS,
  };
}
