import { getRecoveryMetrics } from "../../../services/recovery/metrics.js";
import RecoveryMetrics from "../../../components/RecoveryMetrics/RecoveryMetrics.jsx";
export const dynamic="force-dynamic";
export default async function Page(){return <RecoveryMetrics data={await getRecoveryMetrics(process.env.OPENWA_SESSION_ID?.trim())}/>;}
