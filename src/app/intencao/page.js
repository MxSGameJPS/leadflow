import IntentDiscovery from "../../components/IntentDiscovery/IntentDiscovery.jsx";
import { intentStats, listIntentSignals } from "../../repositories/intentRepository.js";
import { getIntentHealth } from "../../services/intent/intentHealthService.js";
import { intentServiceOptions, intentSourceOptions } from "../../services/intent/intentQueries.js";

export const dynamic = "force-dynamic";

export default async function IntentPage() {
  const [signals, stats, health] = await Promise.all([
    listIntentSignals({ limit: 250 }),
    intentStats(),
    getIntentHealth(),
  ]);
  return <IntentDiscovery
    initialSignals={signals}
    initialStats={stats}
    initialHealth={health}
    serviceOptions={intentServiceOptions()}
    sourceOptions={intentSourceOptions()}
  />;
}
