import { listLeads } from "../../../repositories/leadRepository.js";
import { loadWhatsAppInbox } from "../../../services/whatsapp/openwaInbox.js";
import { listManualLinks } from "../../../services/whatsapp/manualLinks.js";
import WhatsAppInbox from "../../../components/WhatsAppInbox/WhatsAppInbox.jsx";

export const dynamic = "force-dynamic";
export default async function ConversationsPage() {
  const leads = await listLeads();
  const inbox = await loadWhatsAppInbox(leads);
  const manual = await listManualLinks(process.env.OPENWA_SESSION_ID);
  const byChat = new Map(manual.map(item => [item.chatId, item.leadId]));
  const byLead = new Map(leads.map(lead => [lead.id, lead]));
  const chats = inbox.chats.map(chat => {
    const manualLeadId = byChat.get(chat.id);
    const lead = byLead.get(manualLeadId);
    return lead ? { ...chat, leadId: lead.id, leadName: lead.name, leadStage: lead.stage, manuallyLinked: true } : chat;
  });
  const options = leads.map(lead => ({ id: lead.id, name: lead.name, phone: lead.whatsapp || lead.phone || "", city: lead.city || "" }));
  return <WhatsAppInbox inbox={{ ...inbox, chats }} leads={options} />;
}
