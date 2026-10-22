import { listLeads } from "../../../repositories/leadRepository.js";
import { loadWhatsAppInbox } from "../../../services/whatsapp/openwaInbox.js";
import WhatsAppInbox from "../../../components/WhatsAppInbox/WhatsAppInbox.jsx";

export const dynamic = "force-dynamic";
export default async function ConversationsPage() {
  const leads = await listLeads();
  const inbox = await loadWhatsAppInbox(leads);
  return <WhatsAppInbox inbox={inbox} />;
}
