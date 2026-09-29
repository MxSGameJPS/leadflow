"use server";
import { revalidatePath } from "next/cache";
import * as repo from "../../repositories/leadRepository.js";
import { parseLeads } from "../../services/imports/parseLeads.js";
import { appendLeadActivity, getLeadWorkspace, saveLeadWorkspace } from "../../services/workspaces/leadWorkspaceStore.js";

const MAX_IMPORT_SIZE = 5_000_000;
const CLEAR_CONFIRMATION = "APAGAR";

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/crm");
  revalidatePath("/consultoria");
  revalidatePath("/agendamentos");
  revalidatePath("/cobrancas");
}

export async function createLeadAction(data) { const r = await repo.createLead(data); refresh(); return r; }
export async function updateLeadAction(id, patch) { const r = await repo.updateLead(id, patch); refresh(); return r; }
export async function deleteLeadAction(id) { await repo.deleteLead(id); refresh(); }
export async function deleteLeadsAction(ids) { const r = await repo.deleteLeads(ids); refresh(); return r; }
export async function moveStageAction(id, stage) {
  const before = await repo.getLead(String(id || ""));
  const saved = await repo.moveStage(id, stage);
  if (before?.stage !== saved?.stage) {
    const workspace = await getLeadWorkspace(id);
    const now = new Date();
    const previousEnteredAt = workspace.stageEnteredAt ? new Date(workspace.stageEnteredAt) : new Date(before?.updatedAt || before?.createdAt || now);
    const validPrevious = !Number.isNaN(previousEnteredAt.getTime()) ? previousEnteredAt : now;
    const days = Math.max(0, Math.floor((now.getTime() - validPrevious.getTime()) / 86_400_000));
    await saveLeadWorkspace(id, {
      stageEnteredAt: now.toISOString(),
      stageHistory: [{
        stage: before?.stage || "novo",
        enteredAt: validPrevious.toISOString(),
        leftAt: now.toISOString(),
        days,
      }, ...(workspace.stageHistory || [])].slice(0, 80),
    });
    await appendLeadActivity(id, {
      type: "stage",
      title: "Etapa alterada",
      detail: (before?.stage || "novo") + " → " + (saved?.stage || stage) + " · " + days + " dia(s) na etapa anterior",
    });
  }
  refresh();
  return saved;
}
export async function setLandingAction(id, status) {
  const before = await repo.getLead(String(id || ""));
  const saved = await repo.setLanding(id, status);
  if (before?.landingStatus !== saved?.landingStatus) await appendLeadActivity(id, {
    type: "site",
    title: "Status da prévia alterado",
    detail: (before?.landingStatus || "none") + " → " + (saved?.landingStatus || status),
  });
  refresh();
  return saved;
}
export async function setGradeAction(id, grade) { const saved = await repo.setGrade(id, grade); refresh(); return saved; }
export async function setFollowUpAction(id, date) {
  const saved = await repo.setFollowUp(id, date);
  await appendLeadActivity(id, {
    type: "follow_up",
    title: saved?.followUpAt ? "Follow-up agendado" : "Follow-up removido",
    detail: saved?.followUpAt || "",
  });
  refresh();
  return saved;
}
export async function setProposalValueAction(id, value) {
  const before = await repo.getLead(String(id || ""));
  const saved = await repo.setProposalValue(id, value);
  if (Number(before?.proposalValue || 0) !== Number(saved?.proposalValue || 0)) await appendLeadActivity(id, {
    type: "proposal",
    title: "Valor da proposta atualizado",
    detail: "R$ " + Number(saved?.proposalValue || 0).toLocaleString("pt-BR"),
  });
  refresh();
  return saved;
}
export async function setNotesAction(id, notes) { await repo.setNotes(id, notes); refresh(); }

export async function recordLeadActivityAction(id, activity = {}) {
  const lead = await repo.getLead(String(id || ""));
  if (!lead) throw new Error("Lead não encontrado.");
  const saved = await appendLeadActivity(lead.id, activity || {});
  refresh();
  return saved.activities?.[0] || null;
}

export async function recordContactAction(id, kind = "manual") {
  const lead = await repo.getLead(String(id || ""));
  if (!lead) throw new Error("Lead não encontrado.");

  const workspace = await getLeadWorkspace(lead.id);
  const now = new Date().toISOString();
  const saved = await saveLeadWorkspace(lead.id, {
    lastContactAt: now,
    lastContactKind: kind,
    contactCount: Number(workspace.contactCount || 0) + 1,
  });
  await appendLeadActivity(lead.id, {
    type: "contact",
    title: "Contato registrado",
    detail: String(kind || "manual"),
    createdAt: now,
  });
  refresh();
  return {
    id: lead.id,
    lastContactAt: saved.lastContactAt,
    lastContactKind: saved.lastContactKind,
    contactCount: saved.contactCount,
  };
}

export async function clearAllAction(confirmation) {
  if (confirmation !== CLEAR_CONFIRMATION) {
    throw new Error("Confirmação inválida. Nenhum lead foi apagado.");
  }
  await repo.clearAll();
  refresh();
}

export async function importTextAction(text, fname) {
  if (typeof text !== "string" || !text.trim()) throw new Error("O arquivo está vazio.");
  if (text.length > MAX_IMPORT_SIZE) throw new Error("O arquivo excede o limite local de 5 MB.");

  const arr = parseLeads(text, fname);
  if (!arr.length) throw new Error("Nenhum lead reconhecido no arquivo.");

  const coverage = arr.reduce((acc, lead) => {
    if (lead.whatsapp) acc.withWhatsapp++;
    if (lead.phone) acc.withPhone++;
    if (lead.email) acc.withEmail++;
    if (lead.instagram) acc.withInstagram++;
    if (!lead.whatsapp && !lead.phone && !lead.email && !lead.instagram) acc.withoutContact++;
    return acc;
  }, { withWhatsapp: 0, withPhone: 0, withEmail: 0, withInstagram: 0, withoutContact: 0 });

  const res = await repo.importLeads(arr);
  refresh();
  return { ...res, recognized: arr.length, coverage };
}
