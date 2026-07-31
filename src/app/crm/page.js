import { listLeads } from "../../repositories/leadRepository.js";
import CRMBoard from "../../components/CRMBoard/CRMBoard.jsx";

export const dynamic = "force-dynamic";

export default async function CRMPage() {
  const leads = (await listLeads()).filter(lead => ["A", "B"].includes(lead.grade));
  return <CRMBoard initialLeads={leads} />;
}
