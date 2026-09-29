import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const root = process.cwd();
const stamp = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const generatedRelative = `generated-sites/test-draft-${stamp}`;
const generatedAbsolute = path.join(root, generatedRelative);
const projectDir = path.join(root, "data", "projects");

const { createSiteProject, deleteSiteProject, getSiteProject } = await import("../src/services/projects/projectStore.js");
const { generateSiteFolder, parseAiJson } = await import("../src/services/projects/siteGeneratorV2.js");
const { parseCodegenJson } = await import("../src/services/projects/siteCodegenV4.js");
const { calculateVisualQualityScore } = await import("../src/services/projects/siteVisualQa.js");
const { countProjectSnapshots, createProjectSourceSnapshot, restoreLatestProjectSourceSnapshot } = await import("../src/services/projects/projectVersionStore.js");
const { normalizeCodegenDesignSystem } = await import("../src/services/projects/siteDesignSystem.js");
const { applyUnifiedDiff, parseUnifiedDiff } = await import("../src/services/projects/sitePatchEngine.js");
const { analyzeComponentContract, buildComponentEditContext, patchBudgetFor, validatePatchPreservation } = await import("../src/services/projects/siteEditContext.js");
const { withFileTransaction } = await import("../src/services/projects/siteEditTransaction.js");
const { resolveSiteSkills } = await import("../src/services/projects/siteSkills.js");
const { buildProductContract } = await import("../src/services/projects/siteProductContract.js");
const { startGenerationProgress,reportGenerationProgress,finishGenerationProgress,getGenerationProgress } = await import("../src/services/projects/generationProgressStore.js");

assert.equal(parseAiJson("~~~".replace(/~/g, "`") + "json\n{ brandName: 'Oficina', colors: { primary: '#111111', }, }\n" + "~~~".replace(/~/g, "`")).brandName, "Oficina");
assert.equal(parseAiJson('{"brandName":"Oficina"}').brandName, "Oficina");
const progressId="test_progress_"+stamp;
await startGenerationProgress(progressId,{name:"Teste"});
await reportGenerationProgress(progressId,{phase:"code",title:"Criando Hero",file:"components/Hero/Hero.jsx",code:"export default function Hero(){}"});
await finishGenerationProgress(progressId,{projectId:"project-test"});
const progressState=await getGenerationProgress(progressId);
assert.equal(progressState.status,"done");
assert.equal(progressState.files[0],"components/Hero/Hero.jsx");
assert.match(progressState.events[0].code,/function Hero/);
assert.equal(parseAiJson('<think>rascunho</think>\nResposta:\n~~~json\n{"brandName":"Oficina Premium","nested":{"ok":true}}\n~~~\nObservação final').nested.ok,true);
assert.equal(parseAiJson('texto com {ruido} antes do objeto válido {"brandName":"Segundo objeto","colors":{"primary":"#111111"}} depois').brandName,"Segundo objeto");
assert.equal(parseAiJson('prefácio\n{"brandName":"Chave } dentro da string","copy":"Use { identidade } própria"}\nrodapé').copy,"Use { identidade } própria");
assert.equal(parseCodegenJson('```json\n{"concept":"premium","components":[]}\n```').concept, "premium");
assert.equal(parseCodegenJson('Texto antes\n{"concept":"editorial","components":[]}\nTexto depois').concept, "editorial");
assert.equal(parseCodegenJson("{ concept: 'autoral', components: [], }").concept, "autoral");
assert.equal(parseCodegenJson('<think>planejando</think>\n~~~json\n{"concept":"clean","components":[]}\n~~~').concept, "clean");
const visualGood=calculateVisualQualityScore({visualCraft:9,brandSpecificity:9,conversion:8,mobile:9,coherence:9,commercialReadiness:9},{desktop:{h1Count:1,brokenImages:0,horizontalOverflow:false,runtimeErrors:[]},mobile:{h1Count:1,brokenImages:0,horizontalOverflow:false,runtimeErrors:[]}},78);
assert.equal(visualGood.pass,true);
const visualOverflow=calculateVisualQualityScore({visualCraft:10,brandSpecificity:10,conversion:10,mobile:10,coherence:10,commercialReadiness:10},{desktop:{h1Count:1,brokenImages:0,horizontalOverflow:false,runtimeErrors:[]},mobile:{h1Count:1,brokenImages:0,horizontalOverflow:true,runtimeErrors:[]}},78);
assert.equal(visualOverflow.pass,false);
assert.ok(visualOverflow.score<=58);
const visualSmallOverflow=calculateVisualQualityScore({visualCraft:10,brandSpecificity:10,conversion:10,mobile:10,coherence:10,commercialReadiness:10},{desktop:{h1Count:1,brokenImages:0,horizontalOverflow:false,runtimeErrors:[]},mobile320:{h1Count:1,brokenImages:0,horizontalOverflow:true,runtimeErrors:[]},mobile390:{h1Count:1,brokenImages:0,horizontalOverflow:false,runtimeErrors:[]}},78);
assert.equal(visualSmallOverflow.pass,false);
assert.equal(visualSmallOverflow.hardFailure,true);
const visualAccessibility=calculateVisualQualityScore({visualCraft:10,brandSpecificity:10,conversion:10,mobile:10,coherence:10,commercialReadiness:10},{desktop:{h1Count:1,brokenImages:0,horizontalOverflow:false,runtimeErrors:[],missingAltCount:1},mobile390:{h1Count:1,brokenImages:0,horizontalOverflow:false,runtimeErrors:[]}},78);
assert.ok(visualAccessibility.score<=76);
const normalizedDesignSystem=normalizeCodegenDesignSystem({signatureMotif:"Linha editorial própria",antiPatterns:["cards repetidos"]},{design:{colors:{primary:"#112233",accent:"#cc8844",background:"#f6f4ef",surface:"#ffffff",text:"#121212",muted:"#666666"},radius:"soft",composition:{density:"airy"}}});
assert.equal(normalizedDesignSystem.signatureMotif,"Linha editorial própria");
assert.equal(normalizedDesignSystem.tokens.primary,"#112233");
assert.ok(normalizedDesignSystem.tokens.sectionSpace.includes("clamp"));
assert.deepEqual(normalizedDesignSystem.antiPatterns,["cards repetidos"]);
const patchOriginal={"components/Hero/Hero.jsx":"import styles from \"./Hero.module.css\";\n\nexport default function Hero(){\n  return <h1 className={styles.title}>Antes</h1>;\n}\n","components/Hero/Hero.module.css":".title{font-size:2rem}\n"};
const patchText=`\`\`\`diff
--- a/components/Hero/Hero.jsx
+++ b/components/Hero/Hero.jsx
@@ -99,3 +99,3 @@
 export default function Hero(){
-  return <h1 className={styles.title}>Antes</h1>;
+  return <h1 className={styles.title}>Depois</h1>;
 }
\`\`\``;
assert.equal(parseUnifiedDiff(patchText).length,1);
const patched=applyUnifiedDiff(patchOriginal,patchText,Object.keys(patchOriginal));
assert.match(patched.files["components/Hero/Hero.jsx"],/>Depois</);
assert.deepEqual(patched.changedPaths,["components/Hero/Hero.jsx"]);
assert.ok(patched.changedLines>=2);
assert.throws(()=>applyUnifiedDiff(patchOriginal,`--- a/app/page.jsx\n+++ b/app/page.jsx\n@@ -1,1 +1,1 @@\n-old\n+new`,Object.keys(patchOriginal)),/fora do escopo/);

const editSource={jsx:'"use client";\nimport helper from "../../lib/helper.js";\nimport styles from "./Hero.module.css";\nexport default function Hero({site}){return <section id="top" className={styles.root}>{site.brandName}</section>}\n',css:'.root{display:block}\n'};
const editContract=analyzeComponentContract(editSource);
assert.equal(editContract.clientComponent,true);
assert.ok(editContract.imports.includes("../../lib/helper.js"));
assert.ok(editContract.siteFields.includes("brandName"));
assert.ok(editContract.ids.includes("top"));
const editPlan={components:[{name:"Header",role:"navigation",purpose:"Navegação"},{name:"Hero",role:"hero",purpose:"Conversão",acceptanceCriteria:"CTA visível",visualHook:"recorte autoral"},{name:"Proof",role:"proof",purpose:"Confiança"}]};
const editContext=buildComponentEditContext(editPlan,"Hero",editSource);
assert.equal(editContext.previous.name,"Header");
assert.equal(editContext.next.name,"Proof");
assert.equal(editContext.totalComponents,3);
const surgicalBudget=patchBudgetFor(editSource,"mude apenas o texto do botão");
const broadBudget=patchBudgetFor(editSource,"redesenhe o layout completo");
assert.ok(broadBudget.maxChangedLines>surgicalBudget.maxChangedLines);
const preservationOk=validatePatchPreservation(editSource,{...editSource,css:'.root{display:grid}\n'},"mude o layout",{changedLines:2});
assert.equal(preservationOk.ok,true);
const preservationBad=validatePatchPreservation(editSource,{jsx:'import styles from "./Hero.module.css";\nexport default function Hero(){return <section className={styles.missing}>X</section>}\n',css:'.root{display:block}\n'},"mude apenas o texto",{changedLines:4});
assert.equal(preservationBad.ok,false);
assert.ok(preservationBad.errors.some(error=>/use client|imports|classes ausentes/i.test(error)));

const txDir=await fs.mkdtemp(path.join(os.tmpdir(),"leadflow-edit-tx-"));
const txExisting=path.join(txDir,"existing.txt"),txCreated=path.join(txDir,"created.txt");
await fs.writeFile(txExisting,"estado-aprovado","utf8");
await assert.rejects(
  withFileTransaction([txExisting,txCreated],async()=>{
    await fs.writeFile(txExisting,"tentativa-reprovada","utf8");
    await fs.writeFile(txCreated,"nao-deve-sobrar","utf8");
    throw new Error("falha simulada depois da escrita");
  }),
  /falha simulada/
);
assert.equal(await fs.readFile(txExisting,"utf8"),"estado-aprovado");
await assert.rejects(fs.access(txCreated));
const txSuccess=await withFileTransaction([txExisting],async()=>{
  await fs.writeFile(txExisting,"estado-novo-aprovado","utf8");
  return "ok";
});
assert.equal(txSuccess,"ok");
assert.equal(await fs.readFile(txExisting,"utf8"),"estado-novo-aprovado");
await fs.rm(txDir,{recursive:true,force:true});



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
assert.match(exportedPage, /data-leadflow-component/);
assert.match(exportedLayout, /theme\.module\.css/);
assert.match(exportedLayout, /export const viewport/);
assert.match(exportedPage, /application\/ld\+json/);
const seoHelper = await fs.readFile(path.join(generatedRoot, "lib", "siteSeo.js"), "utf8");
assert.match(seoHelper, /LocalBusiness/);
const nextConfig = await fs.readFile(path.join(generatedRoot, "next.config.mjs"), "utf8");
assert.match(nextConfig, /LEADFLOW_BUILD_DIST_DIR/);
const inspectorSource = await fs.readFile(path.join(generatedRoot, "public", "leadflow-inspector.js"), "utf8");
assert.match(inspectorSource, /leadflow:component-selected/);
assert.ok(!exportedPage.includes("GeneratedSiteRuntime"));
assert.ok(generated.siteData.codegenPlan?.components?.length >= 3);
assert.ok(generated.siteData.codegenPlan?.designSystem?.signatureMotif);
const themeModule = await fs.readFile(path.join(generatedRoot, "app", "theme.module.css"), "utf8");
assert.match(themeModule, /--space-section:/);
assert.match(themeModule, /--shadow-elevated:/);
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
  description: "Não possui presença digital encontrada — oportunidade para oferecer um site do zero. Instagram do negócio: https://instagram.com/teste",
  folderPath: commercialFolder,
  skipAi: true,
});
assert.ok(commercial.siteData.blueprint.sections.some(section => section.type === "proof"), "site comercial com prova disponível deve renderizar prova");
assert.ok(commercial.siteData.blueprint.sections.some(section => section.type === "location"), "site comercial com endereço deve renderizar localização");
assert.ok(commercial.siteData.heroTitle.length <= 112);
assert.ok(!/oportunidade|presença digital|site do zero|instagram do negócio/i.test(commercial.siteData.heroText), "notas internas de prospecção não podem aparecer na copy pública");
assert.ok(commercial.siteData.codegenPlan.visualSystem);
assert.ok(commercial.siteData.codegenPlan.responsiveStrategy);
assert.ok(commercial.siteData.codegenPlan.components.length >= 7, "site com fatos comerciais deve gerar arquitetura completa");
assert.ok(commercial.siteData.codegenPlan.components.some(component => component.role === "proof"));
assert.ok(commercial.siteData.codegenPlan.components.some(component => component.role === "location"));
assert.ok(commercial.siteData.codegenPlan.components.some(component => component.role === "contact"));
assert.ok(commercial.siteData.codegenPlan.components.some(component => component.role === "mobile-cta"));
await fs.rm(path.join(root, commercial.folderPath), { recursive: true, force: true });

console.log("Testes de projetos passaram.");

const deliveryContract=buildProductContract({template:"delivery",hasWhatsapp:true,hasMenu:false});
assert.equal(deliveryContract.type,"delivery");
assert.equal(deliveryContract.hardRequirement,true);
assert.match(deliveryContract.dataPolicy,/NÃO invente/i);
assert.match(deliveryContract.checkout,/WhatsApp/i);
const landingContract=buildProductContract({template:"landing"});
assert.equal(landingContract.hardRequirement,false);
