import { notFound } from "next/navigation";
import { getLead } from "../../../repositories/leadRepository.js";
import { getLeadWorkspace } from "../../../services/workspaces/leadWorkspaceStore.js";
import { getProfessionalProfile } from "../../../services/profile/profileStore.js";
import LeadWorkspace from "../../../components/LeadWorkspace/LeadWorkspace.jsx";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [workspace, profile] = await Promise.all([
    getLeadWorkspace(lead.id),
    getProfessionalProfile(),
  ]);
  return <LeadWorkspace initialLead={lead} initialWorkspace={workspace} initialProfile={profile} />;
}
