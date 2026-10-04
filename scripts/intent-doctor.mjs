import { getIntentHealth } from "../src/services/intent/intentHealthService.js";

function statusLabel(item = {}) {
  if (item.installed === true || item.status === "ok") return "OK";
  if (item.status === "warn") return "ATENÇÃO";
  return "OFF";
}

function isWebConfigured(web = {}) {
  if (web.status === "ok" || Boolean(web.activeBackend)) return true;
  const message = String(web.message || "").toLowerCase();
  return web.status === "warn" && (
    message.includes("mcporter") ||
    message.includes("exa") ||
    message.includes("配置")
  );
}

const health = await getIntentHealth({ force: true });
const webConfigured = health.agentReach?.installed && isWebConfigured(health.agentReach?.web);

console.log("");
console.log("LeadFlow Intent Engine - diagnóstico");
console.log("-----------------------------------");
console.log(`Agent-Reach : ${health.agentReach?.installed ? "OK" : "OFF"}`);
console.log(`Web / Exa   : ${statusLabel(health.agentReach?.web)}`);
console.log(`Reddit      : ${statusLabel(health.agentReach?.reddit)}`);
console.log(`X / Twitter : ${statusLabel(health.agentReach?.twitter)}`);
console.log(`Facebook    : ${statusLabel(health.agentReach?.facebook)}`);
console.log(`Scrapling   : ${health.scrapling?.installed ? `OK (${health.scrapling.version || "instalado"})` : "OFF"}`);

if (health.agentReach?.web?.status === "warn" && health.agentReach?.web?.message) {
  console.log("");
  console.log("Web / Exa: configurado no mcporter, mas o Agent-Reach não validou a conexão remota durante o doctor.");
}

if (health.agentReach?.reddit?.status !== "ok") {
  console.log("Reddit: requer backend autenticado/login.");
}
if (health.agentReach?.twitter?.status !== "ok") {
  console.log("X / Twitter: requer CLI/backend configurado e autenticação.");
}
if (health.agentReach?.facebook?.status !== "ok") {
  console.log("Facebook: requer OpenCLI + sessão autenticada no Chrome.");
}

if (!health.scrapling?.installed) {
  console.log("Scrapling: execute npm run intent:setup:full.");
}

if (!health.agentReach?.installed) {
  console.log("");
  console.log("Intent Engine ainda não possui o Agent-Reach instalado.");
  process.exitCode = 1;
} else if (!webConfigured) {
  console.log("");
  console.log("Intent Engine: pesquisa web ainda não está configurada.");
  process.exitCode = 1;
} else {
  console.log("");
  console.log("Intent Engine: base pronta. Web/Exa está configurado e o Scrapling está " + (health.scrapling?.installed ? "pronto." : "pendente."));
  console.log("As fontes sociais podem ser ativadas separadamente quando você quiser.");
}
