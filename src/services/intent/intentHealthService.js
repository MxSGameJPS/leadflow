import { getAgentReachHealth } from "./providers/agentReachProvider.js";
import { getScraplingHealth } from "./providers/scraplingProvider.js";

function compactChannel(channel = {}) {
  return {
    status: channel.status || "off",
    activeBackend: channel.active_backend || "",
    message: channel.message || "",
  };
}

export async function getIntentHealth({ force = false } = {}) {
  const [agentReach, scrapling] = await Promise.all([
    getAgentReachHealth({ force }),
    getScraplingHealth({ force }),
  ]);
  return {
    agentReach: {
      installed: agentReach.installed,
      error: agentReach.error || "",
      web: compactChannel(agentReach.channels?.exa_search),
      reddit: compactChannel(agentReach.channels?.reddit),
      twitter: compactChannel(agentReach.channels?.twitter),
      facebook: compactChannel(agentReach.channels?.facebook),
    },
    scrapling: {
      installed: scrapling.installed,
      version: scrapling.version || "",
      error: scrapling.error || "",
    },
  };
}
