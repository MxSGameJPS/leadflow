"use server";
import { revalidatePath } from "next/cache";
import * as repo from "../../repositories/leadRepository.js";
import { parseLeads } from "../../services/imports/parseLeads.js";

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/crm");
  revalidatePath("/agendamentos");
}

export async function createLeadAction(data) { const r = await repo.createLead(data); refresh(); return r; }
export async function updateLeadAction(id, patch) { const r = await repo.updateLead(id, patch); refresh(); return r; }
export async function deleteLeadAction(id) { await repo.deleteLead(id); refresh(); }
export async function moveStageAction(id, stage) { await repo.moveStage(id, stage); refresh(); }
export async function setLandingAction(id, status) { await repo.setLanding(id, status); refresh(); }
export async function setGradeAction(id, grade) { await repo.setGrade(id, grade); refresh(); }
export async function setFollowUpAction(id, date) { await repo.setFollowUp(id, date); refresh(); }
export async function setProposalValueAction(id, value) { await repo.setProposalValue(id, value); refresh(); }
export async function setNotesAction(id, notes) { await repo.setNotes(id, notes); refresh(); }
export async function clearAllAction() { await repo.clearAll(); refresh(); }
export async function importTextAction(text, fname) {
  const arr = parseLeads(text, fname);
  const res = await repo.importLeads(arr);
  refresh();
  return res;
}
