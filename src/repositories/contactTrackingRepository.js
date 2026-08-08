import { prisma } from "../lib/prisma.js";

const CONTACT_KINDS = new Set(["initial", "followup", "last_attempt", "recovery", "call", "whatsapp", "manual"]);

function normalizeKind(kind) {
  const value = String(kind || "manual").trim().toLowerCase();
  return CONTACT_KINDS.has(value) ? value : "manual";
}

export async function recordContact(id, kind = "manual") {
  const leadId = String(id || "").trim();
  if (!leadId) throw new Error("Lead inválido para registrar contato.");

  return prisma.lead.update({
    where: { id: leadId },
    data: {
      lastContactAt: new Date(),
      lastContactKind: normalizeKind(kind),
      contactCount: { increment: 1 },
    },
    select: {
      id: true,
      lastContactAt: true,
      lastContactKind: true,
      contactCount: true,
    },
  });
}
