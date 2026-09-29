import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { generateWithDefaultProvider } from "../ai/providerService.js";

const require=createRequire(import.meta.url);
const START_TIMEOUT_MS=45000;

function clean(value,max=12000){return String(value??"").replace(/\u0000/g,"").trim().slice(0,max)}
function clamp(value,min=0,max=10){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):0}
function visualReviewModels(){
  return [...new Set([
    process.env.LEADFLOW_SITE_MODEL_VISUAL_REVIEW,
    process.env.LEADFLOW_SITE_MODEL_ARCHITECT,
    process.env.LEADFLOW_SITE_MODEL_CREATIVE,
    process.env.LEADFLOW_SITE_MODEL_REVIEW,
    "",
  ].map(value=>clean(value,300)).filter((value,index)=>value||index===4))];
}
function parseJudgeJson(text){
  let raw=clean(text,60000).replace(/^\uFEFF/,"").replace(/<think>[\s\S]*?<\/think>/gi,"").trim();
  const fence=raw.match(/(?:```|~~~)(?:json)?\s*([\s\S]*?)\s*(?:```|~~~)/i);
  if(fence)raw=fence[1].trim();
  const start=raw.indexOf("{"),end=raw.lastIndexOf("}");
  if(start>=0&&end>start)raw=raw.slice(start,end+1);
  return JSON.parse(raw);
}
async function loadChromium(){
  let first=null,second=null;
  try{
    const mod=await import("playwright");
    const chromium=mod?.chromium||mod?.default?.chromium||mod?.default?.default?.chromium;
    if(chromium?.launch)return chromium;
  }catch(error){first=error}
  try{
    const mod=require("playwright");
    const chromium=mod?.chromium||mod?.default?.chromium||mod?.default?.default?.chromium;
    if(chromium?.launch)return chromium;
  }catch(error){second=error}
  const missing=[first,second].some(error=>String(error?.code||"")==="ERR_MODULE_NOT_FOUND"||String(error?.code||"")==="MODULE_NOT_FOUND");
  const error=new Error(missing?"PLAYWRIGHT_PACKAGE_MISSING":"PLAYWRIGHT_LOAD_FAILED");
  error.cause=first||second;
  throw error;
}
function portAvailable(port){return new Promise(resolve=>{const server=net.createServer();server.unref();server.once("error",()=>resolve(false));server.listen({host:"127.0.0.1",port},()=>server.close(()=>resolve(true)))})}
async function choosePort(){
  for(let port=4920;port<5020;port++)if(await portAvailable(port))return port;
  throw new Error("Não foi encontrada porta livre para a auditoria visual.");
}
async function waitForServer(url,child,logs){
  const deadline=Date.now()+START_TIMEOUT_MS;
  while(Date.now()<deadline){
    if(child.exitCode!=null)throw new Error("Servidor de auditoria encerrou antes de iniciar. "+logs().slice(-1200));
    try{const response=await fetch(url,{cache:"no-store"});if(response.status<500)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error("Servidor de auditoria visual não iniciou no prazo. "+logs().slice(-1200));
}
function dataUrl(buffer){return "data:image/jpeg;base64,"+buffer.toString("base64")}
function mergeUnique(values){return [...new Set((values||[]).filter(Boolean))]}
async function capture(browser,url,config){
  const context=await browser.newContext({viewport:config.viewport,isMobile:Boolean(config.mobile),hasTouch:Boolean(config.mobile),deviceScaleFactor:1});
  const page=await context.newPage(),runtimeErrors=[];
  page.on("pageerror",error=>runtimeErrors.push(clean(error?.message,500)));
  page.on("console",message=>{if(message.type()==="error")runtimeErrors.push(clean(message.text(),500))});
  try{
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForTimeout(1200);
    const metrics=await page.evaluate(()=>{
      const viewport=window.innerWidth;
      const markerFor=element=>element?.closest?.("[data-leadflow-component]")?.getAttribute("data-leadflow-component")||"";
      const visible=element=>{
        const style=getComputedStyle(element),rect=element.getBoundingClientRect();
        return style.display!=="none"&&style.visibility!=="hidden"&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0;
      };
      const overflowComponents=[],smallTapTargetComponents=[],tinyTextComponents=[],brokenImageComponents=[],missingAltComponents=[],unnamedInteractiveComponents=[];
      for(const element of document.body.querySelectorAll("*")){
        if(!visible(element))continue;
        const rect=element.getBoundingClientRect();
        if(rect.width>viewport+6||rect.left<-6||rect.right>viewport+6){
          const marker=markerFor(element);if(marker)overflowComponents.push(marker);
        }
      }
      for(const element of document.querySelectorAll("a,button,input,select,textarea")){
        if(!visible(element))continue;
        const rect=element.getBoundingClientRect();
        if(rect.width<32||rect.height<32){const marker=markerFor(element);if(marker)smallTapTargetComponents.push(marker)}
      }
      for(const element of document.querySelectorAll("p,span,a,button,label,small")){
        if(!visible(element)||!String(element.textContent||"").trim())continue;
        const size=parseFloat(getComputedStyle(element).fontSize||"0");
        if(size>0&&size<10.5){const marker=markerFor(element);if(marker)tinyTextComponents.push(marker)}
      }
      for(const image of document.images){
        if(image.complete&&image.naturalWidth===0){const marker=markerFor(image);if(marker)brokenImageComponents.push(marker)}
        if(!image.hasAttribute("alt")){const marker=markerFor(image);if(marker)missingAltComponents.push(marker)}
      }
      for(const element of document.querySelectorAll("a,button")){
        if(!visible(element))continue;
        const label=String(element.getAttribute("aria-label")||element.getAttribute("title")||element.textContent||"").trim();
        const imageAlt=[...element.querySelectorAll("img[alt]")].map(image=>image.getAttribute("alt")||"").join(" ").trim();
        if(!label&&!imageAlt){const marker=markerFor(element);if(marker)unnamedInteractiveComponents.push(marker)}
      }
      const ids=[...document.querySelectorAll("[id]")].map(element=>element.id).filter(Boolean);
      const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
      return {
        viewportWidth:viewport,
        documentWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
        documentHeight:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),
        horizontalOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>viewport+3,
        h1Count:document.querySelectorAll("h1").length,
        imageCount:document.images.length,
        brokenImages:[...document.images].filter(image=>image.complete&&image.naturalWidth===0).length,
        missingAltCount:[...document.images].filter(image=>!image.hasAttribute("alt")).length,
        unnamedInteractiveCount:unnamedInteractiveComponents.length,
        duplicateIdCount:duplicateIds.length,
        duplicateIds:duplicateIds.slice(0,12),
        interactiveCount:document.querySelectorAll("a,button,input,select,textarea").length,
        smallTapTargets:smallTapTargetComponents.length,
        tinyTextCount:tinyTextComponents.length,
        overflowComponents:[...new Set(overflowComponents)].slice(0,12),
        smallTapTargetComponents:[...new Set(smallTapTargetComponents)].slice(0,12),
        tinyTextComponents:[...new Set(tinyTextComponents)].slice(0,12),
        brokenImageComponents:[...new Set(brokenImageComponents)].slice(0,12),
        missingAltComponents:[...new Set(missingAltComponents)].slice(0,12),
        unnamedInteractiveComponents:[...new Set(unnamedInteractiveComponents)].slice(0,12),
      };
    });
    const buffer=await page.screenshot({type:"jpeg",quality:68,fullPage:true});
    return{metrics:{...metrics,runtimeErrors:mergeUnique(runtimeErrors).slice(0,10)},image:dataUrl(buffer)};
  }finally{await context.close()}
}
function mobileMetrics(metrics={}){
  return [metrics.mobile320,metrics.mobile,metrics.mobile390].filter(Boolean);
}
function hasHardFailure(metrics={}){
  const all=[metrics.desktop,...mobileMetrics(metrics)].filter(Boolean);
  return all.some(item=>item.horizontalOverflow||(item.brokenImages||0)>0||(item.runtimeErrors?.length||0)>0);
}
export function calculateVisualQualityScore(dimensions={},metrics={},threshold=78){
  const weights={visualCraft:.15,brandSpecificity:.15,brandFidelity:.15,productIntent:.15,conversion:.1,mobile:.15,coherence:.075,commercialReadiness:.075};
  let score=0;
  for(const[key,weight]of Object.entries(weights))score+=clamp(dimensions[key])*10*weight;
  score=Math.round(score);
  const desktop=metrics.desktop||{},mobiles=mobileMetrics(metrics);
  if(mobiles.some(item=>item.horizontalOverflow))score=Math.min(score,58);
  if(desktop.horizontalOverflow)score=Math.min(score,68);
  if([desktop,...mobiles].some(item=>(item.brokenImages||0)>0))score=Math.min(score,52);
  if([desktop,...mobiles].some(item=>(item.runtimeErrors?.length||0)>0))score=Math.min(score,60);
  if([desktop,...mobiles].some(item=>(item.missingAltCount||0)>0||(item.unnamedInteractiveCount||0)>0))score=Math.min(score,76);
  if([desktop,...mobiles].some(item=>(item.h1Count||0)!==1))score=Math.min(score,84);
  const hardFailure=hasHardFailure(metrics);
  return{score,hardFailure,pass:score>=Number(threshold||78)&&!hardFailure};
}
function objectiveIssues(metrics,known){
  const out=[],desktop=metrics.desktop||{},mobiles=mobileMetrics(metrics);
  const add=(component,severity,instruction,evidence)=>{
    if(!known.has(component)||out.some(item=>item.component===component&&item.instruction===instruction))return;
    out.push({component,severity,instruction,evidence});
  };
  for(const mobile of mobiles){
    if(mobile.horizontalOverflow){
      for(const component of mobile.overflowComponents||[])add(component,"high","Corrija a composição mobile para eliminar qualquer overflow horizontal em 320–390px. Remova larguras mínimas/fixas, offsets ou elementos absolutos que escapem do viewport.","Overflow horizontal detectado em "+mobile.viewportWidth+"px.");
    }
  }
  for(const component of mergeUnique([...(desktop.brokenImageComponents||[]),...mobiles.flatMap(item=>item.brokenImageComponents||[])]))add(component,"high","Corrija a referência/renderização da imagem. A auditoria encontrou imagem quebrada no componente.","Imagem com naturalWidth 0.");
  for(const component of mergeUnique([...(desktop.missingAltComponents||[]),...mobiles.flatMap(item=>item.missingAltComponents||[])]))add(component,"medium","Adicione texto alternativo apropriado à imagem ou alt vazio quando ela for puramente decorativa.","Imagem sem atributo alt.");
  for(const component of mergeUnique([...(desktop.unnamedInteractiveComponents||[]),...mobiles.flatMap(item=>item.unnamedInteractiveComponents||[])]))add(component,"medium","Dê um nome acessível ao link ou botão usando texto visível ou aria-label.","Controle interativo sem nome acessível.");
  const runtime=[desktop,...mobiles].flatMap(item=>item.runtimeErrors||[]);
  if(runtime.length){
    const fallbackComponent=[...known][0];
    if(fallbackComponent)add(fallbackComponent,"high","Corrija o erro de runtime detectado no navegador antes da entrega. Revise hooks, acesso ao browser, dados opcionais e event handlers.","Erro de runtime: "+runtime.slice(0,2).join(" | "));
  }
  if([desktop,...mobiles].some(item=>(item.duplicateIdCount||0)>0)){
    const fallbackComponent=[...known][0];
    if(fallbackComponent)add(fallbackComponent,"medium","Remova IDs HTML duplicados e mantenha âncoras/labels únicas na página.","Foram detectados IDs duplicados no DOM.");
  }
  for(const mobile of mobiles){
    if((mobile.smallTapTargets||0)>4){
      for(const component of (mobile.smallTapTargetComponents||[]).slice(0,3))add(component,"medium","Aumente os alvos de toque essenciais no mobile para pelo menos 40–44px de altura/largura útil sem prejudicar a composição.","Múltiplos alvos de toque pequenos em "+mobile.viewportWidth+"px.");
    }
  }
  return out;
}
async function judgeScreenshots({site,plan,metrics,desktopImage,mobile320Image,mobile390Image}){
  const known=plan.components.map(item=>item.name);
  const baseRequest={
    temperature:.12,
    maxTokens:5000,
    timeoutMs:Number(process.env.LEADFLOW_SITE_TIMEOUT_VISUAL_REVIEW_MS||180000),
    retries:1,
    images:[
      {dataUrl:desktopImage,label:"Render real desktop 1440px"},
      {dataUrl:mobile320Image,label:"Render real mobile 320px"},
      {dataUrl:mobile390Image,label:"Render real mobile 390px"},
    ],
    systemPrompt:[
      "Você é diretor de arte e QA visual de uma agência premium. Julgue APENAS o site realmente renderizado nas imagens, não a intenção do código.",
      "Se parecer template genérico, penalize brandSpecificity e visualCraft. Compare 320px e 390px: se qualquer mobile estiver apertado, cortado, desbalanceado, ilegível ou com hierarquia ruim, penalize mobile.",
      "Um site que apenas compila não é comercialmente pronto. A nota 8+ exige acabamento de agência, identidade própria, hierarquia clara e conversão convincente.",
      "Use somente os fatos fornecidos. Não peça conteúdo inexistente nem invente serviços/depoimentos.",
      "Avalie brandFidelity comparando o render com brandEvidence e imagens reais disponíveis. Penalize reinvenção arbitrária de uma identidade visual claramente observável.",
      "Avalie productIntent contra productContract. Se o contrato for delivery e o render parecer apenas uma landing institucional sem jornada perceptível de pedido, productIntent deve ser no máximo 3.",
      "Cada issue deve apontar um component EXATAMENTE da lista fornecida.",
      "Retorne somente JSON válido."
    ].join(" "),
    prompt:[
      "NEGÓCIO: "+JSON.stringify({brandName:site.brandName,segment:site.segment,city:site.city,audience:site.audience,pageJob:site.pageJob,template:site.template,productContract:site.productContract,brandEvidence:site.brandEvidence}),
      "DIREÇÃO MESTRE: "+JSON.stringify({concept:plan.concept,creativeThesis:plan.creativeThesis,visualSystem:plan.visualSystem,imageStrategy:plan.imageStrategy,responsiveStrategy:plan.responsiveStrategy,conversionStrategy:plan.conversionStrategy,designSystem:plan.designSystem}),
      "COMPONENTES VÁLIDOS: "+JSON.stringify(known),
      "MÉTRICAS DO NAVEGADOR: "+JSON.stringify(metrics),
      "Avalie de 0 a 10: visualCraft, brandSpecificity, brandFidelity, productIntent, conversion, mobile, coherence, commercialReadiness.",
      "FORMATO: "+JSON.stringify({dimensions:{visualCraft:0,brandSpecificity:0,brandFidelity:0,productIntent:0,conversion:0,mobile:0,coherence:0,commercialReadiness:0},summary:"",issues:[{component:known[0]||"LeadHero",severity:"high",instruction:"correção objetiva baseada no render",evidence:"o que foi visto"}]})
    ].join("\n\n")
  };
  let lastError=null;
  for(const model of visualReviewModels()){
    try{
      const result=await generateWithDefaultProvider({...baseRequest,model});
      return parseJudgeJson(result.text);
    }catch(error){lastError=error}
  }
  throw lastError||new Error("Nenhum modelo conseguiu concluir a auditoria visual.");
}
function normalizeJudge(raw,known){
  const dimensions={};
  for(const key of ["visualCraft","brandSpecificity","brandFidelity","productIntent","conversion","mobile","coherence","commercialReadiness"])dimensions[key]=Number(clamp(raw?.dimensions?.[key]).toFixed(1));
  const issues=(Array.isArray(raw?.issues)?raw.issues:[]).map(item=>({
    component:clean(item?.component,80),
    severity:["high","medium","low"].includes(String(item?.severity||"").toLowerCase())?String(item.severity).toLowerCase():"medium",
    instruction:clean(item?.instruction,1600),
    evidence:clean(item?.evidence,1000),
  })).filter(item=>known.has(item.component)&&item.instruction).slice(0,8);
  return{dimensions,summary:clean(raw?.summary,2400),issues};
}
export async function runVisualQualityAudit({root,nextBin,site,plan}={}){
  const threshold=Number(process.env.LEADFLOW_SITE_QUALITY_MIN_SCORE||78);
  let chromium;
  try{chromium=await loadChromium()}catch(error){
    const packageMissing=error?.message==="PLAYWRIGHT_PACKAGE_MISSING";
    return{available:false,pass:true,score:null,threshold,judgeUsed:false,reasonCode:packageMissing?"playwright_package_missing":"playwright_load_failed",skippedReason:packageMissing?"Auditoria visual não executada porque o módulo de renderização não está instalado. Execute npm install e tente novamente.":"Auditoria visual não executada porque o módulo de renderização não pôde ser carregado."};
  }
  let browser=null,child=null,logs="";
  const port=await choosePort(),url="http://127.0.0.1:"+port;
  try{
    try{browser=await chromium.launch({headless:true})}catch(error){
      return{available:false,pass:true,score:null,threshold,judgeUsed:false,reasonCode:"chromium_missing",skippedReason:"Auditoria visual não executada porque o Chromium do Playwright ainda não está disponível. Execute npm run install:browser uma vez nesta máquina."};
    }
    child=spawn(process.execPath,[nextBin,"start","-H","127.0.0.1","-p",String(port)],{
      cwd:root,
      env:{...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",LEADFLOW_BUILD_DIST_DIR:".leadflow-build"},
      stdio:["ignore","pipe","pipe"],windowsHide:true,
    });
    const append=chunk=>{logs=(logs+String(chunk||"")).slice(-12000)};
    child.stdout?.on("data",append);child.stderr?.on("data",append);
    await waitForServer(url,child,()=>logs);
    const desktop=await capture(browser,url,{viewport:{width:1440,height:1000},mobile:false});
    const mobile320=await capture(browser,url,{viewport:{width:320,height:740},mobile:true});
    const mobile390=await capture(browser,url,{viewport:{width:390,height:844},mobile:true});
    const metrics={desktop:desktop.metrics,mobile320:mobile320.metrics,mobile:mobile390.metrics,mobile390:mobile390.metrics};
    const known=new Set(plan.components.map(item=>item.name));
    const hardIssues=objectiveIssues(metrics,known);
    let judged=null,judgeError="";
    try{judged=normalizeJudge(await judgeScreenshots({site,plan,metrics,desktopImage:desktop.image,mobile320Image:mobile320.image,mobile390Image:mobile390.image}),known)}
    catch(error){judgeError=clean(error.message,1200)}
    if(!judged){
      return{available:true,pass:false,hardFailure:true,score:null,threshold,judgeUsed:false,judgeError,summary:"A renderização foi validada por métricas do navegador, mas o modelo de visão não concluiu a crítica visual.",dimensions:{},issues:hardIssues,metrics};
    }
    const scoring=calculateVisualQualityScore(judged.dimensions,metrics,threshold);
    const issues=[...hardIssues,...judged.issues.filter(issue=>!hardIssues.some(hard=>hard.component===issue.component&&hard.instruction===issue.instruction))].slice(0,10);
    if(scoring.score<threshold&&!issues.length){
      const hero=plan.components.find(item=>item.role==="hero")||plan.components[0];
      if(hero)issues.push({component:hero.name,severity:"high",instruction:"Reexecute a tese visual com mais identidade, hierarquia e acabamento. O render final ficou abaixo do padrão comercial premium.",evidence:"Score visual final abaixo do mínimo configurado."});
    }
    return{available:true,pass:scoring.pass,hardFailure:scoring.hardFailure,score:scoring.score,threshold,judgeUsed:true,summary:judged.summary,dimensions:judged.dimensions,issues,metrics};
  }catch(error){
    return{available:false,pass:true,score:null,threshold,judgeUsed:false,reasonCode:"visual_qa_failed",skippedReason:"A auditoria visual renderizada encontrou uma falha de ambiente. Consulte os logs técnicos e tente novamente."};
  }finally{
    try{if(child&&!child.killed)child.kill()}catch{}
    try{await browser?.close()}catch{}
  }
}
