"use server";

import { revalidatePath } from "next/cache";
import * as repo from "../../repositories/leadRepository.js";
import { generateConsultingAudit } from "../../services/ai/consultingAuditService.js";
import { validateConsultingStage } from "../../services/consulting/stages.js";
import { getProfessionalProfile } from "../../services/profile/profileStore.js";
import { getLeadWorkspace, saveLeadWorkspace } from "../../services/workspaces/leadWorkspaceStore.js";

function refresh(leadId) {
  revalidatePath("/consultoria");
  revalidatePath(`/consultoria/${leadId}`);
  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
  revalidatePath("/dashboard");
  revalidatePath("/cobrancas");
}

export async function saveConsultingWorkspaceAction(leadId, patch = {}) {
  const id = String(leadId || "");
  const lead = await repo.getLead(id);
  if (!lead) throw new Error("Lead não encontrado.");

  const saved = await saveLeadWorkspace(id, { consulting: patch || {} });
  refresh(id);
  return saved.consulting;
}

export async function moveConsultingStageAction(leadId, stage) {
  const value = validateConsultingStage(stage);
  return saveConsultingWorkspaceAction(leadId, { stage: value });
}

export async function generateConsultingAuditAction(payload = {}) {
  const leadId = String(payload.leadId || "");
  const lead = await repo.getLead(leadId);
  if (!lead) throw new Error("Lead não encontrado.");

  const [profile, workspace] = await Promise.all([
    getProfessionalProfile(),
    getLeadWorkspace(lead.id),
  ]);

  return generateConsultingAudit({
    lead,
    profile,
    websiteUrl: payload.websiteUrl || workspace.consulting.websiteUrl || lead.site || "",
    instagramUrl: payload.instagramUrl || workspace.consulting.instagramUrl || lead.instagram || "",
    instagramNotes: payload.instagramNotes || workspace.consulting.instagramNotes || "",
    priceCents: payload.priceCents ?? workspace.consulting.priceCents,
    providerId: payload.providerId || undefined,
  });
}

export async function promoteConsultingLeadAction(leadId) {
  const id = String(leadId || "");
  const lead = await repo.getLead(id);
  if (!lead) throw new Error("Lead não encontrado.");

  await repo.setGrade(id, "B");
  await repo.moveStage(id, "novo");
  await saveLeadWorkspace(id, {
    consulting: {
      stage: "entregue",
      status: "delivered",
      deliveredAt: new Date().toISOString(),
    },
  });
  refresh(id);
  return { id, grade: "B", stage: "novo" };
}
