import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const stamp = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const generatedRelative = `generated-sites/test-draft-${stamp}`;
const generatedAbsolute = path.join(root, generatedRelative);
const projectDir = path.join(root, "data", "projects");

const { createSiteProject, deleteSiteProject, getSiteProject } = await import("../src/services/projects/projectStore.js");
const { generateSiteFolder, parseAiJson } = await import("../src/services/projects/siteGeneratorV2.js");
const { resolveSiteSkills } = await import("../src/services/projects/siteSkills.js");

assert.equal(parseAiJson("~~~".replace(/~/g, "`") + "json\n{ brandName: 'Oficina', colors: { primary: '#111111', }, }\n" + "~~~".replace(/~/g, "`")).brandName, "Oficina");
assert.equal(parseAiJson('{"brandName":"Oficina"}').brandName, "Oficina");

const autoSkills = resolveSiteSkills({ mode: "auto", instruction: "Use este print como referência visual", referenceImages: [] });
assert.equal(autoSkills.mode, "auto");
assert.ok(autoSkills.skills.includes("impeccable"));
assert.ok(autoSkills.skills.includes("ui-ux-pro-max"));
assert.ok(autoSkills.skills.includes("creative-web-director"));
assert.ok(autoSkills.skills.includes("seo-content-engine"));
assert.ok(autoSkills.skills.includes("screenshot-to-ui-blueprint"));

const focusedSeoSkills = resolveSiteSkills({ mode: "auto", phase: "refine", instruction: "Melhore apenas o SEO, title e meta description" });
assert.deepEqual(focusedSeoSkills.skills, ["seo-content-engine"]);

const focusedVisualSkills = resolveSiteSkills({ mode: "auto", phase: "refine", instruction: "Deixe o hero mais premium" });
assert.ok(focusedVisualSkills.skills.includes("impeccable"));
assert.ok(focusedVisualSkills.skills.includes("ui-ux-pro-max"));
assert.ok(focusedVisualSkills.skills.includes("creative-web-director"));
assert.ok(focusedVisualSkills.skills.includes("conversion-director"));

const manualSkills = resolveSiteSkills({ mode: "manual", selectedSkills: ["conversion-director", "invalid-skill"] });
assert.deepEqual(manualSkills.skills, ["conversion-director"]);

const draft = await createSiteProject({
  name: `Rascunho teste ${stamp}`,
  status: "draft",
  folderPath: generatedRelative,
});

await fs.mkdir(generatedAbsolute, { recursive: true });
await fs.writeFile(path.join(generatedAbsolute, "preview.txt"), "teste", "utf8");

await deleteSiteProject(draft.id);
await assert.rejects(fs.access(path.join(projectDir, `${draft.id}.json`)));
await assert.rejects(fs.access(generatedAbsolute));

const ready = await createSiteProject({
  name: `Projeto pronto ${stamp}`,
  status: "ready",
  effects: ["glass-header", "invalid-effect", "hover-lift"],
  referenceImages: [{ fileName: "ref.jpg", label: "Referência", mimeType: "image/jpeg", size: 123 }],
  skillMode: "manual",
  skills: ["brand-system-architect", "invalid-skill", "conversion-director"],
});
const loadedReady = await getSiteProject(ready.id);
assert.deepEqual(loadedReady.effects, ["glass-header", "hover-lift"]);
assert.equal(loadedReady.referenceImages.length, 1);
assert.equal(loadedReady.skillMode, "manual");
assert.deepEqual(loadedReady.skills, ["brand-system-architect", "conversion-director"]);

await assert.rejects(
  deleteSiteProject(ready.id),
  /Somente projetos em rascunho ou em construção/
);

await fs.rm(path.join(projectDir, `${ready.id}.json`), { force: true });

const integrityFolder = `generated-sites/runtime-integrity-${stamp}`;
const generated = await generateSiteFolder({
  name: "Runtime Integrity",
  segment: "Restaurante",
  city: "Ivoti",
  template: "landing",
  folderPath: integrityFolder,
  skipAi: true,
  effects: ["entrance-motion", "section-reveal"],
});
const runtimeSource = await fs.readFile(path.join(root, "src", "components", "GeneratedSiteRuntime", "GeneratedSiteRuntime.jsx"), "utf8");
const runtimeCssSource = await fs.readFile(path.join(root, "src", "components", "GeneratedSiteRuntime", "GeneratedSiteRuntime.module.css"), "utf8");
const exportedRuntime = await fs.readFile(path.join(root, generated.folderPath, "components", "GeneratedSiteRuntime", "GeneratedSiteRuntime.jsx"), "utf8");
const exportedRuntimeCss = await fs.readFile(path.join(root, generated.folderPath, "components", "GeneratedSiteRuntime", "GeneratedSiteRuntime.module.css"), "utf8");
const exportedPage = await fs.readFile(path.join(root, generated.folderPath, "app", "page.js"), "utf8");
assert.equal(exportedRuntime, runtimeSource);
assert.equal(exportedRuntimeCss, runtimeCssSource);
assert.match(exportedPage, /GeneratedSiteRuntime/);
assert.ok(generated.siteData.design.composition?.archetype);
assert.equal(generated.siteData.blueprint?.version, 3);
assert.equal(generated.siteData.blueprint?.sections?.[0]?.type, "hero");
assert.equal(generated.siteData.blueprint?.sections?.at(-1)?.type, "contact");
assert.ok(!generated.siteData.blueprint.sections.some(section => section.type === "services"), "fallback sem serviços comprovados não deve renderizar seção de serviços");
assert.ok(["whatsapp","phone","maps","instagram","contact"].includes(generated.siteData.ctas?.primary?.action));
assert.ok(!generated.siteData.blueprint.sections.some(section => section.type === "location"), "sem endereço/maps não deve haver seção de localização");
assert.match(runtimeSource, /MobileActionBar/);
assert.match(runtimeCssSource, /max-width:768px/);
assert.match(runtimeCssSource, /mobileActionBar/);
assert.match(runtimeCssSource, /max-width:390px/);
assert.match(runtimeCssSource, /scroll-snap-type:x mandatory/);
await fs.rm(path.join(root, generated.folderPath), { recursive: true, force: true });

const commercialFolder = `generated-sites/commercial-contract-${stamp}`;
const commercial = await generateSiteFolder({
  name: "Comercial Mobile",
  segment: "Estética",
  city: "Ivoti",
  address: "Rua Teste, 100 - Ivoti - RS",
  phone: "(51) 99999-9999",
  rating: 5,
  reviews: 12,
  mapsLink: "https://maps.google.com/?q=Ivoti",
  folderPath: commercialFolder,
  skipAi: true,
});
assert.ok(commercial.siteData.blueprint.sections.some(section => section.type === "proof"), "site comercial com prova disponível deve renderizar prova");
assert.ok(commercial.siteData.blueprint.sections.some(section => section.type === "location"), "site comercial com endereço deve renderizar localização");
assert.ok(commercial.siteData.heroTitle.length <= 112);
await fs.rm(path.join(root, commercial.folderPath), { recursive: true, force: true });

console.log("Testes de projetos passaram.");
