import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateSiteWithDefaultProvider as generateWithDefaultProvider } from "../ai/siteProviderService.js";
import { runVisualQualityAudit } from "./siteVisualQa.js";

const execFileAsync=promisify(execFile);
const clean=(value,max=200000)=>String(value??"").replace(/\u0000/g,"").trim().slice(0,max);

function modelFor(site){return site.siteVariant==="testelead"?"":clean(process.env.LEADFLOW_SITE_MODEL||"",300)}
function safePath(value){
  const p=String(value||"").replace(/\\/g,"/").replace(/^\.\//,"").trim();
  if(!p||p.startsWith("/")||p.includes("..")||! /^[A-Za-z0-9_./@()[\]-]+$/.test(p))return"";
  return p;
}
function parseFiles(text){
  const raw=clean(text,900000).replace(/<think>[\s\S]*?<\/think>/gi,"");
  const files=[];const re=/<FILE\s+path=["']([^"']+)["']\s*>\s*([\s\S]*?)\s*<\/FILE>/gi;let m;
  while((m=re.exec(raw))){const file=safePath(m[1]);if(file)files.push({path:file,content:m[2]})}
  if(!files.length)throw new Error("O agente não retornou arquivos no protocolo <FILE path=...>.");
  return files;
}
function validateFiles(files){
  const errors=[];const seen=new Set();
  for(const file of files){
    if(seen.has(file.path))errors.push("arquivo duplicado: "+file.path);seen.add(file.path);
    if(/\.(tsx|ts)$/.test(file.path))errors.push("TypeScript proibido: "+file.path);
    if(/\.css$/.test(file.path)&&/@tailwind|@apply\b/.test(file.content))errors.push("Tailwind proibido: "+file.path);
    if(/\.(jsx|js)$/.test(file.path)&&/\sstyle\s*=\s*\{/.test(file.content))errors.push("CSS inline proibido: "+file.path);
  }
  if(!files.some(f=>f.path==="app/page.jsx"||f.path==="app/page.js"))errors.push("app/page.jsx ausente");
  if(!files.some(f=>f.path==="app/layout.jsx"||f.path==="app/layout.js"))errors.push("app/layout.jsx ausente");
  return errors;
}
function packageJson(folderName,files){
  const supplied=files.find(f=>f.path==="package.json");
  let pkg={};try{pkg=supplied?JSON.parse(supplied.content):{}}catch{}
  pkg.name=String(folderName||"leadflow-site").toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,80)||"leadflow-site";
  pkg.version="1.0.0";pkg.private=true;
  pkg.scripts={...(pkg.scripts||{}),dev:"next dev",build:"next build",start:"next start"};
  const deps={...(pkg.dependencies||{})};
  delete deps.tailwindcss;delete deps.typescript;delete deps["@types/react"];delete deps["@types/node"];
  pkg.dependencies={...deps,next:"latest",react:"latest","react-dom":"latest"};
  delete pkg.devDependencies;
  return JSON.stringify(pkg,null,2);
}
async function writeFiles(root,folderName,files){
  for(const name of ["app","components","data","lib"])await fs.rm(path.join(root,name),{recursive:true,force:true});
  for(const file of files){
    if(file.path==="package.json")continue;
    const target=path.join(root,file.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,file.content,"utf8");
  }
  await fs.writeFile(path.join(root,"package.json"),packageJson(folderName,files),"utf8");
  await fs.writeFile(path.join(root,"generation-format.json"),JSON.stringify({format:"autonomous-builder-v5",generatedAt:new Date().toISOString()},null,2),"utf8");
  await fs.writeFile(path.join(root,".gitignore"),"node_modules\n.next\n.leadflow-build\n.env*\n","utf8");
}
async function nextBin(root){try{const p=path.join(root,"node_modules","next","dist","bin","next");await fs.access(p);return p}catch{return path.join(process.cwd(),"node_modules","next","dist","bin","next")}}
async function build(root){
  const bin=await nextBin(root);await fs.rm(path.join(root,".leadflow-build"),{recursive:true,force:true});
  try{const r=await execFileAsync(process.execPath,[bin,"build"],{cwd:root,timeout:180000,maxBuffer:4*1024*1024,env:{...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",LEADFLOW_BUILD_DIST_DIR:".leadflow-build"}});return{ok:true,log:(r.stdout||"")+"\n"+(r.stderr||""),nextBin:bin}}
  catch(e){return{ok:false,log:clean((e.stdout||"")+"\n"+(e.stderr||"")+"\n"+e.message,70000),nextBin:bin}}
}
async function snapshot(root,maxFiles=45){
  const out=[];async function walk(dir,rel=""){for(const ent of await fs.readdir(dir,{withFileTypes:true})){if(["node_modules",".next",".leadflow-build","public"].includes(ent.name))continue;const r=rel?rel+"/"+ent.name:ent.name,p=path.join(dir,ent.name);if(ent.isDirectory())await walk(p,r);else if(/\.(jsx|js|css|json|mjs)$/.test(ent.name)&&out.length<maxFiles)out.push({path:r,content:clean(await fs.readFile(p,"utf8"),14000)})}}await walk(root);return out;
}
function autonomousPrompt(site,instruction,visualImages){
  const facts={name:site.brandName,segment:site.segment,city:site.city,address:site.address,phone:site.phone,whatsapp:site.whatsapp,instagram:site.instagram,mapsLink:site.mapsLink,rating:site.rating,reviews:site.reviews,hours:site.hours,images:site.images,description:site.description,audience:site.audience,pageJob:site.pageJob};
  return{
    model:modelFor(site),siteRole:"builder",siteVariant:site.siteVariant||"leadflow",temperature:.78,maxTokens:Number(process.env.LEADFLOW_SITE_BUILDER_MAX_TOKENS||30000),timeoutMs:Number(process.env.LEADFLOW_SITE_TIMEOUT_BUILDER_MS||240000),retries:0,images:visualImages,
    systemPrompt:[
      "Você é um agente autônomo de produto, design e engenharia web. Você controla o projeto inteiro.",
      "Sua missão é criar a melhor prévia comercial possível para o negócio. NÃO existe blueprint, lista de seções, número de páginas, arquitetura, design system ou conjunto de componentes pré-definido.",
      "VOCÊ decide livremente o produto: arquitetura, páginas, rotas, componentes, conteúdo demonstrativo, produtos, preços, avaliações, promoções, interações, carrinho, checkout demonstrativo, dados mock, APIs internas e experiência visual quando fizer sentido.",
      "Não transforme o pedido em uma landing institucional por hábito. Decida o que um excelente produto digital para este negócio deveria ser.",
      "Dados fornecidos são contexto real. Como é uma PRÉVIA COMERCIAL, você pode inventar conteúdo demonstrativo coerente para materializar a experiência; não apresente invenções como dados oficialmente confirmados do cliente.",
      "Analise as imagens fornecidas e use-as quando ajudarem. Você também pode construir a experiência sem depender de dados ausentes.",
      "ÚNICAS AMARRAS DE IMPLEMENTAÇÃO: Next.js latest App Router + React; JavaScript/JSX; CSS Modules; sem TypeScript; sem Tailwind; sem CSS inline/style={{}}. Componentes React reutilizáveis devem ficar em components/Nome/Nome.jsx com seu Nome.module.css. Você pode criar quantos componentes, páginas, rotas, dados e utilidades quiser.",
      "Pode adicionar dependências npm úteis, desde que não substituam a stack nem introduzam Tailwind/TypeScript/CSS-in-JS.",
      "Responsividade, acessibilidade, navegação funcional e acabamento visual são obrigatórios. Faça o projeto parecer um produto feito sob medida, não um template.",
      "Não explique seu raciocínio. Entregue os arquivos completos necessários.",
      "PROTOCOLO DE SAÍDA: para CADA arquivo escreva exatamente <FILE path=\"caminho\">conteúdo completo</FILE>. Sem markdown fences. Você escolhe livremente os arquivos."
    ].join(" "),
    prompt:[
      "Crie o projeto agora. Tome todas as decisões de produto e design por conta própria.",
      instruction?"PEDIDO DO USUÁRIO: "+clean(instruction,7000):"",
      "CONTEXTO DO NEGÓCIO: "+JSON.stringify(facts),
      "ASSETS LOCAIS DISPONÍVEIS: "+JSON.stringify(site.images||[]),
      "Se criar dados demo, faça-os convincentes e coerentes com o negócio. O objetivo é uma prévia que venda a visão do site ao lead."
    ].filter(Boolean).join("\n\n")
  };
}
function repairPrompt(site,files,problem,kind){
  return{
    model:modelFor(site),siteRole:"builder",siteVariant:site.siteVariant||"leadflow",temperature:.35,maxTokens:18000,timeoutMs:Number(process.env.LEADFLOW_SITE_TIMEOUT_BUILDER_MS||240000),retries:0,
    systemPrompt:"Você é o mesmo agente autônomo responsável pelo projeto. Corrija o problema observado sem reduzir a ambição do produto. Você pode alterar QUALQUER arquivo do projeto e criar novos arquivos. Mantenha Next.js App Router, JavaScript/JSX e CSS Modules; sem TypeScript, Tailwind ou CSS inline. Retorne SOMENTE os arquivos que precisam ser criados/substituídos usando <FILE path=\"caminho\">conteúdo completo</FILE>.",
    prompt:"OBSERVAÇÃO REAL ("+kind+"):\n"+clean(problem,9000)+"\n\nPROJETO ATUAL:\n"+files.map(f=>"--- "+f.path+" ---\n"+f.content).join("\n\n")
  };
}
async function applyChanges(root,files){
  const errors=validateFiles(files).filter(e=>!e.includes("app/page")&&!e.includes("app/layout"));
  if(errors.length)throw new Error("Alteração do agente violou contrato técnico: "+errors.join(" | "));
  for(const file of files){if(file.path==="package.json")continue;const target=path.join(root,file.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,file.content,"utf8")}
}
function qaPlan(site){return{concept:"autonomous",components:[],creativeThesis:"Arquitetura decidida integralmente pelo agente.",conversionStrategy:"Definida pelo agente.",visualSystem:"Definido pelo agente.",imageStrategy:"Definida pelo agente.",responsiveStrategy:"Definida pelo agente.",designSystem:{}}}

export async function generateAutonomousSite(options={}){
  const progress=async event=>{try{await options.onProgress?.(event)}catch{}};
  const site=options.siteData||{},root=path.resolve(process.cwd(),options.folderPath),images=(options.visualImages||[]).filter(x=>x?.dataUrl).slice(0,6);
  await progress({phase:"agent",title:"Agente autônomo assumiu o workspace",detail:"Sem blueprint, templates ou arquitetura pré-definida. O modelo decidirá o produto inteiro.",kind:"agent"});
  const req=autonomousPrompt(site,options.instruction||"",images);
  req.onAttempt=e=>progress({phase:"ai",title:e.status==="success"?"Agente concluiu uma etapa":e.status==="error"?"Agente encontrou erro":"Agente projetando e codificando",detail:[e.model,e.elapsedMs?Math.round(e.elapsedMs/1000)+"s":"",e.error||""].filter(Boolean).join(" · "),kind:"model"});
  const result=await generateWithDefaultProvider(req);
  let files=parseFiles(result.text);const errors=validateFiles(files);if(errors.length)throw new Error("Projeto autônomo violou o contrato técnico: "+errors.join(" | "));
  for(const file of files)await progress({phase:"files",title:"Created "+file.path,detail:"Arquivo decidido e escrito pelo agente.",kind:"file",file:file.path,code:clean(file.content,1800)});
  await writeFiles(root,options.folderName,files);
  let built=await build(root);
  for(let attempt=1;!built.ok&&attempt<=2;attempt++){
    await progress({phase:"build",title:"Build falhou · agente corrigindo",detail:clean(built.log,1800),kind:"command"});
    const current=await snapshot(root);const fix=await generateWithDefaultProvider(repairPrompt(site,current,built.log,"build"));const changed=parseFiles(fix.text);
    await applyChanges(root,changed);for(const file of changed)await progress({phase:"files",title:"Updated "+file.path,detail:"Correção autônoma após observar o build.",kind:"file",file:file.path});
    built=await build(root);
  }
  if(!built.ok)throw new Error("O agente não conseguiu deixar o projeto compilável: "+clean(built.log,3500));
  await progress({phase:"build",title:"✓ Build concluído",detail:"O projeto autônomo compilou com sucesso.",kind:"command"});
  let quality={available:false,pass:true,score:null,threshold:Number(process.env.LEADFLOW_SITE_QUALITY_MIN_SCORE||78),skippedReason:"QA visual não executado."};
  if(options.visualQa!==false){
    await progress({phase:"qa",title:"Abrindo resultado real no Chromium",detail:"O agente receberá feedback do site renderizado.",kind:"browser"});
    quality=await runVisualQualityAudit({root,nextBin:built.nextBin,site,plan:qaPlan(site)});
    for(let cycle=1;quality.available&&!quality.pass&&cycle<=2;cycle++){
      const issueText=[quality.summary,...(quality.issues||[]).map(i=>"["+i.severity+"] "+i.component+": "+i.instruction+(i.evidence?" — "+i.evidence:""))].filter(Boolean).join("\n");
      await progress({phase:"repair",title:"Agente observou o render e está corrigindo",detail:"QA "+quality.score+"/100. O próprio agente pode alterar qualquer parte do projeto.",kind:"browser"});
      const current=await snapshot(root);const fix=await generateWithDefaultProvider(repairPrompt(site,current,issueText,"auditoria visual"));const changed=parseFiles(fix.text);
      await applyChanges(root,changed);built=await build(root);if(!built.ok)continue;
      quality=await runVisualQualityAudit({root,nextBin:built.nextBin,site,plan:qaPlan(site)});
    }
  }
  await fs.rm(path.join(root,".leadflow-build"),{recursive:true,force:true});
  if(quality.available&&!quality.pass)throw new Error("O agente não atingiu o mínimo visual após ciclos autônomos: "+quality.score+"/"+quality.threshold+".");
  return{plan:qaPlan(site),format:"autonomous-builder-v5",buildOk:true,quality};
}
