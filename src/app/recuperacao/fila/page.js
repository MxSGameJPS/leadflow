import { getRecoveryQueue } from "../../../services/recovery/queue.js";
import RecoveryQueue from "../../../components/RecoveryQueue/RecoveryQueue.jsx";
export const dynamic="force-dynamic";
export default async function Page(){return <RecoveryQueue initial={await getRecoveryQueue(process.env.OPENWA_SESSION_ID)}/>;}
