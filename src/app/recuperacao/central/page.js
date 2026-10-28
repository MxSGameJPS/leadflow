import {getRecoveryQueue} from "../../../services/recovery/queue.js";
import RecoveryCentral from "../../../components/RecoveryCentral/RecoveryCentral.jsx";
export const dynamic="force-dynamic";
export default async function Page(){return <RecoveryCentral data={await getRecoveryQueue(process.env.OPENWA_SESSION_ID)}/>;}
