import { getIntentHealth } from "../src/services/intent/intentHealthService.js";

const health = await getIntentHealth({ force: true });
console.log(JSON.stringify(health, null, 2));
const ready = health.agentReach?.installed && (health.agentReach?.web?.status === "ok" || Boolean(health.agentReach?.web?.activeBackend));
if (!ready) {
  console.log("\nIntent Engine ainda não possui pesquisa web ativa. Instale/configure Agent-Reach e rode este diagnóstico novamente.");
  process.exitCode = 1;
} else {
  console.log("\nIntent Engine: pesquisa web disponível.");
}
