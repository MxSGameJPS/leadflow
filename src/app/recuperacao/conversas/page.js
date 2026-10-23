import { listLeads } from "../../../repositories/leadRepository.js";
import { loadWhatsAppInbox } from "../../../services/whatsapp/openwaInbox.js";
import { listManualLinks } from "../../../services/whatsapp/manualLinks.js";
import { listRecoveryDecisions } from "../../../services/recovery/decisionStore.js";
import WhatsAppInbox from "../../../components/WhatsAppInbox/WhatsAppInbox.jsx";

export const dynamic = "force-dynamic";
export default async function ConversationsPage() {
  const leads = await listLeads();
  const inbox = await loadWhatsAppInbox(leads);
  const [manual, decisions] = await Promise.all([listManualLinks(process.env.OPENWA_SESSION_ID),listRecoveryDecisions(process.env.OPENWA_SESSION_ID)]);
  const decisionsByChat = new Map(decisions.map(item => [item.chatId, {status:item.status,reason:item.reason,messageText:item.messageText,consentConfirmed:item.consentConfirmed}]));
  const byChat = new Map(manual.map(item => [item.chatId, item.leadId]));
  const byLead = new Map(leads.map(lead => [lead.id, lead]));
  const chats = inbox.chats.map(chat => {
    const manualLeadId = byChat.get(chat.id);
    const lead = byLead.get(manualLeadId);
    return lead ? { ...chat, leadId: lead.id, leadName: lead.name, leadStage: lead.stage, manuallyLinked: true } : chat;
  });
  const options = leads.map(lead => ({ id: lead.id, name: lead.name, phone: lead.whatsapp || lead.phone || "", city: lead.city || "" }));
  return <WhatsAppInbox inbox={{ ...inbox, chats:chats.map(chat=>({...chat,recovery:decisionsByChat.get(chat.id)||null})) }} leads={options} />;
}
