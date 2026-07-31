import { notFound } from "next/navigation";
import { getLead } from "../../../repositories/leadRepository.js";
import { getLeadWorkspace } from "../../../services/workspaces/leadWorkspaceStore.js";
import { getProfessionalProfile } from "../../../services/profile/profileStore.js";
import ConsultingWorkspace from "../../../components/ConsultingWorkspace/ConsultingWorkspace.jsx";

export const dynamic = "force-dynamic";

export default async function ConsultingDetailPage({ params }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [workspace, profile] = await Promise.all([
    getLeadWorkspace(lead.id),
    getProfessionalProfile(),
  ]);
  return <ConsultingWorkspace initialLead={lead} initialWorkspace={workspace} initialProfile={profile} />;
}
