import { generateResilientWithDefaultProvider } from "./providerService.js";

function clean(value) {
  return String(value || "").trim().slice(0, 300);
}

const VARIANTS = {
  leadflow: { label: "LeadFlow", idEnv: "LEADFLOW_SITE_PROVIDER_ID", nameEnv: "LEADFLOW_SITE_PROVIDER_NAME", modelPrefix: "LEADFLOW_SITE_MODEL" },
  testelead: { label: "TesteLead", idEnv: "TESTELEAD_SITE_PROVIDER_ID", nameEnv: "TESTELEAD_SITE_PROVIDER_NAME", modelPrefix: "TESTELEAD_SITE_MODEL" },
};

function variantConfig(variant = "leadflow") {
  return VARIANTS[clean(variant).toLowerCase()] || VARIANTS.leadflow;
}

export function siteModelForRole(role = "", variant = "leadflow") {
  const cfg = variantConfig(variant);
  const suffix = { creative:"CREATIVE", architect:"ARCHITECT", code:"CODE", review:"REVIEW", visualReview:"VISUAL_REVIEW" }[role];
  return clean((suffix && process.env[cfg.modelPrefix+"_"+suffix]) || process.env[cfg.modelPrefix] || "");
}

export function generateSiteWithDefaultProvider(request = {}) {
  const variant = clean(request.siteVariant || request.variant || "leadflow").toLowerCase();
  const cfg = variantConfig(variant);
  const model = clean(request.model) || siteModelForRole(request.siteRole, variant);
  return generateResilientWithDefaultProvider({
    ...request,
    model,
    providerId: clean(process.env[cfg.idEnv]),
    providerName: clean(process.env[cfg.nameEnv]) || cfg.label,
    disableTools: true,
    isolatedRouting: true,
    retries: 0,
  });
}
