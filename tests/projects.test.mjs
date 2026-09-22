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
const { parseCodegenJson } = await import("../src/services/projects/siteCodegenV4.js");
const { resolveSiteSkills } = await import("../src/services/projects/siteSkills.js");

assert.equal(parseAiJson("~~~".replace(/~/g, "`") + "json\n{ brandName: 'Oficina', colors: { primary: '#111111', }, }\n" + "~~~".replace(/~/g, "`")).brandName, "Oficina");
assert.equal(parseAiJson('{"brandName":"Oficina"}').brandName, "Oficina");
assert.equal(parseCodegenJson('```json\n{"concept":"premium","components":[]}\n```').concept, "premium");
assert.equal(parseCodegenJson('Texto antes\n{"concept":"editorial","components":[]}\nTexto depois').concept, "editorial");
assert.equal(parseCodegenJson("{ concept: 'autoral', components: [], }").concept, "autoral");
assert.equal(parseCodegenJson('<think>planejando</think>\n~~~json\n{"concept":"clean","components":[]}\n~~~').concept, "clean");

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
const generatedRoot = path.join(root, generated.folderPath);
const exportedPage = await fs.readFile(path.join(generatedRoot, "app", "page.jsx"), "utf8");
const exportedLayout = await fs.readFile(path.join(generatedRoot, "app", "layout.jsx"), "utf8");
const exportedPackage = JSON.parse(await fs.readFile(path.join(generatedRoot, "package.json"), "utf8"));
const generationFormat = JSON.parse(await fs.readFile(path.join(generatedRoot, "generation-format.json"), "utf8"));
assert.equal(exportedPackage.dependencies.next, "latest");
assert.equal(exportedPackage.dependencies.react, "latest");
assert.equal(exportedPackage.dependencies["react-dom"], "latest");
assert.equal(generationFormat.format, "unique-codegen-v4");
assert.match(exportedPage, /components\//);
assert.match(exportedLayout, /theme\.module\.css/);
assert.ok(!exportedPage.includes("GeneratedSiteRuntime"));
assert.ok(generated.siteData.codegenPlan?.components?.length >= 3);
for (const component of generated.siteData.codegenPlan.components) {
  const componentDir = path.join(generatedRoot, "components", component.name);
  const jsx = await fs.readFile(path.join(componentDir, component.name + ".jsx"), "utf8");
  const css = await fs.readFile(path.join(componentDir, component.name + ".module.css"), "utf8");
  assert.match(jsx, new RegExp(component.name + "\\.module\\.css"));
  assert.match(jsx, /styles\./);
  assert.ok(!/\sstyle\s*=/.test(jsx), component.name + " não pode usar CSS inline");
  if (/\b(useState|useEffect|window|document|requestAnimationFrame)\b/.test(jsx)) {
    assert.match(jsx, /^\s*["']use client["'];/, component.name + " interativo precisa ser Client Component");
  }
  assert.ok(!/@tailwind|@apply/.test(css), component.name + " não pode usar Tailwind");
  assert.ok(css.length > 40);
}
assert.ok(generated.siteData.design.composition?.archetype);
assert.equal(generated.siteData.blueprint?.version, 3);
assert.equal(generated.siteData.blueprint?.sections?.[0]?.type, "hero");
assert.equal(generated.siteData.blueprint?.sections?.at(-1)?.type, "contact");
assert.ok(!generated.siteData.blueprint.sections.some(section => section.type === "services"), "fallback sem serviços comprovados não deve renderizar seção de serviços");
assert.ok(["whatsapp","phone","maps","instagram","contact"].includes(generated.siteData.ctas?.primary?.action));
assert.ok(!generated.siteData.blueprint.sections.some(section => section.type === "location"), "sem endereço/maps não deve haver seção de localização");
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
assert.ok(commercial.siteData.codegenPlan.components.length >= 7, "site com fatos comerciais deve gerar arquitetura completa");
assert.ok(commercial.siteData.codegenPlan.components.some(component => component.role === "proof"));
assert.ok(commercial.siteData.codegenPlan.components.some(component => component.role === "location"));
assert.ok(commercial.siteData.codegenPlan.components.some(component => component.role === "contact"));
assert.ok(commercial.siteData.codegenPlan.components.some(component => component.role === "mobile-cta"));
await fs.rm(path.join(root, commercial.folderPath), { recursive: true, force: true });

console.log("Testes de projetos passaram.");
