import { prisma } from "../lib/prisma.js";
import { getSupabaseAdmin, isSupabaseConfigured, throwSupabaseError } from "../lib/supabaseAdmin.js";

const CONTACT_KINDS = new Set(["initial", "followup", "last_attempt", "recovery", "call", "manual"]);

function normalizeKind(kind) {
  const value = String(kind || "manual").trim().toLowerCase();
  return CONTACT_KINDS.has(value) ? value : "manual";
}

function normalizeState(row) {
  if (!row) return null;
  return {
    id: row.id,
    lastContactAt: row.last_contact_at ?? row.lastContactAt ?? null,
    lastContactKind: row.last_contact_kind ?? row.lastContactKind ?? null,
    contactCount: Number(row.contact_count ?? row.contactCount ?? 0),
  };
}

export async function listContactStates() {
  if (!isSupabaseConfigured()) {
    const rows = await prisma.lead.findMany({
      select: { id: true, lastContactAt: true, lastContactKind: true, contactCount: true },
    });
    return rows.map(normalizeState);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .select("id,last_contact_at,last_contact_kind,contact_count");
  throwSupabaseError(error, "Não foi possível carregar o histórico de contatos");
  return (data || []).map(normalizeState);
}

export async function recordContact(id, kind = "manual") {
  const leadId = String(id || "").trim();
  if (!leadId) throw new Error("Lead inválido para registrar contato.");

  const normalizedKind = normalizeKind(kind);
  const now = new Date();

  if (!isSupabaseConfigured()) {
    const row = await prisma.lead.update({
      where: { id: leadId },
      data: {
        lastContactAt: now,
        lastContactKind: normalizedKind,
        contactCount: { increment: 1 },
      },
      select: { id: true, lastContactAt: true, lastContactKind: true, contactCount: true },
    });
    return normalizeState(row);
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("leads")
    .select("id,contact_count")
    .eq("id", leadId)
    .single();
  throwSupabaseError(readError, "Não foi possível localizar o lead para registrar contato");

  const { data: updated, error: updateError } = await supabase
    .from("leads")
    .update({
      last_contact_at: now.toISOString(),
      last_contact_kind: normalizedKind,
      contact_count: Number(current?.contact_count || 0) + 1,
    })
    .eq("id", leadId)
    .select("id,last_contact_at,last_contact_kind,contact_count")
    .single();
  throwSupabaseError(updateError, "Não foi possível registrar o contato");
  return normalizeState(updated);
}
