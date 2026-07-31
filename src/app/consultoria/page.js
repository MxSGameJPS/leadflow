import { listLeads } from "../../repositories/leadRepository.js";
import { getLeadWorkspace } from "../../services/workspaces/leadWorkspaceStore.js";
import ConsultingBoard from "../../components/ConsultingBoard/ConsultingBoard.jsx";

export const dynamic = "force-dynamic";

export default async function ConsultingPage() {
  const leads = (await listLeads()).filter(lead => ["C", "D"].includes(lead.grade));
  const workspaces = await Promise.all(leads.map(lead => getLeadWorkspace(lead.id)));
  const consultingLeads = leads.map((lead, index) => ({
    ...lead,
    consulting: workspaces[index].consulting,
  }));
  return <ConsultingBoard initialLeads={consultingLeads} />;
}
