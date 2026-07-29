import { prisma } from "../lib/prisma.js";
import { keyOf } from "../services/imports/parseLeads.js";
import { todayStr } from "../services/leads/format.js";
import {
  normalizeBoolean,
  normalizeFollowUpDate,
  normalizeInteger,
  validateGrade,
  validateLandingStatus,
  validateLeadData,
  validateStage,
} from "../services/leads/validation.js";

const ALLOWED = ["externalId", "source", "name", "segment", "city", "location", "address", "score", "grade", "phone", "whatsapp", "email", "instagram", "site", "weakSite", "googleRating", "googleReviews", "followers", "problem", "offer", "approach", "nextAction", "reason", "mapsLink", "bio", "stage", "notes", "proposalValue", "landingStatus", "followUpAt"];

function pickLeadData(o, isPatch = false) {
  const d = {};
  for (const k of ALLOWED) {
    if (!(k in o)) continue;
    let v = o[k];
    if (k === "weakSite") v = normalizeBoolean(v, true);
    else if (k === "score") v = normalizeInteger(v, { field: "Score", min: 0, max: 100 });
    else if (k === "proposalValue") v = normalizeInteger(v, { field: "Valor da proposta", min: 0 });
    else if (k === "followers") v = normalizeInteger(v, { field: "Seguidores", nullable: true, min: 0 });
    d[k] = v;
  }

  if (!isPatch) {
    if (d.externalId == null && o.id) d.externalId = String(o.id);
    if (!d.name) d.name = o.name || "(sem nome)";
    if (d.grade == null) d.grade = o.grade || "D";
    if (d.stage == null) d.stage = "novo";
    if (d.landingStatus == null) d.landingStatus = "none";
    if (d.notes == null) d.notes = "";
    if (d.proposalValue == null) d.proposalValue = 0;
    if (d.score == null) d.score = 0;
    if (d.weakSite == null) d.weakSite = true;
  }

  return validateLeadData(d, { isPatch });
}

export async function listLeads() {
  return prisma.lead.findMany({ orderBy: [{ score: "desc" }, { createdAt: "desc" }] });
}

export async function getLead(id) {
  return prisma.lead.findUnique({ where: { id } });
}

export async function createLead(data) {
  return prisma.lead.create({ data: pickLeadData(data, false) });
}

export async function updateLead(id, patch) {
  return prisma.lead.update({ where: { id }, data: pickLeadData(patch, true) });
}

export async function deleteLead(id) {
  return prisma.lead.delete({ where: { id } });
}

export async function clearAll() {
  return prisma.lead.deleteMany({});
}

export async function moveStage(id, stage) {
  return prisma.lead.update({ where: { id }, data: { stage: validateStage(stage) } });
}

export async function setLanding(id, landingStatus) {
  return prisma.lead.update({ where: { id }, data: { landingStatus: validateLandingStatus(landingStatus) } });
}

export async function setGrade(id, grade) {
  return prisma.lead.update({ where: { id }, data: { grade: validateGrade(grade) } });
}

export async function setFollowUp(id, followUpAt) {
  return prisma.lead.update({ where: { id }, data: { followUpAt: normalizeFollowUpDate(followUpAt) } });
}

export async function setProposalValue(id, proposalValue) {
  return prisma.lead.update({
    where: { id },
    data: { proposalValue: normalizeInteger(proposalValue, { field: "Valor da proposta", min: 0 }) },
  });
}

export async function setNotes(id, notes) {
  return prisma.lead.update({ where: { id }, data: { notes: String(notes || "") } });
}

// Importa em uma única transação, deduplicando primeiro por externalId e depois por nome + contato.
// Os campos comerciais produzidos durante o trabalho no CRM são preservados nas atualizações.
export async function importLeads(incoming) {
  if (!Array.isArray(incoming)) throw new Error("A importação deve receber uma lista de leads.");

  return prisma.$transaction(async tx => {
    const existing = await tx.lead.findMany();
    const byKey = new Map(existing.map(l => [keyOf(l), l]));
    const byExternalId = new Map(existing.filter(l => l.externalId).map(l => [l.externalId, l]));
    let added = 0, updated = 0;

    for (const raw of incoming) {
      const data = pickLeadData(raw, false);
      const k = keyOf(data);
      const ex = (data.externalId && byExternalId.get(data.externalId)) || byKey.get(k);

      if (ex) {
        delete data.externalId;
        const saved = await tx.lead.update({
          where: { id: ex.id },
          data: {
            ...data,
            stage: ex.stage,
            notes: ex.notes,
            proposalValue: ex.proposalValue,
            landingStatus: ex.landingStatus,
            followUpAt: ex.followUpAt,
          },
        });
        byKey.set(keyOf(saved), saved);
        if (saved.externalId) byExternalId.set(saved.externalId, saved);
        updated++;
      } else {
        const created = await tx.lead.create({ data });
        byKey.set(keyOf(created), created);
        if (created.externalId) byExternalId.set(created.externalId, created);
        added++;
      }
    }

    const total = await tx.lead.count();
    return { added, updated, total };
  });
}

export async function stats() {
  const leads = await prisma.lead.findMany();
  const today = todayStr();
  const s = { total: leads.length, byGrade: {}, bySource: {}, withWhatsapp: 0, landingTodo: 0, followupDue: 0, active: 0, won: 0, pipeline: 0, closed: 0 };
  const ACTIVE = ["contatado", "sem_resposta", "com_resposta", "proposta", "proposta_rejeitada", "negociacao"];
  const PIPE = ["proposta", "proposta_rejeitada", "negociacao"];

  for (const l of leads) {
    s.byGrade[l.grade] = (s.byGrade[l.grade] || 0) + 1;
    if (l.source) s.bySource[l.source] = (s.bySource[l.source] || 0) + 1;
    if (l.whatsapp) s.withWhatsapp++;
    if (l.landingStatus === "todo") s.landingTodo++;
    if (l.followUpAt && l.followUpAt <= today && l.stage !== "ganho" && l.stage !== "perdido") s.followupDue++;
    if (ACTIVE.includes(l.stage)) s.active++;
    if (l.stage === "ganho") { s.won++; s.closed += (l.proposalValue || 0); }
    if (PIPE.includes(l.stage)) s.pipeline += (l.proposalValue || 0);
  }

  return s;
}
