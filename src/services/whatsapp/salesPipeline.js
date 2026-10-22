/**
 * Deterministic, Harvey-inspired recovery triage. Never equate silence with opt-in.
 * This module prepares a review queue; it does NOT send WhatsApp messages.
 */
const EXCLUDED = new Set(["perdido", "recusado", "bloqueado", "convertido", "cliente", "fechado"]);
export function classifyRecoveryLead(lead) {
  const stage = String(lead.stage || "").toLowerCase();
  const notes = String(lead.notes || "").toLowerCase();
  if (EXCLUDED.has(stage) || /não (me )?(contat|mande)|não tenho interesse|pare de enviar|opt.out|descadastr/i.test(notes)) {
    return { status: "excluded", reason: "Recusa, encerramento ou exclusão identificada." };
  }
  if (!lead.whatsapp && !lead.phone) return { status: "incomplete", reason: "Sem número de telefone." };
  if (lead.site && !lead.weakSite) return { status: "low_priority", reason: "Já possui site e não foi sinalizada necessidade." };
  if (["interessado", "negociacao", "proposta", "reuniao"].includes(stage)) return { status: "active", reason: "Conversa comercial em andamento." };
  return { status: "review", reason: "Revisar histórico, elegibilidade e consentimento antes de contatar." };
}
export function summarizeRecovery(leads) {
  const groups = { review: [], active: [], excluded: [], incomplete: [], low_priority: [] };
  for (const lead of leads) {
    const assessment = classifyRecoveryLead(lead);
    groups[assessment.status].push({ ...lead, recoveryReason: assessment.reason });
  }
  return groups;
}
export function draftReengagement(lead) {
  const company = String(lead.name || "sua empresa").trim();
  return `Olá! Aqui é o Saulo Pavanello. Eu havia entrado em contato sobre a presença digital da ${company}. Se ainda fizer sentido conversar sobre um site próprio, posso te mostrar algumas ideias. Se não for o momento, sem problema — não vou insistir.`;
}
