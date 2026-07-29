"use server";

import { revalidatePath } from "next/cache";
import { getLead, setLanding } from "../../repositories/leadRepository.js";
import { createSiteProject } from "../../services/projects/projectStore.js";

export async function createSiteProjectAction(input = {}) {
  const mode = ["lead", "describe", "google"].includes(input.mode) ? input.mode : "lead";
  let lead = null;

  if (mode === "lead") {
    lead = await getLead(String(input.leadId || ""));
    if (!lead) throw new Error("Selecione um lead existente.");
  }

  const name = lead?.name || String(input.name || "").trim();
  if (!name) throw new Error("Informe o nome do negócio.");

  const project = await createSiteProject({
    leadId: lead?.id || null,
    name,
    segment: lead?.segment || input.segment,
    city: lead?.city || input.city,
    mode,
    source: mode === "lead" ? (lead?.site || lead?.mapsLink || lead?.problem || "Dados do CRM") : input.source,
    template: input.template,
  });

  if (lead) await setLanding(lead.id, "todo");
  revalidatePath("/projetos");
  revalidatePath("/criar-site");
  if (lead) revalidatePath(`/crm/${lead.id}`);
  return project;
}
