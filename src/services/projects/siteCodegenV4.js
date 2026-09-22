import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateWithDefaultProvider } from "../ai/providerService.js";

const execFileAsync = promisify(execFile);
const MAX_COMPONENTS = 16;
const ALLOWED_ROLES = new Set(["navigation","hero","proof","services","story","showcase","benefits","gallery","faq","location","contact","footer","mobile-cta","custom"]);

function clean(value,max=10000){return String(value??"").replace(/\u0000/g,"").trim().slice(0,max)}
function roleModel(role){
  const env={architect:"LEADFLOW_SITE_MODEL_ARCHITECT",code:"LEADFLOW_SITE_MODEL_CODE",review:"LEADFLOW_SITE_MODEL_REVIEW"};
  return clean(process.env[env[role]]||"",300);
}
function stripReasoningAndFences(value){
  let raw=clean(value,400000).replace(/^\uFEFF/,"").trim();
  raw=raw.replace(/<think>[\s\S]*?<\/think>/gi,"").trim();
  const fullFence=raw.match(/^\s*(?:```|~~~)(?:json|javascript|js)?\s*([\s\S]*?)\s*(?:```|~~~)\s*$/i);
  if(fullFence)raw=fullFence[1].trim();
  else {
    const anyFence=raw.match(/(?:```|~~~)(?:json|javascript|js)?\s*([\s\S]*?)\s*(?:```|~~~)/i);
    if(anyFence)raw=anyFence[1].trim();
  }
  return raw;
}
function jsonCandidates(text){
  const raw=stripReasoningAndFences(text);
  const candidates=[raw];
  const start=raw.indexOf("{"),end=raw.lastIndexOf("}");
  if(start>=0&&end>start)candidates.push(raw.slice(start,end+1));
  return [...new Set(candidates.filter(Boolean))];
}
function relaxJson(raw){
  return String(raw)
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:])\/\/.*$/gm,"$1")
    .replace(/[“”]/g,'"')
    .replace(/[‘’]/g,"'")
    .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)\s*:/g,'$1"$2":')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'(?=\s*[,}])/g,function(_,value){return ': "'+String(value).replace(/"/g,'\\\"')+'"';})
    .replace(/,\s*([}\]])/g,"$1");
}
export function parseCodegenJson(text){
  let lastError=null;
  for(const candidate of jsonCandidates(text)){
    for(const attempt of [candidate,relaxJson(candidate)]){
      try{
        const parsed=JSON.parse(attempt);
        if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))return parsed;
      }catch(error){lastError=error}
    }
  }
  const detail=lastError?.message?": "+lastError.message:"";
  throw new Error("A IA não retornou JSON válido"+detail+".");
}
function parseJson(text){return parseCodegenJson(text)}
async function parseJsonWithRepair(text,role="review"){
  try{return parseCodegenJson(text)}catch(firstError){
    const repair=await generateWithDefaultProvider({
      model:roleModel(role)||roleModel("architect"),
      temperature:0,
      maxTokens:12000,
      systemPrompt:"Você é um reparador de JSON. Retorne SOMENTE JSON estrito RFC 8259, sem markdown, sem comentários, sem explicações e sem texto antes ou depois. Preserve fielmente todos os valores e a estrutura do conteúdo recebido.",
      prompt:"Converta o conteúdo abaixo para JSON estrito válido. Não resuma e não invente campos.\n\n"+clean(text,50000),
    });
    try{return parseCodegenJson(repair.text)}catch(secondError){
      throw new Error("A arquitetura retornou JSON inválido mesmo após reparo automático. Primeira falha: "+firstError.message+" Reparo: "+secondError.message);
    }
  }
}
function pascal(value){
  const parts=clean(value,80).replace(/([a-z])([A-Z])/g,"$1 $2").split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const out=parts.map(function(part){return part.charAt(0).toUpperCase()+part.slice(1)}).join("").replace(/^[0-9]+/,"");
  return /^[A-Z][A-Za-z0-9]*$/.test(out)?out.slice(0,48):"";
}
function normalizeRole(value){const role=clean(value,40).toLowerCase();return ALLOWED_ROLES.has(role)?role:"custom"}
function facts(site){
  return {
    brandName:site.brandName||"",segment:site.segment||"",city:site.city||"",address:site.address||"",
    phone:site.phone||"",whatsapp:site.whatsapp||"",instagram:site.instagram||"",mapsLink:site.mapsLink||"",
    rating:site.rating||"",reviews:site.reviews||"",hours:Array.isArray(site.hours)?site.hours:[],
    services:Array.isArray(site.services)?site.services:[],images:Array.isArray(site.images)?site.images:[],
    audience:site.audience||"",pageJob:site.pageJob||"",eyebrow:site.eyebrow||"",
    heroTitle:site.heroTitle||"",heroText:site.heroText||"",aboutTitle:site.aboutTitle||"",aboutText:site.aboutText||"",
    proofTitle:site.proofTitle||"",proofText:site.proofText||"",contactTitle:site.contactTitle||"",contactText:site.contactText||"",
    ctas:site.ctas||{},design:site.design||{},blueprint:site.blueprint||{}
  };
}
function fallbackPlan(site){
  const list=[
    {name:"BrandHeader",role:"navigation",purpose:"Navegação e contato principal",layout:"Cabeçalho leve e próprio da identidade",interaction:"Âncoras e CTA",mobile:"Marca e ação sem overflow"},
    {name:"LeadHero",role:"hero",purpose:"Apresentar a proposta principal",layout:"Composição autoral de headline, imagem e CTA",interaction:"Microinterações discretas",mobile:"Fluxo em coluna com CTA visível"},
    {name:"BrandStory",role:"story",purpose:"Apresentar a história e o contexto real",layout:"Seção editorial",interaction:"Reveal opcional",mobile:"Leitura confortável"}
  ];
  if(Array.isArray(site.services)&&site.services.length)list.push({name:"ServiceExperience",role:"services",purpose:"Mostrar serviços verificados",layout:"Composição própria para os serviços",interaction:"Hover discreto",mobile:"Lista vertical"});
  if(site.rating||site.reviews||site.city||site.phone)list.push({name:"TrustSignals",role:"proof",purpose:"Mostrar sinais reais de confiança",layout:"Prova integrada ao conceito visual",interaction:"Sem interação obrigatória",mobile:"Fatos legíveis"});
  if(site.address||site.mapsLink)list.push({name:"VisitSection",role:"location",purpose:"Facilitar localização",layout:"Endereço e CTA para Maps",interaction:"Abrir Maps",mobile:"CTA grande"});
  list.push(
    {name:"ConversionCTA",role:"contact",purpose:"Concluir a jornada com contato",layout:"CTA final específico",interaction:"Contato em um toque",mobile:"Botões largos"},
    {name:"BrandFooter",role:"footer",purpose:"Encerrar com identidade",layout:"Rodapé próprio",interaction:"Links existentes",mobile:"Empilhado"}
  );
  if(site.whatsapp||site.phone||site.mapsLink)list.push({name:"MobileConversionBar",role:"mobile-cta",purpose:"Ação persistente no celular",layout:"Barra exclusiva de mobile",interaction:"Contato em um toque",mobile:"Fixa com safe-area"});
  return {version:4,concept:site.blueprint?.concept||"site-autoral",creativeThesis:site.blueprint?.visualThesis||"Uma presença digital própria para este lead.",conversionStrategy:"Entendimento, confiança e contato.",components:list};
}
function normalizePlan(value,site){
  const source=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  const raw=Array.isArray(source.components)?source.components:[];
  const seen=new Set();
  const components=[];
  for(let i=0;i<raw.length&&components.length<MAX_COMPONENTS;i++){
    const item=raw[i]||{},name=pascal(item.name||((item.role||"Section")+" "+(i+1)));
    if(!name||seen.has(name))continue;
    seen.add(name);
    components.push({name,role:normalizeRole(item.role),purpose:clean(item.purpose,700),layout:clean(item.layout,900),interaction:clean(item.interaction,700),mobile:clean(item.mobile,700),visualHook:clean(item.visualHook,700)});
  }
  const fallback=fallbackPlan(site);
  if(!components.some(function(item){return item.role==="hero"}))components.unshift(fallback.components.find(function(item){return item.role==="hero"}));
  if(!components.some(function(item){return item.role==="footer"}))components.push(fallback.components.find(function(item){return item.role==="footer"}));
  if((site.whatsapp||site.phone||site.mapsLink)&&!components.some(function(item){return item.role==="mobile-cta"}))components.push(fallback.components.find(function(item){return item.role==="mobile-cta"}));
  return {version:4,concept:clean(source.concept,160)||fallback.concept,creativeThesis:clean(source.creativeThesis,900)||fallback.creativeThesis,conversionStrategy:clean(source.conversionStrategy,1200)||fallback.conversionStrategy,components:components.slice(0,MAX_COMPONENTS)};
}
function architectureRequest(site,instruction,currentPlan){
  return {
    model:roleModel("architect"),temperature:.76,maxTokens:16000,
    systemPrompt:[
      "Você é diretor de criação, arquiteto de experiência e estrategista de conversão.",
      "Crie uma arquitetura própria para este negócio. Não escolha nem adapte um template.",
      "Cada item da arquitetura virará um componente React real com JSX e CSS próprios.",
      "Use apenas fatos fornecidos. Não invente serviços, preços, depoimentos, profissionais, certificações, equipamentos, resultados ou números.",
      "FAQ, pricing e testimonials somente podem existir se os fatos fornecidos realmente sustentarem esse conteúdo.",
      "Mobile-first é obrigatório em 320px, 360px e 390px.",
      "Evite a sequência automática Hero/About/Services/Cards. Pense na jornada ideal deste lead.",
      "Retorne somente JSON válido."
    ].join(" "),
    prompt:[
      "Desenhe o site exclusivo deste lead.",
      "Cada componente deve ter name PascalCase, role, purpose, layout, interaction, mobile e visualHook.",
      "Roles: navigation, hero, proof, services, story, showcase, benefits, gallery, faq, location, contact, footer, mobile-cta, custom.",
      instruction?"PEDIDO DE ALTERAÇÃO: "+clean(instruction,5000):"",
      currentPlan?"ARQUITETURA ATUAL: "+JSON.stringify(currentPlan):"",
      "DADOS VERIFICADOS E COPY: "+JSON.stringify(facts(site)),
      "FORMATO: "+JSON.stringify({version:4,concept:"",creativeThesis:"",conversionStrategy:"",components:[{name:"DreamsHero",role:"hero",purpose:"",layout:"",interaction:"",mobile:"",visualHook:""}]})
    ].filter(Boolean).join("\n\n")
  };
}
function parseComponent(text){
  const raw=clean(text,180000);
  const jsx=raw.match(/<JSX>\s*([\s\S]*?)\s*<\/JSX>/i)?.[1]?.trim();
  const css=raw.match(/<CSS>\s*([\s\S]*?)\s*<\/CSS>/i)?.[1]?.trim();
  if(jsx&&css)return{jsx,css};
  try{const obj=parseJson(raw);if(typeof obj.jsx==="string"&&typeof obj.css==="string")return{jsx:obj.jsx.trim(),css:obj.css.trim()}}catch{}
  throw new Error("A resposta não contém JSX e CSS válidos.");
}
function validateComponent(name,source){
  const jsx=String(source.jsx||""),css=String(source.css||""),errors=[];
  if(!jsx||!css)errors.push("JSX e CSS são obrigatórios");
  if(/\sstyle\s*=/i.test(jsx))errors.push("style= e CSS inline são proibidos");
  if(/@tailwind|@apply/i.test(css))errors.push("Tailwind é proibido");
  if(/\b(interface|enum|implements)\b|React\.FC|:\s*(string|number|boolean)\b/.test(jsx))errors.push("TypeScript é proibido");
  if(!jsx.includes('import styles from "./'+name+'.module.css"')&&!jsx.includes("import styles from './"+name+".module.css'"))errors.push("importe o CSS Module próprio como styles");
  if(!/styles\./.test(jsx))errors.push("use classes do CSS Module");
  const imports=[...jsx.matchAll(/from\s+["']([^"']+)["']/g)].map(function(match){return match[1]});
  for(const imp of imports){if(imp==="react"||imp.startsWith("./")||imp.startsWith("../"))continue;errors.push("import externo proibido: "+imp)}
  if(!/export\s+default/.test(jsx))errors.push("export default obrigatório");
  if(css.length<40)errors.push("CSS Module insuficiente");
  return errors;
}
function componentRequest(site,plan,component,errors){
  return {
    model:roleModel("code"),temperature:.64,maxTokens:14000,
    systemPrompt:[
      "Você é engenheiro front-end sênior e designer de interface.",
      "Escreva um componente específico para este lead, não um bloco de template.",
      "Stack: React/Next App Router, JavaScript JSX e CSS Modules.",
      "Proibido: TypeScript, Tailwind, styled-components, emotion, CSS-in-JS, style=, bibliotecas de UI e dependências externas.",
      "O JSX deve importar exatamente ./"+component.name+".module.css como styles.",
      "Pode importar hooks de react e utilidades locais relativas. Use img em vez de next/image.",
      "O componente recebe a prop site. Use somente fatos existentes em site.",
      "Todo visual fica no CSS Module. CSS deve ser mobile-first; amplie com @media (min-width:...).",
      "Acessibilidade, foco visível e touch targets são obrigatórios.",
      "Retorne somente <JSX>...</JSX><CSS>...</CSS>."
    ].join(" "),
    prompt:[
      "SITE: "+JSON.stringify(facts(site)),
      "DIREÇÃO: "+JSON.stringify({concept:plan.concept,creativeThesis:plan.creativeThesis,conversionStrategy:plan.conversionStrategy}),
      "COMPONENTE: "+JSON.stringify(component),
      "Variáveis CSS disponíveis: --color-primary, --color-accent, --color-background, --color-surface, --color-text, --color-muted, --font-display, --font-body, --radius.",
      "Para links use, quando necessário: import { actionHref } from \"../../lib/siteActions.js\";",
      errors.length?"CORRIJA ESTES ERROS: "+errors.join(" | "):""
    ].filter(Boolean).join("\n\n")
  };
}
function fallbackComponent(component){
  const name=component.name,role=component.role;
  let body="";
  let importAction="";
  if(role==="hero"){
    importAction='import { actionHref } from "../../lib/siteActions.js";\n';
    body='<section className={styles.root} id="top"><div className={styles.content}><p className={styles.kicker}>{site.eyebrow}</p><h1>{site.heroTitle}</h1><p>{site.heroText}</p><a className={styles.cta} href={actionHref(site.ctas?.primary?.action, site)}>{site.ctas?.primary?.label || "Falar agora"}</a></div>{site.images?.[0] ? <img className={styles.image} src={site.images[0]} alt={site.brandName} /> : null}</section>';
  }else if(role==="footer"){
    body='<footer className={styles.root}><strong>{site.brandName}</strong><span>{site.city || ""}</span></footer>';
  }else if(role==="mobile-cta"){
    importAction='import { actionHref } from "../../lib/siteActions.js";\n';
    body='<div className={styles.root}><a href={actionHref(site.ctas?.primary?.action, site)}>{site.ctas?.primary?.label || "Contato"}</a></div>';
  }else{
    body='<section className={styles.root}><h2>{site.aboutTitle || site.brandName}</h2><p>{site.aboutText || site.proofText || site.contactText || ""}</p></section>';
  }
  const jsx=importAction+'import styles from "./'+name+'.module.css";\n\nexport default function '+name+'({ site }) {\n  return ('+body+');\n}\n';
  const css=role==="mobile-cta"
    ? '.root{display:none}@media(max-width:768px){.root{position:fixed;z-index:80;left:0;right:0;bottom:0;display:block;padding:10px;background:var(--color-surface);border-top:1px solid rgba(0,0,0,.1)}.root a{display:flex;min-height:50px;align-items:center;justify-content:center;border-radius:var(--radius);background:var(--color-primary);color:#fff;text-decoration:none;font-weight:800}}'
    : '.root{padding:64px 20px;background:var(--color-background);color:var(--color-text)}.root h1,.root h2{font-family:var(--font-display);line-height:.95}.root p{max-width:680px;color:var(--color-muted)}.content{max-width:720px}.cta{display:inline-flex;margin-top:20px;padding:14px 20px;border-radius:var(--radius);background:var(--color-primary);color:#fff;text-decoration:none}.image{width:100%;max-height:620px;object-fit:cover;margin-top:28px;border-radius:var(--radius)}@media(min-width:768px){.root{padding:96px clamp(32px,6vw,96px)}}';
  return{jsx,css};
}
async function generateComponent(site,plan,component,skipAi,initialNotes=[]){
  if(skipAi)return fallbackComponent(component);
  let errors=[...initialNotes];
  for(let attempt=0;attempt<2;attempt++){
    const result=await generateWithDefaultProvider(componentRequest(site,plan,component,errors));
    let source;
    try{source=parseComponent(result.text)}catch(error){errors=[error.message];continue}
    errors=validateComponent(component.name,source);
    if(!errors.length)return source;
  }
  throw new Error("Componente "+component.name+" reprovado: "+errors.join("; "));
}
async function concurrent(items,limit,fn){
  const output=new Array(items.length);let cursor=0;
  async function worker(){while(true){const index=cursor++;if(index>=items.length)return;output[index]=await fn(items[index],index)}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return output;
}
function actionLib(){
  return 'export function actionHref(action, site = {}) {\n  if (action === "whatsapp" && site.whatsapp) return "https://wa.me/" + site.whatsapp;\n  if (action === "phone" && site.phone) return "tel:" + String(site.phone).replace(/[^+\\d]/g, "");\n  if (action === "instagram" && site.instagram) return site.instagram;\n  if (action === "maps" && site.mapsLink) return site.mapsLink;\n  return "#contato";\n}\n';
}
function pageSource(plan){
  const imports=plan.components.map(function(item){return 'import '+item.name+' from "../components/'+item.name+'/'+item.name+'.jsx";'}).join("\n");
  const body=plan.components.map(function(item){return '      <'+item.name+' site={siteData} />';}).join("\n");
  return 'import siteData from "../data/siteData.js";\n'+imports+'\n\nexport default function Home() {\n  return (\n    <>\n'+body+'\n    </>\n  );\n}\n';
}
function fontConfig(pair){
  if(pair==="editorial"||pair==="luxury")return{imports:"Cormorant_Garamond, Manrope",display:'Cormorant_Garamond({ subsets: ["latin"], weight: ["500","600","700"], variable: "--font-display" })',body:'Manrope({ subsets: ["latin"], variable: "--font-body" })'};
  if(pair==="humanist")return{imports:"Fraunces, DM_Sans",display:'Fraunces({ subsets: ["latin"], variable: "--font-display" })',body:'DM_Sans({ subsets: ["latin"], variable: "--font-body" })'};
  return{imports:"Space_Grotesk, Manrope",display:'Space_Grotesk({ subsets: ["latin"], variable: "--font-display" })',body:'Manrope({ subsets: ["latin"], variable: "--font-body" })'};
}
function layoutSource(site){
  const fonts=fontConfig(site.design?.fontPair);
  return 'import { '+fonts.imports+' } from "next/font/google";\nimport "./globals.css";\nimport styles from "./theme.module.css";\n\nconst displayFont = '+fonts.display+';\nconst bodyFont = '+fonts.body+';\n\nexport const metadata = { title: '+JSON.stringify(site.seoTitle||site.brandName||"Site")+', description: '+JSON.stringify(site.seoDescription||site.heroText||"")+' };\n\nexport default function RootLayout({ children }) {\n  return <html lang="pt-BR"><body className={displayFont.variable + " " + bodyFont.variable + " " + styles.body}>{children}</body></html>;\n}\n';
}
function globalsCss(){return '*{box-sizing:border-box}html{scroll-behavior:smooth}html,body{margin:0;padding:0;min-height:100%;width:100%;max-width:100%;overflow-x:hidden}body{min-width:0}img,svg{max-width:100%}button,a,input,textarea,select{font:inherit}button,a{touch-action:manipulation}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}'}
function themeCss(site){
  const c=site.design?.colors||{},radius=site.design?.radius==="sharp"?"4px":site.design?.radius==="rounded"?"28px":"14px";
  return '.body{--color-primary:'+(c.primary||"#17324D")+';--color-accent:'+(c.accent||"#D59B42")+';--color-background:'+(c.background||"#F5F5F3")+';--color-surface:'+(c.surface||"#FFFFFF")+';--color-text:'+(c.text||"#14202A")+';--color-muted:'+(c.muted||"#66717D")+';--radius:'+radius+';margin:0;background:var(--color-background);color:var(--color-text);font-family:var(--font-body),Arial,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}';
}
function packageSource(folderName){return JSON.stringify({name:folderName,version:"1.0.0",private:true,scripts:{dev:"next dev",build:"next build",start:"next start"},dependencies:{next:"latest",react:"latest","react-dom":"latest"}},null,2)}
function readme(site,plan){return '# '+(site.brandName||"Site")+'\n\nProjeto exclusivo gerado pelo LeadFlow para este lead.\n\nStack: Next latest, React latest, JavaScript JSX, CSS Modules, sem Tailwind, sem TypeScript e sem CSS inline.\n\nCada seção possui sua própria pasta em components, com JSX e module.css.\n\nConceito: '+plan.concept+'\n\nPara executar: npm install e depois npm run dev.\n\nAntes de publicar, confirme os dados comerciais com o cliente.\n'}
async function clearCode(root){for(const name of ["app","components","data","lib"])await fs.rm(path.join(root,name),{recursive:true,force:true})}
async function writeProject(root,folderName,site,plan,sources){
  await clearCode(root);
  for(const name of ["app","components","data","lib"])await fs.mkdir(path.join(root,name),{recursive:true});
  const writes=[
    fs.writeFile(path.join(root,"app","layout.jsx"),layoutSource(site),"utf8"),
    fs.writeFile(path.join(root,"app","page.jsx"),pageSource(plan),"utf8"),
    fs.writeFile(path.join(root,"app","globals.css"),globalsCss(),"utf8"),
    fs.writeFile(path.join(root,"app","theme.module.css"),themeCss(site),"utf8"),
    fs.writeFile(path.join(root,"data","siteData.js"),'const siteData = '+JSON.stringify(site,null,2)+';\n\nexport default siteData;\n',"utf8"),
    fs.writeFile(path.join(root,"lib","siteActions.js"),actionLib(),"utf8"),
    fs.writeFile(path.join(root,"package.json"),packageSource(folderName),"utf8"),
    fs.writeFile(path.join(root,"README.md"),readme(site,plan),"utf8"),
    fs.writeFile(path.join(root,"generation-format.json"),JSON.stringify({format:"unique-codegen-v4",generatedAt:new Date().toISOString(),plan},null,2),"utf8"),
    fs.writeFile(path.join(root,".gitignore"),"node_modules\n.next\n.env*\n","utf8")
  ];
  for(let i=0;i<plan.components.length;i++){
    const item=plan.components[i],source=sources[i],dir=path.join(root,"components",item.name);
    await fs.mkdir(dir,{recursive:true});
    writes.push(fs.writeFile(path.join(dir,item.name+".jsx"),source.jsx,"utf8"));
    writes.push(fs.writeFile(path.join(dir,item.name+".module.css"),source.css,"utf8"));
  }
  await Promise.all(writes);
}
async function reviewSources(site,plan,sources){
  const snapshot=plan.components.map(function(component,index){
    return {name:component.name,role:component.role,jsx:clean(sources[index]?.jsx,7000),css:clean(sources[index]?.css,7000)};
  });
  const result=await generateWithDefaultProvider({
    model:roleModel("review"),
    temperature:.22,
    maxTokens:7000,
    systemPrompt:[
      "Você é o revisor final de uma agência premium.",
      "Revise o site como produto comercial real, não como exercício de código.",
      "Procure aparência genérica, repetição de cards, baixa personalidade, problemas de hierarquia, mobile fraco, CTA escondido, acessibilidade e inconsistência entre componentes.",
      "Não peça informações que não existem e não invente fatos.",
      "Retorne somente JSON válido no formato solicitado."
    ].join(" "),
    prompt:[
      "DIREÇÃO: "+JSON.stringify({concept:plan.concept,creativeThesis:plan.creativeThesis,conversionStrategy:plan.conversionStrategy}),
      "DADOS: "+JSON.stringify(facts(site)),
      "COMPONENTES: "+JSON.stringify(snapshot),
      "Retorne: "+JSON.stringify({pass:true,issues:[{component:"Nome",severity:"high",instruction:"Correção objetiva para este componente"}]})
    ].join("\n\n")
  });
  let data;
  try{data=await parseJsonWithRepair(result.text,"review")}catch{return[]}
  const known=new Set(plan.components.map(function(item){return item.name}));
  return (Array.isArray(data.issues)?data.issues:[]).filter(function(issue){
    return known.has(issue?.component)&&["high","medium"].includes(String(issue?.severity||"").toLowerCase())&&clean(issue?.instruction,1200);
  }).slice(0,5).map(function(issue){return{component:issue.component,note:"REVISÃO FINAL: "+clean(issue.instruction,1200)}});
}
async function rewriteComponents(root,plan,sources,names){
  for(const name of names){
    const index=plan.components.findIndex(function(item){return item.name===name});
    if(index<0)continue;
    const source=sources[index],dir=path.join(root,"components",name);
    await fs.writeFile(path.join(dir,name+".jsx"),source.jsx,"utf8");
    await fs.writeFile(path.join(dir,name+".module.css"),source.css,"utf8");
  }
}
function componentNamesFromBuildLog(log,plan){
  const normalized=String(log||"").replace(/\\\\/g,"/");
  const names=[];
  for(const component of plan.components){
    if(normalized.includes("components/"+component.name+"/"))names.push(component.name);
  }
  return [...new Set(names)].slice(0,4);
}

async function validateProject(root,plan){
  const errors=[];
  const pkg=JSON.parse(await fs.readFile(path.join(root,"package.json"),"utf8"));
  if(pkg.dependencies?.next!=="latest")errors.push("next deve ser latest");
  for(const item of plan.components){
    try{
      const jsx=await fs.readFile(path.join(root,"components",item.name,item.name+".jsx"),"utf8");
      const css=await fs.readFile(path.join(root,"components",item.name,item.name+".module.css"),"utf8");
      errors.push(...validateComponent(item.name,{jsx,css}).map(function(error){return item.name+": "+error}));
    }catch{errors.push("Componente incompleto: "+item.name)}
  }
  return errors;
}
async function runBuild(root){
  const nextBin=path.join(process.cwd(),"node_modules","next","dist","bin","next");
  try{
    const result=await execFileAsync(process.execPath,[nextBin,"build"],{cwd:root,timeout:180000,maxBuffer:3*1024*1024,env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"}});
    return{ok:true,log:(result.stdout||"")+"\n"+(result.stderr||"")};
  }catch(error){
    return{ok:false,log:clean((error.stdout||"")+"\n"+(error.stderr||"")+"\n"+error.message,80000)};
  }
}

export async function generateUniqueSiteCode(options={}){
  const folderPath=options.folderPath,folderName=options.folderName,site=options.siteData||{},skipAi=Boolean(options.skipAi);
  const root=path.resolve(process.cwd(),folderPath);
  let plan;
  if(skipAi)plan=fallbackPlan(site);
  else{
    const request=architectureRequest(site,options.instruction||"",options.currentPlan||null);
    let result=await generateWithDefaultProvider(request);
    try{
      plan=normalizePlan(await parseJsonWithRepair(result.text,"review"),site);
    }catch(firstError){
      result=await generateWithDefaultProvider({
        ...request,
        temperature:0.35,
        maxTokens:16000,
        systemPrompt:request.systemPrompt+" ATENÇÃO: sua tentativa anterior não pôde ser interpretada. Retorne exclusivamente um objeto JSON estrito iniciado por { e terminado por }, sem cercas de código, comentários, raciocínio, texto introdutório ou conclusão.",
        prompt:request.prompt+"\n\nEsta é uma nova tentativa porque a resposta anterior não era JSON válido. Obedeça rigorosamente ao formato JSON.",
      });
      try{
        plan=normalizePlan(await parseJsonWithRepair(result.text,"review"),site);
      }catch(secondError){
        throw new Error("O arquiteto não conseguiu produzir a estrutura JSON do site após duas tentativas e reparo automático. "+secondError.message);
      }
    }
  }
  plan=normalizePlan(plan,site);
  const sources=await concurrent(plan.components,3,function(component){return generateComponent(site,plan,component,skipAi)});
  if(!skipAi){
    const review=await reviewSources(site,plan,sources);
    if(review.length){
      await concurrent(review,2,async function(issue){
        const index=plan.components.findIndex(function(item){return item.name===issue.component});
        if(index<0)return;
        sources[index]=await generateComponent(site,plan,plan.components[index],false,[issue.note]);
      });
    }
  }
  await writeProject(root,folderName,site,plan,sources);
  let errors=await validateProject(root,plan);
  if(errors.length)throw new Error("Projeto reprovado pelas regras de engenharia: "+errors.join(" | "));
  let build={ok:true,log:"Build ignorado."};
  if(options.validateBuild!==false&&!skipAi){
    build=await runBuild(root);
    if(!build.ok){
      const affected=componentNamesFromBuildLog(build.log,plan);
      if(affected.length){
        await concurrent(affected,2,async function(name){
          const index=plan.components.findIndex(function(item){return item.name===name});
          sources[index]=await generateComponent(site,plan,plan.components[index],false,["BUILD FALHOU. Corrija sintaxe/imports/uso de client component. Log: "+clean(build.log,1800)]);
        });
        await rewriteComponents(root,plan,sources,affected);
        errors=await validateProject(root,plan);
        if(!errors.length)build=await runBuild(root);
      }
    }
    if(!build.ok)throw new Error("O código foi gerado, mas falhou no build automático: "+clean(build.log,3500));
  }
  return{plan,format:"unique-codegen-v4",buildOk:build.ok};
}

export async function isUniqueCodegenProject(folderPath){
  try{
    const file=path.join(path.resolve(process.cwd(),folderPath),"generation-format.json");
    const data=JSON.parse(await fs.readFile(file,"utf8"));
    return data?.format==="unique-codegen-v4";
  }catch{return false}
}
export async function enforceLatestPackage(folderPath){
  const root=path.resolve(process.cwd(),folderPath),file=path.join(root,"package.json");
  const pkg=JSON.parse(await fs.readFile(file,"utf8"));
  pkg.dependencies={...(pkg.dependencies||{}),next:"latest",react:"latest","react-dom":"latest"};
  await fs.writeFile(file,JSON.stringify(pkg,null,2),"utf8");
  return root;
}
