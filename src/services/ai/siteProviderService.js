import { generateResilientWithDefaultProvider } from "./providerService.js";

function clean(value) {
  return String(value || "").trim().slice(0, 300);
}

export function siteModelForRole(role = "") {
  const key = {
    creative: "LEADFLOW_SITE_MODEL_CREATIVE",
    architect: "LEADFLOW_SITE_MODEL_ARCHITECT",
    code: "LEADFLOW_SITE_MODEL_CODE",
    review: "LEADFLOW_SITE_MODEL_REVIEW",
    visualReview: "LEADFLOW_SITE_MODEL_VISUAL_REVIEW",
  }[role];
  return clean((key && process.env[key]) || process.env.LEADFLOW_SITE_MODEL || "");
}

// Site generation is intentionally isolated from the general LeadFlow AI route.
// OmniRoute owns failover inside the selected site combo; LeadFlow must not leak
// into LEADFLOW_AI_FALLBACK_MODELS or secondary providers after that combo fails.
export function generateSiteWithDefaultProvider(request = {}) {
  const model = clean(request.model) || siteModelForRole(request.siteRole);
  return generateResilientWithDefaultProvider({
    ...request,
    model,
    providerId: clean(process.env.LEADFLOW_SITE_PROVIDER_ID),
    providerName: clean(process.env.LEADFLOW_SITE_PROVIDER_NAME) || "LeadFlow",
    disableTools: true,
    isolatedRouting: true,
    retries: 0,
  });
}
