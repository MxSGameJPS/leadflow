"use server";

import { revalidatePath } from "next/cache";
import { generateLeadMessage } from "../../services/ai/leadMessageService.js";
import { generateLeadOutreachPack } from "../../services/ai/leadOutreachService.js";
import { analyzeLeadConversation } from "../../services/ai/objectionAdvisorService.js";
import { generateSalesIntelDocument } from "../../services/ai/salesIntelService.js";
import { getLead } from "../../repositories/leadRepository.js";
import { appendLeadActivity, getLeadWorkspace, saveLeadWorkspace } from "../../services/workspaces/leadWorkspaceStore.js";
import { getProfessionalProfile } from "../../services/profile/profileStore.js";
import {
  listProviderModels,
  listProvidersPublic,
  removeProvider,
  testProvider,
  upsertProvider,
} from "../../services/ai/providerService.js";

function refresh() {
  revalidatePath("/configuracoes/ia");
}

export async function listProvidersAction() {
  return listProvidersPublic();
}

export async function saveProviderAction(provider) {
  const saved = await upsertProvider(provider || {});
  refresh();
  return saved;
}

export async function deleteProviderAction(id) {
  await removeProvider(id);
  refresh();
}

export async function testProviderAction(id) {
  return testProvider(id);
}

export async function listModelsAction(id) {
  return listProviderModels(id);
}

export async function generateLeadMessageAction(payload) {
  const profile = await getProfessionalProfile();
  return generateLeadMessage({ ...(payload || {}), profile });
}

export async function generateLeadOutreachPackAction(payload = {}) {
  const leadId = String(payload.leadId || "").trim();
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead não encontrado.");
  const [profile, workspace] = await Promise.all([
    getProfessionalProfile(),
    getLeadWorkspace(lead.id),
  ]);
  const result = await generateLeadOutreachPack({
    lead,
    profile,
    workspace,
    providerId: payload.providerId,
  });
  await appendLeadActivity(lead.id, {
    type: "outreach",
    title: "Pacote multicanal gerado",
    detail: [result.providerName, result.model].filter(Boolean).join(" · "),
    createdAt: result.generatedAt,
  });
  return result;
}

export async function generateSalesIntelDocumentAction(payload = {}) {
  const leadId = String(payload.leadId || "").trim();
  const kind = payload.kind === "proposal" ? "proposal" : "meeting_prep";
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead não encontrado.");

  const [profile, workspace] = await Promise.all([
    getProfessionalProfile(),
    getLeadWorkspace(lead.id),
  ]);

  const result = await generateSalesIntelDocument({
    kind,
    lead,
    profile,
    workspace,
    providerId: payload.providerId,
  });

  const nextSalesIntel = {
    ...workspace.salesIntel,
    ...(kind === "proposal"
      ? { proposal: result.text, proposalGeneratedAt: result.generatedAt }
      : { meetingPrep: result.text, meetingGeneratedAt: result.generatedAt }),
    providerName: result.providerName,
    model: result.model,
  };
  const saved = await saveLeadWorkspace(lead.id, { salesIntel: nextSalesIntel });
  await appendLeadActivity(lead.id, {
    type: "document",
    title: kind === "proposal" ? "Proposta gerada com IA" : "Briefing de reunião gerado",
    detail: [result.providerName, result.model].filter(Boolean).join(" · "),
    createdAt: result.generatedAt,
  });
  revalidatePath(`/crm/${lead.id}`);
  return { ...result, salesIntel: saved.salesIntel };
}

export async function analyzeLeadConversationAction(payload = {}) {
  const leadId = String(payload.leadId || "").trim();
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead não encontrado.");

  const [profile, workspace] = await Promise.all([
    getProfessionalProfile(),
    getLeadWorkspace(lead.id),
  ]);

  return analyzeLeadConversation({
    lead: { ...lead, previewUrl: workspace.previewUrl },
    profile,
    workspace,
    conversation: payload.conversation,
    tone: payload.tone,
    objective: payload.objective,
    previousResponse: payload.previousResponse,
    providerId: payload.providerId,
  });
}
