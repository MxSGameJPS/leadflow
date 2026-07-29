import { listLeads } from "../../repositories/leadRepository.js";
import Board from "../../components/Board/Board.jsx";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listLeads();
  return <Board initialLeads={leads} />;
}
