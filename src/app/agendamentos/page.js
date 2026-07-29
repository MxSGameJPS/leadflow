import { listLeads } from "../../repositories/leadRepository.js";
import { listLeadWorkspaces } from "../../services/workspaces/leadWorkspaceStore.js";
import AppointmentsList from "../../components/AppointmentsList/AppointmentsList.jsx";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const [leads, workspaces] = await Promise.all([listLeads(), listLeadWorkspaces()]);
  const workspaceByLead = new Map(workspaces.map(item => [item.leadId, item.workspace]));
  const appointments = leads
    .filter(lead => lead.followUpAt)
    .map(lead => ({ lead, workspace: workspaceByLead.get(lead.id) || { appointment: { type: "Follow-up", time: "09:00", notes: "" } } }))
    .sort((a, b) => `${a.lead.followUpAt} ${a.workspace.appointment?.time || ""}`.localeCompare(`${b.lead.followUpAt} ${b.workspace.appointment?.time || ""}`));

  return <AppointmentsList appointments={appointments} />;
}
