import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateSiteWithDefaultProvider as generate } from "../ai/siteProviderService.js";
import { runVisualQualityAudit } from "./siteVisualQa.js";

const execFileAsync=promisify(execFile);
const clean=(v,n=200000)=>String(v??"").replace(/\u0000/g,"").trim().slice(0,n);
const modelFor=s=>s.siteVariant==="testelead"?"":clean(process.env.LEADFLOW_SITE_MODEL||"",300);
function safePath(v){const p=String(v||"").replace(/\\/g,"/").replace(/^\.\//,"").trim();return !p||p.startsWith("/")||p.includes("..")||!/^[-A-Za-z0-9_./@()[\]]+$/.test(p)?"":p}
function parseJson(text){const raw=clean(text,120000).replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/,"").trim();const a=raw.indexOf("{"),b=raw.lastIndexOf("}");if(a<0||b<a)throw new Error("Planner não retornou JSON.");return JSON.parse(raw.slice(a,b+1))}
function parseFiles(text){const raw=clean(text,300000).replace(/<think>[\s\S]*?<\/think>/gi,""),files=[];const re=/<FILE\s+path=["']([^"']+)["']\s*>\s*([\s\S]*?)\s*<\/FILE>/gi;let m;while((m=re.exec(raw))){const p=safePath(m[1]);if(p)files.push({path:p,content:m[2]})}if(!files.length)throw new Error("Worker não retornou arquivos.");return files}
function sanitizeGeneratedFiles(files){
  return files.map(file=>{
    let content=file.content;
    if(/\.css$/i.test(file.path)){
      content=content
        .replace(/\r/g,"")
        .replace(/^\s*(background|color|padding|margin|display|width|height|border|font-size|font-weight|line-height|gap|position|top|right|bottom|left|opacity|transform|transition)\s*$/gmi,"")
        .replace(/(^|\n)(\s*)([a-z-]+)\s*\n(\s*})/gi,"$1$2$4")
        .replace(/\n{3,}/g,"\n\n");
    }
    return {...file,content};
  });
}
function violations(files){const e=[];for(const f of files){if(/\.(ts|tsx)$/.test(f.path))e.push("TypeScript: "+f.path);if(/\.css$/.test(f.path)&&/@tailwind|@apply\b/.test(f.content))e.push("Tailwind: "+f.path);if(/\.(jsx|js)$/.test(f.path)&&/\sstyle\s*=\s*\{/.test(f.content))e.push("CSS inline: "+f.path)}return e}
async function apply(root,files){files=sanitizeGeneratedFiles(files);const e=violations(files);if(e.length){const err=new Error("Contrato técnico violado: "+e.join(" | "));err.code="TECH_CONTRACT";err.violations=e;throw err}for(const f of files){if(f.path==="package.json")continue;const target=path.join(root,f.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,f.content,"utf8")}}
async function manifest(root){const out=[];async function walk(dir,rel=""){let ents=[];try{ents=await fs.readdir(dir,{withFileTypes:true})}catch{return}for(const x of ents){if(["node_modules",".next",".leadflow-build","public"].includes(x.name))continue;const r=rel?rel+"/"+x.name: x.name,p=path.join(dir,x.name);if(x.isDirectory())await walk(p,r);else if(/\.(jsx|js|css|json|mjs)$/.test(x.name))out.push(r)}}await walk(root);return out.slice(0,120)}
async function contextFiles(root,n=12){const names=await manifest(root),preferred=names.filter(x=>/^(app|components|data|lib)\//.test(x)).slice(-n),out=[];for(const name of preferred){try{out.push({path:name,content:clean(await fs.readFile(path.join(root,name),"utf8"),5000)})}catch{}}return out}
async function setup(root,name){for(const x of ["app","components","data","lib"])await fs.rm(path.join(root,x),{recursive:true,force:true});
  await fs.mkdir(path.join(root,"app"),{recursive:true});
  await fs.writeFile(path.join(root,"app","layout.jsx"),'import "./globals.css";\n\nexport const metadata = { title: "Site em construção" };\n\nexport default function RootLayout({ children }) { return <html lang="pt-BR"><body>{children}</body></html>; }\n',"utf8");
  await fs.writeFile(path.join(root,"app","globals.css"),':root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;padding:0}body{min-height:100vh}a{color:inherit;text-decoration:none}img{max-width:100%;height:auto}\n',"utf8");
  const pkg={name:String(name||"leadflow-site").toLowerCase().replace(/[^a-z0-9-]/g,"-")||"leadflow-site",version:"1.0.0",private:true,scripts:{dev:"next dev",build:"next build",start:"next start"},dependencies:{next:"latest",react:"latest","react-dom":"latest"}};await fs.writeFile(path.join(root,"package.json"),JSON.stringify(pkg,null,2));await fs.writeFile(path.join(root,"generation-format.json"),JSON.stringify({format:"autonomous-builder-v5-task-loop",generatedAt:new Date().toISOString()},null,2))}
async function nextBin(root){try{const p=path.join(root,"node_modules","next","dist","bin","next");await fs.access(p);return p}catch{return path.join(process.cwd(),"node_modules","next","dist","bin","next")}}
async function sanitizeWorkspaceCss(root){const names=(await manifest(root)).filter(x=>/\.css$/i.test(x));for(const name of names){try{const target=path.join(root,name),raw=await fs.readFile(target,"utf8"),fixed=sanitizeGeneratedFiles([{path:name,content:raw}])[0].content;if(fixed!==raw)await fs.writeFile(target,fixed,"utf8")}catch{}}}
async function build(root){await sanitizeWorkspaceCss(root);const bin=await nextBin(root);
  try{await fs.access(path.join(root,"app","layout.jsx"))}catch{await fs.mkdir(path.join(root,"app"),{recursive:true});await fs.writeFile(path.join(root,"app","layout.jsx"),'import "./globals.css";\nexport default function RootLayout({ children }) { return <html lang="pt-BR"><body>{children}</body></html>; }\n',"utf8")}
  try{await fs.access(path.join(root,"app","globals.css"))}catch{await fs.writeFile(path.join(root,"app","globals.css"),"*{box-sizing:border-box}html,body{margin:0}\n","utf8")}
  await fs.rm(path.join(root,".leadflow-build"),{recursive:true,force:true});try{const r=await execFileAsync(process.execPath,[bin,"build"],{cwd:root,timeout:180000,maxBuffer:4e6,env:{...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",LEADFLOW_BUILD_DIST_DIR:".leadflow-build"}});return{ok:true,log:clean((r.stdout||"")+"\n"+(r.stderr||""),30000),nextBin:bin}}catch(e){return{ok:false,log:clean((e.stdout||"")+"\n"+(e.stderr||"")+"\n"+e.message,30000),nextBin:bin}}}
function facts(s){return{name:s.brandName,segment:s.segment,city:s.city,address:s.address,phone:s.phone,whatsapp:s.whatsapp,instagram:s.instagram,mapsLink:s.mapsLink,rating:s.rating,reviews:s.reviews,hours:s.hours,images:s.images,description:s.sourceDescription||s.description,audience:s.audience,pageJob:s.pageJob,skills:s.skills||[]}}
function base(s){return{model:modelFor(s),siteVariant:s.siteVariant||"leadflow",siteRole:"builder",timeoutMs:Number(process.env.LEADFLOW_SITE_TASK_TIMEOUT_MS||90000),retries:0}}
function plannerRequest(s,instruction,images){return{...base(s),temperature:.75,maxTokens:5000,images,systemPrompt:"Você é o diretor autônomo do projeto. Decida livremente o melhor produto digital para este negócio. Não existe blueprint nem lista de seções obrigatória. Sua única função agora é decompor SUA própria solução em tarefas pequenas e independentes para workers. Não escreva código. Responda somente JSON válido.",prompt:`CONTEXTO: ${JSON.stringify(facts(s))}\nPEDIDO: ${clean(instruction,5000)}\n\nCrie um plano autoral. JSON: {"concept":"...","productVision":"...","visualDirection":"...","tasks":[{"id":"...","title":"...","goal":"...","dependsOn":[]}]} . Você decide quantidade, páginas, funcionalidades e tarefas. Prefira tarefas que caibam em uma única chamada; máximo 18 tarefas.`}}
function normalizePlan(raw){const tasks=(Array.isArray(raw.tasks)?raw.tasks:[]).slice(0,18).map((t,i)=>({id:clean(t.id,50)||"task-"+(i+1),title:clean(t.title,120)||"Tarefa "+(i+1),goal:clean(t.goal,2500),dependsOn:Array.isArray(t.dependsOn)?t.dependsOn.map(x=>clean(x,50)).filter(Boolean):[]}));if(!tasks.length)throw new Error("Planner não criou tarefas.");return{concept:clean(raw.concept,1000),productVision:clean(raw.productVision,2500),visualDirection:clean(raw.visualDirection,2500),tasks}}
function workerRequest(s,plan,task,tree,ctx,images){return{...base(s),temperature:.68,maxTokens:Number(process.env.LEADFLOW_SITE_TASK_MAX_TOKENS||4500),images,systemPrompt:"Você é um worker autônomo dentro de um projeto web. Execute SOMENTE a tarefa atual e pare. O diretor já escolheu a visão, mas você tem liberdade total para resolver esta tarefa. Pode criar ou substituir qualquer arquivo necessário para a tarefa. Next.js App Router + React, somente JavaScript/JSX e CSS Modules; sem TypeScript, Tailwind ou CSS inline. Componentes reutilizáveis: components/Nome/Nome.jsx + Nome.module.css. Retorne somente arquivos completos no protocolo <FILE path=\"...\">conteúdo</FILE>, sem markdown.",prompt:`VISÃO: ${plan.productVision}\nCONCEITO: ${plan.concept}\nDIREÇÃO VISUAL: ${plan.visualDirection}\nNEGÓCIO: ${JSON.stringify(facts(s))}\nTAREFA ATUAL: ${task.title}\nOBJETIVO: ${task.goal}\nARQUIVOS EXISTENTES: ${JSON.stringify(tree)}\nCONTEXTO RECENTE:\n${ctx.map(f=>"--- "+f.path+" ---\n"+f.content).join("\n")}\n\nExecute somente esta tarefa. Preserve e integre o que já existe.`}}
function repairRequest(s,plan,problem,tree,ctx){return{...base(s),temperature:.3,maxTokens:7000,systemPrompt:"Você é o engenheiro de correção do mesmo projeto. Corrija apenas os problemas observados, podendo alterar qualquer arquivo necessário. Preserve a visão autoral. Next.js + JSX + CSS Modules; sem TS/Tailwind/CSS inline. Retorne apenas arquivos completos <FILE path=\"...\">...</FILE>.",prompt:`VISÃO: ${plan.productVision}\nPROBLEMA REAL:\n${clean(problem,10000)}\nARQUIVOS: ${JSON.stringify(tree)}\n${ctx.map(f=>"--- "+f.path+" ---\n"+f.content).join("\n")}`}}
function qaPlan(plan){return{concept:plan.concept||"autonomous",components:[],creativeThesis:plan.productVision||"",visualSystem:plan.visualDirection||"",conversionStrategy:"Definida autonomamente",imageStrategy:"Definida autonomamente",responsiveStrategy:"Definida autonomamente",designSystem:{}}}

export async function generateAutonomousSite(options={}){
 const progress=async e=>{try{await options.onProgress?.(e)}catch{}},s=options.siteData||{},root=path.resolve(process.cwd(),options.folderPath),images=(options.visualImages||[]).filter(x=>x?.dataUrl).slice(0,4);
 await setup(root,options.folderName);
 await progress({phase:"plan",title:"Diretor autônomo planejando",detail:"Uma chamada curta decide livremente o produto e decompõe a própria solução em tarefas.",kind:"agent"});
 const pr=plannerRequest(s,options.instruction||"",images);pr.onAttempt=e=>progress({phase:"ai",title:"Planner · "+e.status,detail:[e.model,e.elapsedMs&&Math.round(e.elapsedMs/1000)+"s"].filter(Boolean).join(" · "),kind:"model"});
 let plan;
 try{plan=normalizePlan(parseJson((await generate(pr)).text))}
 catch(error){
   await progress({phase:"plan",title:"Planner principal indisponível · usando plano livre de contingência",detail:clean(error?.message||error,700),kind:"agent"});
   plan={concept:"Autonomia por workers",productVision:"Construir uma experiência comercial autoral completa a partir do contexto do negócio, deixando cada worker tomar decisões locais sem template.",visualDirection:"Definida progressivamente pelos workers a partir dos assets reais.",tasks:[
     {id:"foundation",title:"Criar fundação visual e página principal",goal:"Criar app/page.jsx e a fundação visual necessária, decidindo livremente a primeira composição do produto.",dependsOn:[]},
     {id:"experience",title:"Expandir a experiência principal",goal:"Analisar o projeto existente e criar os componentes, conteúdo e interações que mais aumentem a qualidade e conversão.",dependsOn:["foundation"]},
     {id:"polish",title:"Revisar e elevar o acabamento",goal:"Revisar tudo que existe, completar lacunas importantes, melhorar responsividade, coerência visual e conversão.",dependsOn:["experience"]}
   ]};
 }
 await progress({phase:"plan",title:"Plano autoral criado",detail:plan.tasks.length+" tarefas decididas pelo modelo: "+plan.tasks.map(x=>x.title).join(" → "),kind:"agent"});
 for(let i=0;i<plan.tasks.length;i++){
   const task=plan.tasks[i],tree=await manifest(root),ctx=await contextFiles(root);
   await progress({phase:"task",title:(i+1)+"/"+plan.tasks.length+" · "+task.title,detail:task.goal,kind:"agent"});
   const req=workerRequest(s,plan,task,tree,ctx,i<2?images:[]);req.onAttempt=e=>progress({phase:"ai",title:task.title+" · "+e.status,detail:[e.model,e.elapsedMs&&Math.round(e.elapsedMs/1000)+"s"].filter(Boolean).join(" · "),kind:"model"});
   let files;
   try{files=parseFiles((await generate(req)).text)}
   catch(error){
     await progress({phase:"task",title:task.title+" · worker indisponível",detail:clean(error?.message||error,700)+" · tarefa preservada para recuperação posterior; seguindo o plano.",kind:"agent"});
     continue;
   }
   try{await apply(root,files)}catch(error){
     if(error?.code!=="TECH_CONTRACT")throw error;
     await progress({phase:"repair",title:task.title+" · autocorreção técnica",detail:error.message,kind:"agent"});
     const correction={...base(s),temperature:.2,maxTokens:Number(process.env.LEADFLOW_SITE_TASK_MAX_TOKENS||4500),systemPrompt:"Corrija somente as violações técnicas apontadas, preservando design, conteúdo e funcionalidade. Next.js App Router + JavaScript/JSX + CSS Modules. Sem TypeScript, Tailwind ou CSS inline/style={{}}. Mova qualquer style inline para o CSS Module e use className. Retorne todos os arquivos corrigidos desta tarefa no protocolo <FILE path=\\\"...\\\">...</FILE>.",prompt:"VIOLAÇÕES:\\n"+error.violations.join("\\n")+"\\n\\nARQUIVOS GERADOS:\\n"+files.map(f=>"--- "+f.path+" ---\\n"+f.content).join("\\n\\n")};
     files=parseFiles((await generate(correction)).text);await apply(root,files);
   }
   for(const f of files)await progress({phase:"files",title:"Created/Updated "+f.path,detail:"Tarefa concluída: "+task.title,kind:"file",file:f.path,code:clean(f.content,1400)});
 }
 let built=await build(root);
 for(let i=0;!built.ok&&i<2;i++){await progress({phase:"build",title:"Build falhou · corretor acionado",detail:clean(built.log,1600),kind:"command"});const tree=await manifest(root),ctx=await contextFiles(root,20);let files;try{files=parseFiles((await generate(repairRequest(s,plan,built.log,tree,ctx))).text)}catch(error){await progress({phase:"build",title:"Corretor IA indisponível",detail:clean(error?.message||error,700),kind:"agent"});break}await apply(root,files);built=await build(root)}
 if(!built.ok){
   const cssMatch=built.log.match(/([A-Za-z]:\\[^\n\r]+?\.css|(?:\.\/)?[A-Za-z0-9_./@()[\]-]+\.css):?(\d+)?/i);
   if(cssMatch)await progress({phase:"build",title:"CSS gerado continua inválido",detail:"Arquivo: "+cssMatch[1]+(cssMatch[2]?" · linha "+cssMatch[2]:"")+" · o erro foi preservado para diagnóstico.",kind:"command"});
   throw new Error("Build não estabilizou: "+clean(built.log,3500));
 }
 await progress({phase:"build",title:"✓ Build concluído",detail:"Todas as tarefas foram integradas e o projeto compilou.",kind:"command"});
 let quality={available:false,pass:true,score:null,threshold:Number(process.env.LEADFLOW_SITE_QUALITY_MIN_SCORE||78)};
 if(options.visualQa!==false){quality=await runVisualQualityAudit({root,nextBin:built.nextBin,site:s,plan:qaPlan(plan)});for(let i=0;quality.available&&!quality.pass&&i<2;i++){const issues=[quality.summary,...(quality.issues||[]).map(x=>"["+x.severity+"] "+x.component+": "+x.instruction)].join("\n");await progress({phase:"repair",title:"Diretor visual pediu correções",detail:"QA "+quality.score+"/"+quality.threshold+". Nova tarefa corretiva curta.",kind:"browser"});const files=parseFiles((await generate(repairRequest(s,plan,issues,await manifest(root),await contextFiles(root,20)))).text);await apply(root,files);built=await build(root);if(!built.ok)continue;quality=await runVisualQualityAudit({root,nextBin:built.nextBin,site:s,plan:qaPlan(plan)})}}
 await fs.rm(path.join(root,".leadflow-build"),{recursive:true,force:true});
 if(quality.available&&!quality.pass)throw new Error("QA visual abaixo do mínimo após correções: "+quality.score+"/"+quality.threshold);
 return{plan:{...qaPlan(plan),tasks:plan.tasks,productVision:plan.productVision},format:"autonomous-builder-v5-task-loop",buildOk:true,quality};
}
