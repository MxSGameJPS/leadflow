"use server";

import { revalidatePath } from "next/cache";
import { clearIntentSignals, listIntentSignals, setIntentSignalStatus } from "../../repositories/intentRepository.js";
import { discoverIntentSignals, sendIntentSignalToCrm } from "../../services/intent/intentService.js";
import { getIntentHealth } from "../../services/intent/intentHealthService.js";

function refresh() {
  revalidatePath("/intencao");
  revalidatePath("/leads");
  revalidatePath("/crm");
  revalidatePath("/dashboard");
}

export async function searchIntentAction(input) {
  const result = await discoverIntentSignals(input || {});
  refresh();
  return result;
}

export async function refreshIntentHealthAction() {
  return getIntentHealth({ force: true });
}

export async function listIntentSignalsAction(filters = {}) {
  return listIntentSignals(filters);
}

export async function sendIntentToCrmAction(id) {
  const result = await sendIntentSignalToCrm(id);
  refresh();
  return result;
}

export async function dismissIntentSignalAction(id) {
  const result = await setIntentSignalStatus(String(id), "dismissed");
  refresh();
  return result;
}

export async function restoreIntentSignalAction(id) {
  const result = await setIntentSignalStatus(String(id), "new");
  refresh();
  return result;
}

export async function clearDismissedIntentAction() {
  const result = await clearIntentSignals({ dismissedOnly: true });
  refresh();
  return result;
}
