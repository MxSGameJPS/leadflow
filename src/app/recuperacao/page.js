import { listLeads } from "../../repositories/leadRepository.js";
import { summarizeRecovery } from "../../services/whatsapp/salesPipeline.js";
import { getOpenWAStatus } from "../../services/whatsapp/openwaClient.js";
import RecoveryPanel from "../../components/RecoveryPanel/RecoveryPanel.jsx";

export const dynamic = "force-dynamic";

export default async function RecoveryPage() {
  const [leads, connection] = await Promise.all([listLeads(), getOpenWAStatus()]);
  const groups = summarizeRecovery(leads);
  return <RecoveryPanel groups={groups} connection={connection} />;
}
