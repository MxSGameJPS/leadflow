import { prisma } from "../lib/prisma.js";
import { keyOf } from "../services/imports/parseLeads.js";
import { todayStr } from "../services/leads/format.js";

const ALLOWED = ["externalId", "source", "name", "segment", "city", "location", "address", "score", "grade", "phone", "whatsapp", "email", "instagram", "site", "weakSite", "googleRating", "googleReviews", "followers", "problem", "offer", "approach", "nextAction", "reason", "mapsLink", "bio", "stage", "notes", "proposalValue", "landingStatus", "followUpAt"];

function pickLeadData(o, isPatch = false) {
  const d = {};
  for (const k of ALLOWED) {
    if (!(k in o)) continue;
    let v = o[k];
    if (k === "weakSite") v = v !== false;
    else if (k === "score" || k === "proposalValue") { v = v == null ? 0 : parseInt(v, 10); if (Number.isNaN(v)) v = 0; }
    else if (k === "followers") { v = v == null ? null : parseInt(v, 10); if (Number.isNaN(v)) v = null; }
    d[k] = v;
  }
  if (!isPatch) {
    if (d.externalId == null && o.id) d.externalId = o.id;
    if (!d.name) d.name = o.name || "(sem nome)";
    if (d.grade == null) d.grade = o.grade || "D";
    if (d.stage == null) d.stage = "novo";
    if (d.landingStatus == null) d.landingStatus = "none";
    if (d.notes == null) d.notes = "";
    if (d.proposalValue == null) d.proposalValue = 0;
  }
  return d;
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
  return prisma.lead.update({ where: { id }, data: { stage } });
}
export async function setLanding(id, landingStatus) {
  return prisma.lead.update({ where: { id }, data: { landingStatus } });
}
export async function setGrade(id, grade) {
  return prisma.lead.update({ where: { id }, data: { grade } });
}
export async function setFollowUp(id, followUpAt) {
  return prisma.lead.update({ where: { id }, data: { followUpAt: followUpAt || null } });
}
export async function setProposalValue(id, proposalValue) {
  const v = parseInt(proposalValue, 10);
  return prisma.lead.update({ where: { id }, data: { proposalValue: Number.isNaN(v) ? 0 : v } });
}
export async function setNotes(id, notes) {
  return prisma.lead.update({ where: { id }, data: { notes: notes || "" } });
}

// Import com dedupe por keyOf (nome + contato), preservando campos de trabalho.
export async function importLeads(incoming) {
  const existing = await prisma.lead.findMany();
  const map = new Map(existing.map(l => [keyOf(l), l]));
  let added = 0, updated = 0;
  for (const raw of incoming) {
    const k = keyOf(raw);
    const ex = map.get(k);
    const data = pickLeadData(raw, false);
    if (ex) {
      delete data.externalId;
      await prisma.lead.update({
        where: { id: ex.id },
        data: { ...data, stage: ex.stage, notes: ex.notes, proposalValue: ex.proposalValue, landingStatus: ex.landingStatus, followUpAt: ex.followUpAt },
      });
      updated++;
    } else {
      const created = await prisma.lead.create({ data });
      map.set(k, created);
      added++;
    }
  }
  const total = await prisma.lead.count();
  return { added, updated, total };
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
