import { prisma } from "../../lib/prisma.js";
export async function listManualLinks(sessionId) {
  if (!sessionId) return [];
  return prisma.whatsAppLeadLink.findMany({ where: { sessionId } });
}
export async function saveManualLink({ sessionId, chatId, leadId }) {
  if (!sessionId || !chatId || !leadId) throw new Error("Dados obrigatórios ausentes.");
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw new Error("Lead não encontrado no banco local.");
  return prisma.whatsAppLeadLink.upsert({
    where: { sessionId_chatId: { sessionId, chatId } },
    create: { sessionId, chatId, leadId }, update: { leadId },
  });
}
export async function removeManualLink(sessionId, chatId) {
  return prisma.whatsAppLeadLink.deleteMany({ where: { sessionId, chatId } });
}
