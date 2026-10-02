import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateSiteWithDefaultProvider as generate } from "../ai/siteProviderService.js";
import { runVisualQualityAudit } from "./siteVisualQa.js";
import { buildProductContract, productContractPrompt } from "./siteProductContract.js";
import { createGenerationBudget, normalizeProductPlan, safeGeneratedPath, DESIGN_BRIEF } from "./siteBuilderPolicy.js";
import { generateUniqueSiteCode } from "./siteCodegenV4.js";

import { buildSiteSkillsSystemPrompt } from "./siteSkills.js";
import { premiumDesignSystem, installPremiumFoundation, builderComponentManifest } from "./sitePremiumDesign.js";
import { withFileTransaction } from "./siteEditTransaction.js";

const execFileAsync=promisify(execFile);
const clean=(v,n=200000)=>String(v??"").replace(/\u0000/g,"").trim().slice(0,n);
const modelFor=s=>s.siteVariant==="testelead"?"":clean(process.env.LEADFLOW_SITE_MODEL||"",300);
const CORE_FILES=new Set(["app/page.jsx","app/page.js","app/layout.jsx","app/layout.js","app/globals.css","package.json"]);

function safePath(v){return safeGeneratedPath(v)}
function parseJson(text){const raw=clean(text,120000).replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/,"").trim();const a=raw.indexOf("{"),b=raw.lastIndexOf("}");if(a<0||b<a)throw new Error("Planner não retornou JSON.");return JSON.parse(raw.slice(a,b+1))}
function parseFiles(text){const raw=clean(text,400000).replace(/<think>[\s\S]*?<\/think>/gi,""),files=[];const re=/<FILE\s+path=["']([^"']+)["']\s*>\s*([\s\S]*?)\s*<\/FILE>/gi;let m;while((m=re.exec(raw))){const p=safePath(m[1]);if(p)files.push({path:p,content:m[2]})}if(!files.length)throw new Error("Worker não retornou arquivos.");return files}
function sanitizeGeneratedFiles(files){return files.map(file=>{let content=String(file.content||"");if(/\.css$/i.test(file.path)){content=content.replace(/\r/g,"").replace(/^\s*(background|color|padding|margin|display|width|height|border|font-size|font-weight|line-height|gap|position|top|right|bottom|left|opacity|transform|transition)\s*$/gmi,"").replace(/(^|\n)(\s*)([a-z-]+)\s*\n(\s*})/gi,"$1$2$4").replace(/\n{3,}/g,"\n\n")}return{...file,content}})}
function violations(files){const e=[];for(const f of files){if(["data/siteData.js","app/leadflow-foundation.css"].includes(f.path))e.push("Dados reservados: "+f.path);if(/\.(ts|tsx)$/.test(f.path))e.push("TypeScript: "+f.path);if(/\.css$/.test(f.path)&&/@tailwind|@apply\b/.test(f.content))e.push("Tailwind: "+f.path);if(/\.(jsx|js)$/.test(f.path)&&/\sstyle\s*=\s*\{/.test(f.content))e.push("CSS inline: "+f.path)}return e}
function taskFiles(files){return files.filter(f=>!CORE_FILES.has(f.path)&&!/^docs\//.test(f.path))}
async function apply(root,files,{allowCore=false}={}){files=sanitizeGeneratedFiles(files);if(!allowCore)files=taskFiles(files);const e=violations(files);if(e.length){const err=new Error("Contrato técnico violado: "+e.join(" | "));err.code="TECH_CONTRACT";err.violations=e;throw err}for(const f of files){const target=path.join(root,f.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,f.content,"utf8")}return files}
async function manifest(root){const out=[];async function walk(dir,rel=""){let ents=[];try{ents=await fs.readdir(dir,{withFileTypes:true})}catch{return}for(const x of ents){if(["node_modules",".next",".leadflow-build","public"].includes(x.name)||/^\.leadflow-preview-\d+$/.test(x.name))continue;const r=rel?rel+"/"+x.name:x.name,p=path.join(dir,x.name);if(x.isDirectory())await walk(p,r);else if(/\.(jsx|js|css|json|mjs)$/.test(x.name))out.push(r)}}await walk(root);return out.slice(0,180)}
async function contextFiles(root,n=18){const names=await manifest(root),preferred=names.filter(x=>/^(app|components|data|lib)\//.test(x)).slice(-n),out=[];for(const name of preferred){try{out.push({path:name,content:clean(await fs.readFile(path.join(root,name),"utf8"),14000)})}catch{}}return out}
async function setup(root,name){for(const x of ["app","components","data","lib","docs"])await fs.rm(path.join(root,x),{recursive:true,force:true});for(const dir of ["app","components","data","lib"])await fs.mkdir(path.join(root,dir),{recursive:true});await fs.writeFile(path.join(root,"next.config.mjs"),'export default {distDir: process.env.LEADFLOW_BUILD_DIST_DIR || ".next"};\n');await fs.writeFile(path.join(root,"app","layout.jsx"),'import "./globals.css";\nexport const metadata={title:"Site em construção"};\nexport default function RootLayout({children}){return <html lang="pt-BR"><body>{children}</body></html>}\n',"utf8");await fs.writeFile(path.join(root,"app","globals.css"),':root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;padding:0}body{min-height:100vh}a{color:inherit;text-decoration:none}img{max-width:100%;height:auto}\n',"utf8");await fs.writeFile(path.join(root,"app","page.jsx"),'export default function Page(){return <main>Construindo experiência…</main>}\n',"utf8");const pkg={name:String(name||"leadflow-site").toLowerCase().replace(/[^a-z0-9-]/g,"-")||"leadflow-site",version:"1.0.0",private:true,scripts:{dev:"next dev",build:"next build",start:"next start"},dependencies:{next:"latest",react:"latest","react-dom":"latest"}};await fs.writeFile(path.join(root,"package.json"),JSON.stringify(pkg,null,2));await fs.writeFile(path.join(root,"generation-format.json"),JSON.stringify({format:"product-builder-v7",generatedAt:new Date().toISOString()},null,2))}
async function nextBin(root){try{const p=path.join(root,"node_modules","next","dist","bin","next");await fs.access(p);return p}catch{return path.join(process.cwd(),"node_modules","next","dist","bin","next")}}
async function deterministicRepair(root){const names=await manifest(root);for(const name of names){const target=path.join(root,name);if(/\.css$/i.test(name)){try{const raw=await fs.readFile(target,"utf8"),fixed=sanitizeGeneratedFiles([{path:name,content:raw}])[0].content;if(fixed!==raw)await fs.writeFile(target,fixed,"utf8")}catch{}}if(/\.(jsx|js)$/.test(name)){try{let raw=await fs.readFile(target,"utf8");if(/\b(useState|useEffect|useMemo|useCallback|useRef|useReducer|useContext|useLayoutEffect)\b/.test(raw)&&!/^[\s\n]*["']use client["'];/.test(raw))raw='"use client";\n'+raw;const imports=[...raw.matchAll(/from\s+["'](\.\.?\/[^"']+\.module\.css)["']/g)];for(const m of imports){const css=path.resolve(path.dirname(target),m[1]);try{await fs.access(css)}catch{throw new Error("CSS Module ausente: "+m[1])}}await fs.writeFile(target,raw,"utf8")}catch{}}}}
async function build(root){await deterministicRepair(root);const bin=await nextBin(root);await fs.rm(path.join(root,".leadflow-build"),{recursive:true,force:true});try{const r=await execFileAsync(process.execPath,[bin,"build"],{cwd:root,timeout:180000,maxBuffer:5e6,env:{...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",LEADFLOW_BUILD_DIST_DIR:".leadflow-build"}});return{ok:true,log:clean((r.stdout||"")+"\n"+(r.stderr||""),30000),nextBin:bin}}catch(e){return{ok:false,log:clean((e.stdout||"")+"\n"+(e.stderr||"")+"\n"+e.message,30000),nextBin:bin}}}
function facts(s){return {name:s.brandName,segment:s.segment,city:s.city,address:s.address,phone:s.phone,whatsapp:s.whatsapp,instagram:s.instagram,mapsLink:s.mapsLink,rating:s.rating,reviews:s.reviews,hours:s.hours,images:s.images,description:s.sourceDescription||s.description,brandEvidence:s.brandEvidence,productContract:s.productContract,effects:s.effects||[],skills:s.skills||[],skillMode:s.skillMode||"auto",skillGuidance:clean(buildSiteSkillsSystemPrompt(s.skills||[]),10000)}}
function base(s,timeout){return{model:modelFor(s),siteVariant:s.siteVariant||"leadflow",siteRole:"builder",timeoutMs:Number(process.env.LEADFLOW_SITE_TASK_TIMEOUT_MS||Math.max(timeout||0,360000)),retries:0}}
function plannerRequest(s,instruction,images){return {...base(s,120000),temperature:.7,maxTokens:5000,images,systemPrompt:'Você é diretor de produto e design. '+DESIGN_BRIEF+' Antes de escolher, compare três direções realmente distintas em composição, tipografia, tratamento de imagens e navegação. Não basta trocar cores. Decida pela evidência do negócio e referências; registre alternativas, motivos de rejeição e a escolhida em designExploration. Sem evidência suficiente, declare que é uma proposta criativa, não identidade observada. Skills são critérios de qualidade, não estilos nem sequências obrigatórias. A variante B deve explorar uma direção de composição alternativa à primeira ideia óbvia. Retorne somente JSON. Planeje PREFERENCIALMENTE 3 blocos grandes (mínimo 2, máximo 4), cada um entregando capacidades completas. Sem seções fixas, sem microtarefas. Um bloco deve ser dono do estado/dados compartilhados. Defina imports/exports, props, modelos de dados e APIs de estado em sharedInterfaces ANTES de dividir os blocos. Todos usarão exatamente esses contratos. app/page.jsx, layout.jsx e globals.css pertencem ao integrador; data/siteData.js já existe e é reservado. Os workers podem criar components, lib e outros arquivos data. Todos os módulos devem ter dono único. Distribua TODAS as capacidades obrigatórias nos goals.',prompt:productContractPrompt(s.productContract)+'\nNEGÓCIO: '+JSON.stringify(facts(s))+'\nPEDIDO: '+clean(instruction,5000)+'\nFORMATO: '+JSON.stringify({concept:'tese específica ao lead',productVision:'jornada completa',designExploration:{evidence:[],alternatives:[{name:'',composition:'',typography:'',imagery:'',fit:''}],selected:'',reason:''},visualDirection:{palette:{brand:'',accent:'',background:'',surface:'',text:''},typography:{},spacing:[],signature:'',mobile:'',motion:''},sharedInterfaces:{exports:[],dataSchema:{},stateApi:{}},tasks:[{id:'block',title:'Capacidades completas',goal:'Implementação e critérios de aceite',targetFiles:['components/Experience/Experience.jsx','components/Experience/Experience.module.css'],dependsOn:[]}]})}}
function normalizePlan(raw){return normalizeProductPlan(raw)}
function workerRequest(s,plan,task,tree,ctx,images,recovery=false){const targets=task.targetFiles?.length?task.targetFiles.join(", "):"crie componentes/data/lib próprios para esta tarefa";return{...base(s,recovery?150000:120000),temperature:.65,maxTokens:Number(process.env.LEADFLOW_SITE_TASK_MAX_TOKENS||8500),images,systemPrompt:"Você é um worker especialista. Execute SOMENTE sua tarefa. Você tem liberdade criativa total dentro dela, mas NÃO pode editar app/page.jsx, app/layout.jsx, app/globals.css, package.json, arquivos de outros workers ou criar documentação. Gere apenas os arquivos completos da sua responsabilidade. Next.js App Router + React, JavaScript/JSX + CSS Modules; sem TypeScript, Tailwind, CSS-in-JS ou style={{}}. Se usar hooks ou eventos, inclua \"use client\". Cada import de .module.css deve vir acompanhado do respectivo arquivo CSS. Use fielmente os tokens, imports, exports e estado em INTERFACES COMPARTILHADAS. Todo componente exportado deve receber props compatíveis. Use os tokens --lf-* do sistema premium quando apropriado; não edite app/leadflow-foundation.css. O estado do carrinho deve ser único entre catálogo e checkout, persistente e seguro no SSR. Imagens somente dos assets fornecidos; nenhum URL inventado. Saída exclusiva: <FILE path=\"...\">conteúdo</FILE>.",prompt:`VISÃO: ${plan.productVision}\nCONCEITO: ${plan.concept}\nDIREÇÃO: ${JSON.stringify(plan.visualDirection)}\nINTERFACES COMPARTILHADAS: ${JSON.stringify(plan.sharedInterfaces)}\nCONTRATO: ${productContractPrompt(s.productContract)}\nNEGÓCIO: ${JSON.stringify(facts(s))}\nTAREFA: ${task.title}\nOBJETIVO: ${task.goal}\nARQUIVOS SOB SUA RESPONSABILIDADE: ${targets}\nARQUIVOS JÁ EXISTENTES: ${JSON.stringify(tree)}\nCONTEXTO:\n${ctx.map(f=>"--- "+f.path+" ---\n"+f.content).join("\n")}\n${recovery?"Esta é uma recuperação de tarefa que falhou antes. Seja objetivo e conclua somente os arquivos necessários.":""}`}}
function integratorRequest(s,plan,tree,ctx,failed=[]){return{...base(s,150000),temperature:.55,maxTokens:12000,systemPrompt:"Você é o integrador final do produto. Os workers já criaram componentes independentes. Sua função é montar a aplicação coerente e funcional sem redesenhar os componentes. Você é o ÚNICO autorizado a editar app/page.jsx, app/layout.jsx e app/globals.css. Corrija também imports/exports estritamente necessários. Next.js App Router, JavaScript/JSX, CSS Modules, sem TypeScript/Tailwind/CSS inline. Garanta que hooks estejam em Client Components. Retorne somente arquivos completos no protocolo <FILE path=\"...\">...</FILE>.",prompt:`VISÃO: ${plan.productVision}\nDIREÇÃO: ${JSON.stringify(plan.visualDirection)}\nINTERFACES COMPARTILHADAS: ${JSON.stringify(plan.sharedInterfaces)}\nCONTRATO: ${productContractPrompt(s.productContract)}\nNEGÓCIO: ${JSON.stringify(facts(s))}\nARQUIVOS EXISTENTES: ${JSON.stringify(tree)}\nTAREFAS QUE NÃO CONSEGUIRAM CONCLUIR: ${JSON.stringify(failed.map(({title,goal,targetFiles,error})=>({title,goal,targetFiles,error})))||"nenhuma"}\nCONTEÚDO DOS ARQUIVOS:\n${ctx.map(f=>"--- "+f.path+" ---\n"+f.content).join("\n")}\nIntegre TODAS as capacidades, conecte o estado compartilhado e fluxos. Marque os componentes visuais com wrappers sem alterar sua composição, data-leadflow-component igual ao nome de exportação. Marque o main com data-leadflow-component="Page" e mantenha os data-testid exigidos pelo contrato. Exiba claramente dados demonstrativos. Não crie checklists nem documentação.`}}
function repairRequest(s,plan,problem,tree,ctx){return{...base(s,150000),temperature:.25,maxTokens:7000,systemPrompt:"Você é o engenheiro de correção. Corrija somente os problemas comprovados pelo build, testes da jornada e auditoria visual. Preserve a identidade e melhore os pontos medidos. Pode editar os arquivos diretamente envolvidos no erro. Next.js + JavaScript/JSX + CSS Modules; sem TS/Tailwind/CSS inline. Se um JSX importar CSS Module, mantenha/crie o CSS correspondente. Se usar React hooks, marque como Client Component. Retorne somente arquivos completos <FILE path=\"...\">...</FILE>.",prompt:`VISÃO: ${plan.productVision}\nCONTRATO: ${productContractPrompt(s.productContract)}\nINTERFACES: ${JSON.stringify(plan.sharedInterfaces)}\nPROBLEMAS OBSERVADOS:\n${clean(problem,12000)}\nARQUIVOS: ${JSON.stringify(tree)}\n${ctx.map(f=>"--- "+f.path+" ---\n"+f.content).join("\n")}`}}
function qaPlan(plan){return{concept:plan.concept||"autonomous",components:builderComponentManifest(plan),creativeThesis:plan.productVision||"",visualSystem:JSON.stringify(plan.visualDirection)||"",conversionStrategy:"Autônoma",imageStrategy:"Autônoma",responsiveStrategy:"Autônoma",designSystem:plan.designSystem||{}}}
async function runWorker({s,plan,task,root,images,progress,index,total,call,recovery=false}){const tree=await manifest(root),ctx=await contextFiles(root);if(!recovery)await progress({phase:"task",title:(index+1)+"/"+total+" · "+task.title,detail:task.goal,kind:"agent"});const req=workerRequest(s,plan,task,tree,ctx,index<3?images:[],recovery);req.onAttempt=e=>progress({phase:"ai",title:task.title+" · "+e.status,detail:[e.model,e.elapsedMs&&Math.round(e.elapsedMs/1000)+"s"].filter(Boolean).join(" · "),kind:"model"});let files=parseFiles((await call("worker:"+task.id,req)).text);const wanted=new Set(task.targetFiles||[]);if(files.some(f=>!wanted.has(f.path)))throw new Error("Worker tentou alterar arquivo de outro bloco.");if([...wanted].some(p=>!files.some(f=>f.path===p)))throw new Error("Worker omitiu arquivo contratado; saída não aplicada parcialmente.");files=await apply(root,files);if(!files.length)throw new Error("Worker não produziu arquivos permitidos para a tarefa.");for(const f of files)await progress({phase:"files",title:"Created/Updated "+f.path,detail:"Tarefa concluída: "+task.title,kind:"file",file:f.path,code:clean(f.content,1200)});return files}

export async function generateAutonomousSite(options={}) {
  if(options.skipAi)return generateUniqueSiteCode({...options,visualQa:false});
  const root=path.resolve(process.cwd(),options.folderPath);
  const allowed=path.resolve(process.cwd(),"generated-sites")+path.sep;
  if(!root.startsWith(allowed))throw new Error("Workspace de geração fora de generated-sites.");
  const progress=async event=>{try{await options.onProgress?.(event)}catch{}};
  const site={...options.siteData};
  site.productContract=buildProductContract({template:site.productContract?.type||site.template,instruction:options.instruction,segment:site.segment});
  const images=(options.visualImages||[]).filter(x=>x?.dataUrl).slice(0,4);
  const previous=options.resumeWorkspace?JSON.parse(await fs.readFile(path.join(root,"builder-report.json"),"utf8")):null;
  const budget=createGenerationBudget();
  if(previous)budget.calls.push(...previous.calls);
  const call=(stage,request)=>budget.run(stage,request,generate);
  const report=async data=>{
    await fs.mkdir(root,{recursive:true});
    await fs.writeFile(path.join(root,"builder-report.json"),JSON.stringify({format:"product-builder-v7",...data,calls:budget.calls,callLimit:budget.limit},null,2));
  };
  let plan;
  try {
    await progress({phase:"plan",title:"Definindo produto e identidade",detail:"Contrato funcional, direção visual e poucos blocos completos. Limite de 7 chamadas por variante."});
    let director;
    if(options.resumeWorkspace){director=JSON.parse(await fs.readFile(path.join(root,"director-plan.json"),"utf8"));}
    else if(options.resumePlan){director=JSON.parse(await fs.readFile(path.join(root,"director-plan.json"),"utf8"));budget.calls.push({stage:"director",status:"reused",elapsedMs:0});}
    else {director=parseJson((await call("director",plannerRequest(site,options.instruction||"",images))).text);await fs.mkdir(root,{recursive:true});await fs.writeFile(path.join(root,"director-plan.json"),JSON.stringify(director,null,2));}
    plan=normalizePlan(director);
    plan.designSystem=premiumDesignSystem(plan.visualDirection,site);
    plan.visualDirection={...plan.visualDirection,premium:plan.designSystem};
    if(!options.resumeWorkspace)await setup(root,options.folderName);
    await fs.writeFile(path.join(root,"data","siteData.js"),"export default "+JSON.stringify(site,null,2)+";\n");
    await progress({phase:"plan",title:"Direção definida",detail:plan.concept+" · "+plan.tasks.length+" blocos de implementação."});
    const failed=options.resumeWorkspace?plan.tasks.filter(task=>!previous.calls.some(c=>c.stage==="worker:"+task.id&&c.status==="success")):[];
    for(let i=0;!options.resumeWorkspace&&i<plan.tasks.length;i++){
      try{await runWorker({s:site,plan,task:plan.tasks[i],root,images,progress,index:i,total:plan.tasks.length,call})}
      catch(error){failed.push({...plan.tasks[i],error:clean(error.message,400)});await progress({phase:"task",title:plan.tasks[i].title+" · integração pendente",detail:clean(error.message,400)})}
    }
    await progress({phase:"integrate",title:"Conectando a experiência",detail:"Composição, estado compartilhado e jornada completa."});
    const request=integratorRequest(site,plan,await manifest(root),await contextFiles(root,45),failed);
    const integrated=parseFiles((await call("integrator",request)).text);
    if(!integrated.some(f=>/^app\/page\.(jsx|js)$/.test(f.path)))throw new Error("Integrador não criou a página principal.");
    await apply(root,integrated,{allowCore:true});
    await installPremiumFoundation(root,plan.designSystem);
    // A missing data folder cannot invalidate an otherwise generated workspace.
    await fs.mkdir(path.join(root,"data"),{recursive:true});
    const buildAndAudit=async()=>{
      const built=options.validateBuild===false?{ok:false,skipped:true}:await build(root);
      if(!built.ok)return {built,quality:{available:false,pass:false,score:null,skippedReason:built.skipped?"Build não executado.":"Build falhou."}};
      await progress({phase:"build",title:"Build concluído",detail:"Validando a interface e a jornada no navegador."});
      const quality=options.visualQa===false?{available:false,pass:false,score:null,skippedReason:"Auditoria desativada."}
        :await runVisualQualityAudit({root,nextBin:built.nextBin,site,plan:qaPlan(plan),generateRequest:req=>call("visual-review",req)});
      return {built,quality};
    };
    let result=await buildAndAudit();
    // One shared repair slot, never a retry for every component.
    if(!result.quality.pass&&!result.built.skipped&&budget.remaining>0&&(!result.built.ok||result.quality.issues?.length)){
      const problem=result.built.ok?JSON.stringify(result.quality):result.built.log;
      await progress({phase:"repair",title:"Refinamento dirigido",detail:"Uma correção consolidada dos problemas observados; sem reiniciar a geração."});
      try{
        const files=parseFiles((await call("repair",repairRequest(site,plan,problem,await manifest(root),await contextFiles(root,45)))).text);
        await apply(root,files,{allowCore:true});
        await installPremiumFoundation(root,plan.designSystem);
        result=await buildAndAudit();
      }catch(error){result.quality={...result.quality,pass:false,repairError:clean(error.message,500)}}
    }
    const quality={...result.quality,status:result.quality.pass?"approved":"review-required",callsUsed:budget.calls.length,callLimit:budget.limit};
    await report({plan,quality,buildOk:result.built.ok,productContract:site.productContract});
    if(!result.built.ok&&!result.built.skipped)throw new Error("Projeto preservado para correção; build reprovado: "+clean(result.built.log,1800));
    await progress({phase:"qa",title:quality.pass?"Experiência aprovada":"Prévia preservada · revisão necessária",detail:quality.pass?"Build, navegador e avaliação de qualidade concluídos.":quality.skippedReason||quality.summary||"Um ou mais critérios ainda não foram aprovados."});
    return {plan:{...qaPlan(plan),tasks:plan.tasks,designExploration:plan.designExploration,visualDirection:plan.visualDirection,productVision:plan.productVision,sharedInterfaces:plan.sharedInterfaces},format:"product-builder-v7",buildOk:result.built.ok,quality};
  } catch(error) {await report({plan,error:clean(error.message,2000),quality:{pass:false,status:"failed"}});throw error}
}

export async function refineAutonomousSiteComponent(options={}) {
  const root=path.resolve(process.cwd(),options.folderPath||'');
  if(!root.startsWith(path.resolve(process.cwd(),'generated-sites')+path.sep))throw new Error('Projeto fora do workspace de geração.');
  const site=options.siteData||{},plan=options.currentPlan||site.codegenPlan||{};
  const name=clean(options.componentName,80),instruction=clean(options.instruction,5000);
  const component=builderComponentManifest(plan).find(item=>item.name===name);
  if(!component||!instruction)throw new Error('Selecione uma seção existente e descreva a alteração.');
  const allowed=new Set(component.targetFiles.filter(safePath));
  const budget=createGenerationBudget(3);
  const call=(stage,request)=>budget.run(stage,request,generate);
  const progress=async event=>{try{await options.onProgress?.(event)}catch{}};
  const metadata=['data/siteData.js','generation-report.json','builder-report.json','app/layout.jsx','app/leadflow-foundation.css','public/leadflow-inspector.js'];
  const exportedNames=source=>[...String(source).matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)|export\s+(default)\b/g)].map(match=>match[1]||match[2]);
  return withFileTransaction([...allowed,...metadata].map(file=>path.join(root,file)),async()=>{
    await progress({phase:'code',title:'Refinando '+name,detail:'Alteração limitada aos arquivos da seção; estado e interfaces preservados.'});
    const context=await contextFiles(root,45);
    const response=await call('component-edit',{
      ...base(site,360000),temperature:.35,maxTokens:10000,
      systemPrompt:'Faça uma alteração incremental em um produto existente. Preserve identidade, dados, funcionalidades, exports, props e estado compartilhado. Não recrie a aplicação. JavaScript/JSX e CSS Modules, sem TS/Tailwind/CSS inline. Retorne somente arquivos completos ALTERADOS em <FILE path="...">...</FILE>. Não altere arquivos fora do escopo fornecido.',
      prompt:'SEÇÃO: '+name+'\nPEDIDO: '+instruction+'\nARQUIVOS EDITÁVEIS: '+JSON.stringify([...allowed])+'\nCONTRATO: '+productContractPrompt(site.productContract)+'\nIDENTIDADE: '+JSON.stringify(plan.visualDirection)+'\nINTERFACES: '+JSON.stringify(plan.sharedInterfaces)+'\nCONTEXTO SOMENTE PARA LEITURA:\n'+context.map(file=>'--- '+file.path+' ---\n'+file.content).join('\n'),
    });
    const files=parseFiles(response.text);
    if(files.some(file=>!allowed.has(file.path)))throw new Error('Refinamento tentou alterar arquivos fora da seção selecionada.');
    for(const file of files){let before='';try{before=await fs.readFile(path.join(root,file.path),'utf8')}catch{}
      if(exportedNames(before).some(name=>!exportedNames(file.content).includes(name)))throw new Error('Refinamento removeu uma interface exportada utilizada pela aplicação.');
    }
    await apply(root,files,{allowCore:true});
    const design=plan.designSystem?.version===1?plan.designSystem:premiumDesignSystem(plan.visualDirection,site);
    await installPremiumFoundation(root,design);
    const built=await build(root);if(!built.ok)throw new Error('Refinamento reprovado no build: '+clean(built.log,2400));
    const quality=await runVisualQualityAudit({root,nextBin:built.nextBin,site,plan:qaPlan(plan),generateRequest:req=>call('visual-review',req)});
    if(quality.hardFailure)throw new Error('Refinamento bloqueado por defeito comprovado: '+clean(quality.metrics?.functional?.summary||quality.summary,1600));
    quality.status=quality.pass?'approved':'review-required';quality.callsUsed=budget.calls.length;
    site.codegenPlan={...plan,...qaPlan(plan),designSystem:design};site.codegenQuality=quality;
    await fs.writeFile(path.join(root,'data/siteData.js'),'export default '+JSON.stringify(site,null,2)+';\n');
    for(const name of ['generation-report.json','builder-report.json']){try{const file=path.join(root,name),report=JSON.parse(await fs.readFile(file,'utf8'));report.codegenQuality=quality;report.quality=quality;report.lastTargetedRefinement={component:component.name,instruction,files:files.map(file=>file.path),at:new Date().toISOString()};await fs.writeFile(file,JSON.stringify(report,null,2))}catch{}}
    return {plan:site.codegenPlan,quality,buildOk:true,componentName:name,atomic:true,editingStrategy:'scoped-product-edit'};
  });
}
