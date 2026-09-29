import { generateResilientWithDefaultProvider } from "./providerService.js";

// Builder stages generate artifacts; none has a tool-execution loop.
export function generateSiteWithDefaultProvider(request = {}) {
  return generateResilientWithDefaultProvider({ ...request, disableTools: true, retries: 0 });
}
