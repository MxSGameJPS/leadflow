"use server";

import { revalidatePath } from "next/cache";
import { generateLeadMessage } from "../../services/ai/leadMessageService.js";
import { analyzeLeadConversation } from "../../services/ai/objectionAdvisorService.js";
import { getLead } from "../../repositories/leadRepository.js";
import { getLeadWorkspace } from "../../services/workspaces/leadWorkspaceStore.js";
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
