import { getCommercialPolicy } from "../../../services/commercial/policyStore.js";
import CommercialSettings from "../../../components/CommercialSettings/CommercialSettings.jsx";
export const dynamic="force-dynamic";
export default async function Page(){return <CommercialSettings initialPolicy={await getCommercialPolicy()}/>;}
