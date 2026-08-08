import { listLeads } from "../../repositories/leadRepository.js";
import { getLeadWorkspace } from "../../services/workspaces/leadWorkspaceStore.js";
import { resolveCommercialTrack, trackIncludes } from "../../services/leads/commercialTrack.js";
import CRMBoard from "../../components/CRMBoard/CRMBoard.jsx";

export const dynamic = "force-dynamic";

export default async function CRMPage() {
  const leads = await listLeads();
  const workspaces = await Promise.all(leads.map(lead => getLeadWorkspace(lead.id)));
  const projectLeads = leads
    .map((lead, index) => ({
      ...lead,
      lastContactAt: workspaces[index].lastContactAt || "",
      lastContactKind: workspaces[index].lastContactKind || "",
      contactCount: Number(workspaces[index].contactCount || 0),
      commercialTrack: resolveCommercialTrack(lead, workspaces[index]),
    }))
    .filter(lead => trackIncludes(lead.commercialTrack, "projects"));
  return <CRMBoard initialLeads={projectLeads} />;
}
