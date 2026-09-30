import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateSiteWithDefaultProvider as generateWithDefaultProvider } from "../ai/siteProviderService.js";
import { productContractPrompt } from "./siteProductContract.js";
import { runVisualQualityAudit } from "./siteVisualQa.js";
import { codegenThemeCss, fallbackCodegenDesignSystem, normalizeCodegenDesignSystem } from "./siteDesignSystem.js";
import { applyUnifiedDiff } from "./sitePatchEngine.js";
import { buildComponentEditContext, patchBudgetFor, validatePatchPreservation } from "./siteEditContext.js";
import { withFileTransaction } from "./siteEditTransaction.js";

const execFileAsync = promisify(execFile);
const MAX_COMPONENTS = 16;
const ALLOWED_ROLES = new Set(["navigation","hero","proof","services","story","showcase","benefits","gallery","faq","location","contact","footer","mobile-cta","custom"]);

function clean(value,max=10000){return String(value??"").replace(/\u0000/g,"").trim().slice(0,max)}
function roleModel(role){
  const env={architect:"LEADFLOW_SITE_MODEL_ARCHITECT",code:"LEADFLOW_SITE_MODEL_CODE",review:"LEADFLOW_SITE_MODEL_REVIEW"};
  return clean(process.env[env[role]]||process.env.LEADFLOW_SITE_MODEL||"",300);
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
async function parseJsonWithRepair(text,role="review",onProgress=null){
  try{return parseCodegenJson(text)}catch(firstError){
    await onProgress?.({phase:"architecture",title:"Resposta estrutural inválida",detail:"O arquiteto não entregou um objeto JSON utilizável. O sistema não tentará transformar intenção narrativa em arquitetura."});
    throw firstError;
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
    brandName:site.brandName||"",segment:site.segment||"",city:site.city||"",address:site.address||"",template:site.template||"landing",productContract:site.productContract||{},brandEvidence:site.brandEvidence||{},
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
  const delivery=site.productContract?.type==="delivery";
  const list=delivery?[
    {name:"BrandHeader",role:"navigation",purpose:"Navegação e ação principal de pedido",layout:"Cabeçalho compacto orientado à conversão",interaction:"Âncoras e CTA de pedido",mobile:"Marca e pedir sem overflow"},
    {name:"DeliveryHero",role:"hero",purpose:"Comunicar imediatamente que o visitante pode pedir",content:site.productContract?.dataPolicy||"",layout:"Primeira dobra apetitosa orientada a pedido com fotografia real e CTA dominante",interaction:"Abrir canal real de pedido",mobile:"CTA de pedido dominante acima da dobra"},
    {name:"DeliveryDiscovery",role:"showcase",purpose:"Criar descoberta visual honesta sem inventar cardápio ou preços",content:"Use somente fatos e imagens verificadas; quando não houver itens verificados, conduza à consulta do cardápio pelo canal real.",layout:"Vitrine visual de delivery baseada nas imagens reais",interaction:"Consultar cardápio/fazer pedido no WhatsApp",mobile:"Descoberta vertical com ação sempre próxima"},
    {name:"HowToOrder",role:"benefits",purpose:"Explicar como avançar para o pedido sem simular checkout inexistente",layout:"Fluxo curto de pedido até o WhatsApp",interaction:"CTA para iniciar pedido",mobile:"Passos curtos e acionáveis"}
  ]:[
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
  return {
    version:4,
    concept:site.blueprint?.concept||"site-autoral",
    creativeThesis:site.blueprint?.visualThesis||"Uma presença digital própria para este lead.",
    conversionStrategy:"Entendimento, confiança e contato.",
    visualSystem:"Use a identidade definida em site.design com hierarquia tipográfica forte, fotografia real e composição sem aparência de template.",
    imageStrategy:"Priorize as imagens reais do negócio e evite repetição da mesma foto em seções consecutivas.",
    motionStrategy:"Movimento discreto com transform e opacity, sempre respeitando prefers-reduced-motion.",
    responsiveStrategy:"Mobile-first em 320/360/390px; conteúdo essencial no fluxo normal; ampliar composição progressivamente em tablet e desktop.",
    designSystem:fallbackCodegenDesignSystem(site),
    copy:{
      eyebrow:site.eyebrow||"",heroTitle:site.heroTitle||"",heroText:site.heroText||"",
      aboutTitle:site.aboutTitle||"",aboutText:site.aboutText||"",
      proofTitle:site.proofTitle||"",proofText:site.proofText||"",
      contactTitle:site.contactTitle||"",contactText:site.contactText||"",
      primaryCtaLabel:site.ctas?.primary?.label||"",secondaryCtaLabel:site.ctas?.secondary?.label||""
    },
    components:list
  };
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
    components.push({
      name,
      role:normalizeRole(item.role),
      purpose:clean(item.purpose,900),
      content:clean(item.content,1400),
      layout:clean(item.layout,1400),
      desktop:clean(item.desktop,1400),
      tablet:clean(item.tablet,1200),
      mobile:clean(item.mobile,1400),
      assetUsage:clean(item.assetUsage,1400),
      interaction:clean(item.interaction,1000),
      accessibility:clean(item.accessibility,900),
      acceptanceCriteria:clean(item.acceptanceCriteria,1800),
      visualHook:clean(item.visualHook,1000)
    });
  }
  const fallback=fallbackPlan(site);
  const hasRole=function(role){return components.some(function(item){return item.role===role})};
  const fallbackRole=function(role){return fallback.components.find(function(item){return item.role===role})};
  const insertBeforeEnd=function(item){
    if(!item||components.some(function(existing){return existing.name===item.name||existing.role===item.role}))return;
    const endIndex=components.findIndex(function(existing){return ["contact","footer","mobile-cta"].includes(existing.role)});
    if(endIndex>=0)components.splice(endIndex,0,item); else components.push(item);
  };

  if(site.productContract?.type==="delivery"&&!components.some(item=>item.name==="DeliveryOrderExperience"||/pedido|delivery|menu|cardap/i.test(item.purpose+" "+item.name))){
    insertBeforeEnd({name:"DeliveryOrderExperience",role:"custom",purpose:"Materializar a jornada de delivery/pedido exigida pelo contrato funcional sem inventar cardápio ou preços.",content:site.productContract?.dataPolicy||"",layout:"Experiência de pedido visual e acionável, não seção institucional.",desktop:"Descoberta e ação de pedido com hierarquia de produto.",tablet:"Fluxo de pedido preservado.",mobile:"Ação de pedir dominante e alcançável com o polegar.",assetUsage:"Use somente imagens reais relevantes disponíveis em site.images.",interaction:"Conduzir ao canal real de pedido; não simular checkout inexistente.",accessibility:"Fluxo operável por teclado e controles nomeados.",acceptanceCriteria:"Deve parecer uma experiência de delivery antes de ler toda a copy; nenhum produto/preço inventado; CTA real de pedido visível.",visualHook:"Energia e identidade extraídas das evidências visuais da marca."});
  }
  if(!hasRole("navigation")&&fallbackRole("navigation"))components.unshift(fallbackRole("navigation"));
  if(!hasRole("hero"))components.splice(Math.min(1,components.length),0,fallbackRole("hero"));
  if((site.aboutTitle||site.aboutText)&&!hasRole("story"))insertBeforeEnd(fallbackRole("story"));
  if(Array.isArray(site.services)&&site.services.length&&!components.some(function(item){return ["services","showcase","benefits"].includes(item.role)}))insertBeforeEnd(fallbackRole("services"));
  if((site.rating||site.reviews||site.city||site.phone)&&!hasRole("proof"))insertBeforeEnd(fallbackRole("proof"));
  if((site.address||site.mapsLink)&&!hasRole("location"))insertBeforeEnd(fallbackRole("location"));
  if(!hasRole("contact"))insertBeforeEnd(fallbackRole("contact"));
  if(!hasRole("footer"))components.push(fallbackRole("footer"));
  if((site.whatsapp||site.phone||site.mapsLink)&&!hasRole("mobile-cta"))components.push(fallbackRole("mobile-cta"));

  const sourceCopy=source.copy&&typeof source.copy==="object"?source.copy:{};
  return {
    version:4,
    concept:clean(source.concept,260)||fallback.concept,
    creativeThesis:clean(source.creativeThesis,2200)||fallback.creativeThesis,
    conversionStrategy:clean(source.conversionStrategy,2000)||fallback.conversionStrategy,
    visualSystem:clean(source.visualSystem,2600)||fallback.visualSystem,
    imageStrategy:clean(source.imageStrategy,2200)||fallback.imageStrategy,
    motionStrategy:clean(source.motionStrategy,1800)||fallback.motionStrategy,
    responsiveStrategy:clean(source.responsiveStrategy,2200)||fallback.responsiveStrategy,
    designSystem:normalizeCodegenDesignSystem(source.designSystem,site),
    copy:{
      eyebrow:clean(sourceCopy.eyebrow,120)||site.eyebrow||"",
      heroTitle:clean(sourceCopy.heroTitle,112)||site.heroTitle||"",
      heroText:clean(sourceCopy.heroText,520)||site.heroText||"",
      aboutTitle:clean(sourceCopy.aboutTitle,120)||site.aboutTitle||"",
      aboutText:clean(sourceCopy.aboutText,900)||site.aboutText||"",
      proofTitle:clean(sourceCopy.proofTitle,120)||site.proofTitle||"",
      proofText:clean(sourceCopy.proofText,520)||site.proofText||"",
      contactTitle:clean(sourceCopy.contactTitle,120)||site.contactTitle||"",
      contactText:clean(sourceCopy.contactText,520)||site.contactText||"",
      primaryCtaLabel:clean(sourceCopy.primaryCtaLabel,80)||site.ctas?.primary?.label||"",
      secondaryCtaLabel:clean(sourceCopy.secondaryCtaLabel,80)||site.ctas?.secondary?.label||""
    },
    components:components.filter(Boolean).slice(0,MAX_COMPONENTS)
  };
}
function applyPlanCopy(site,plan){
  const copy=plan?.copy||{};
  for(const key of ["eyebrow","heroTitle","heroText","aboutTitle","aboutText","proofTitle","proofText","contactTitle","contactText"]){
    if(copy[key])site[key]=copy[key];
  }
  if(copy.primaryCtaLabel&&site.ctas?.primary){
    site.ctas.primary.label=copy.primaryCtaLabel;
    site.primaryCta=copy.primaryCtaLabel;
  }
  if(copy.secondaryCtaLabel&&site.ctas?.secondary){
    site.ctas.secondary.label=copy.secondaryCtaLabel;
    site.secondaryCta=copy.secondaryCtaLabel;
  }
}
function architectureRequest(site,instruction,currentPlan,visualImages=[]){
  return {
    model:roleModel("architect"),siteRole:"architect",temperature:.2,maxTokens:12000,timeoutMs:Number(process.env.LEADFLOW_SITE_TIMEOUT_ARCHITECT_MS||120000),retries:0,
    images:Array.isArray(visualImages)?visualImages.slice(0,6):[],
    systemPrompt:[
      "Você é diretor de criação, arquiteto de experiência e estrategista de conversão.",
      "Crie um DOSSIÊ DE IMPLEMENTAÇÃO próprio para este negócio. Não escolha nem adapte um template.",
      "O tipo de produto solicitado tem autoridade sobre a arquitetura. Se productContract.hardRequirement=true, descumpri-lo é falha de produto, mesmo que a página fique bonita.",
      "Quando productContract.type=delivery, a experiência precisa parecer e funcionar como delivery/pedido. NÃO a reduza a Hero+Sobre+Localização+Contato.",
      "Use brandEvidence extraída das imagens como evidência de identidade. Preserve cores, energia, linguagem e sinais visuais observados; qualquer desvio forte precisa ser deliberado e justificado no visualSystem.",
      "Você está entregando especificações para desenvolvedores executores mais simples. Portanto tome AGORA todas as decisões difíceis de direção visual, copy, composição, fotografia, responsividade, interação e conversão.",
      "Cada item da arquitetura virará um componente React real com JSX e CSS próprios.",
      "Use apenas fatos fornecidos. Não invente serviços, preços, depoimentos, profissionais, certificações, equipamentos, resultados ou números.",
      "CONTRATO DE EVIDÊNCIA: trate somente campos não vazios em DADOS VERIFICADOS como fatos. Ausência de dado significa DESCONHECIDO, nunca autorização para completar o negócio com padrões do nicho.",
      "A palavra premium, quando vier do pedido de design, descreve a EXPERIÊNCIA VISUAL DO SITE. Não a converta em qualidade premium do produto, ingredientes, preparo, atendimento ou entrega.",
      "WhatsApp verificado significa apenas que é UM canal real de contato/pedido. Não afirme que é o único canal, que contém cardápio completo, que informa preços/opções ou que há atendimento humano/personalizado, salvo se isso estiver nos fatos.",
      "Fotografias reais comprovam somente que os assets foram fornecidos. Não deduza delas nomes de produtos, ingredientes, categorias, variedade, disponibilidade, qualidade, composição do cardápio, mais vendidos ou quantidade mínima de fotos.",
      "Delivery não autoriza promessas como rápido, seguro, quentinho, feito na hora, entrega em domicílio, prazo, taxa, cobertura ou fluxo operacional específico sem evidência.",
      "Não crie seções que dependam de dados ausentes, como testimonials, social proof, FAQ operacional, mapa, horários, cardápio, área de entrega, consulta de CEP ou brand story factual. Prefira arquitetura que funcione integralmente com os fatos disponíveis.",
      "FAQ, pricing e testimonials somente podem existir se os fatos fornecidos realmente sustentarem esse conteúdo.",
      "Mobile-first é obrigatório em 320px, 360px e 390px.",
      "Evite a sequência automática Hero/About/Services/Cards. Pense na jornada ideal deste lead.",
      "A página precisa ser comercialmente completa: quando existirem fatos de serviços, prova, localização e contato, cubra essas responsabilidades na arquitetura, mas escolha nomes, ordem, composição e linguagem visual próprios.",
      "Não entregue uma arquitetura mínima de 2 ou 3 blocos se existem dados suficientes para uma experiência comercial completa.",
      "Quando fotos reais estiverem anexadas, ANALISE-AS. Defina exatamente quais imagens usar em cada componente, enquadramento sugerido e função narrativa. As paths válidas estão em site.images e devem aparecer em assetUsage.",
      "Você pode reescrever a COPY-SEMENTE para torná-la mais comercial e específica, mas sem inventar tratamentos, serviços, credenciais ou resultados.",
      "Para cada componente descreva desktop, tablet e mobile separadamente. Mobile precisa funcionar em 320, 360 e 390px sem overflow horizontal.",
      "Cada acceptanceCriteria deve ser testável e específico. Evite frases vagas como 'ficar bonito' ou 'ser premium'.",
      "Defina um DESIGN SYSTEM semântico antes dos componentes: linguagem de formas, superfícies, tipografia, espaçamento, tratamento de imagem, botões, um motivo visual de assinatura e uma lista de clichês a evitar.",
      "A identidade precisa sobreviver quando as seções forem geradas por modelos diferentes. Portanto descreva regras reutilizáveis, não estilos isolados.",
      "Evite paletas e clichês de IA por padrão: roxo/azul genérico, glassmorphism em excesso, grades de cards iguais e o mesmo raio em tudo, salvo quando houver justificativa real para a marca.",
      "Retorne somente JSON válido."
    ].join(" "),
    prompt:[
      "Desenhe o site exclusivo deste lead e entregue um plano suficientemente detalhado para que outro modelo apenas EXECUTE.",
      "Crie normalmente 7 a 12 componentes quando os dados sustentarem uma landing completa; não infle a página com conteúdo sem função.",
      "Cada componente deve ter name PascalCase, role, purpose, content, layout, desktop, tablet, mobile, assetUsage, interaction, accessibility, acceptanceCriteria e visualHook.",
      "Roles: navigation, hero, proof, services, story, showcase, benefits, gallery, faq, location, contact, footer, mobile-cta, custom.",
      "ASSETS DISPONÍVEIS: "+JSON.stringify(Array.isArray(site.images)?site.images:[]),
      instruction?"PEDIDO DE ALTERAÇÃO: "+clean(instruction,5000):"",
      currentPlan?"ARQUITETURA ATUAL: "+JSON.stringify(currentPlan):"",
      "DADOS VERIFICADOS E COPY-SEMENTE: "+JSON.stringify(facts(site)),
      productContractPrompt(site.productContract),
      "FORMATO: "+JSON.stringify({
        version:4,concept:"",creativeThesis:"",conversionStrategy:"",
        visualSystem:"",imageStrategy:"",motionStrategy:"",responsiveStrategy:"",
        designSystem:{signatureMotif:"",shapeLanguage:"",surfaceLanguage:"",typeHierarchy:"",spacingRhythm:"",imageTreatment:"",buttonLanguage:"",antiPatterns:[""]},
        copy:{eyebrow:"",heroTitle:"",heroText:"",aboutTitle:"",aboutText:"",proofTitle:"",proofText:"",contactTitle:"",contactText:"",primaryCtaLabel:"",secondaryCtaLabel:""},
        components:[{name:"NomeAutoral",role:"hero",purpose:"",content:"",layout:"",desktop:"",tablet:"",mobile:"",assetUsage:"Use /images/arquivo.jpg...",interaction:"",accessibility:"",acceptanceCriteria:"",visualHook:""}]
      })
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
function componentNeedsClient(jsx){
  return /\b(useState|useEffect|useLayoutEffect|useReducer|useRef|useMemo|useCallback|useTransition)\b|\b(window|document|requestAnimationFrame|cancelAnimationFrame)\b/.test(String(jsx||""));
}
function normalizeComponentSource(source){
  let jsx=String(source?.jsx||"").replace(/^\uFEFF/,"").trim();
  let css=String(source?.css||"").trim();
  if(componentNeedsClient(jsx)&&!/^\s*["']use client["'];/.test(jsx)){
    jsx='"use client";\n\n'+jsx;
  }
  return {jsx,css};
}
function validateComponent(name,source){
  const jsx=String(source.jsx||""),css=String(source.css||""),errors=[];
  if(!jsx||!css)errors.push("JSX e CSS são obrigatórios");
  if(/\sstyle\s*=/i.test(jsx))errors.push("style= e CSS inline são proibidos");
  if(/@tailwind|@apply/i.test(css))errors.push("Tailwind é proibido");
  if(/\b(interface|enum|implements)\b|React\.FC|:\s*(string|number|boolean)\b/.test(jsx))errors.push("TypeScript é proibido");
  const needsClient=componentNeedsClient(jsx);
  const hasUseClient=/^\s*["']use client["'];/.test(jsx);
  if(needsClient&&!hasUseClient)errors.push('componente usa hooks/API de browser e precisa começar com "use client";');
  if(!jsx.includes('import styles from "./'+name+'.module.css"')&&!jsx.includes("import styles from './"+name+".module.css'"))errors.push("importe o CSS Module próprio como styles");
  if(!/styles\./.test(jsx))errors.push("use classes do CSS Module");
  const imports=[...jsx.matchAll(/from\s+["']([^"']+)["']/g)].map(function(match){return match[1]});
  for(const imp of imports){if(imp==="react"||imp.startsWith("./")||imp.startsWith("../"))continue;errors.push("import externo proibido: "+imp)}
  if(!/export\s+default/.test(jsx))errors.push("export default obrigatório");
  if(/\b(?:images\.unsplash\.com|source\.unsplash\.com|picsum\.photos|via\.placeholder\.com|placehold(?:er)?\.com)\b/i.test(jsx))errors.push("imagens placeholder ou externas hardcoded são proibidas; use site.images");
  if(/\blorem\s+ipsum\b/i.test(jsx))errors.push("Lorem Ipsum é proibido");
  const imageTags=[...jsx.matchAll(/<img\b[^>]*>/gi)].map(match=>match[0]);
  if(imageTags.some(tag=>!/\balt\s*=/.test(tag)))errors.push("toda imagem deve declarar alt");
  if(css.length<40)errors.push("CSS Module insuficiente");
  return errors;
}
function componentRequest(site,plan,component,errors){
  const index=plan.components.findIndex(item=>item.name===component.name);
  const previous=index>0?plan.components[index-1]:null;
  const next=index>=0&&index<plan.components.length-1?plan.components[index+1]:null;
  return {
    model:roleModel("code"),siteRole:"code",siteVariant:site.siteVariant||"leadflow",temperature:.64,maxTokens:6500,timeoutMs:Number(process.env.LEADFLOW_SITE_TIMEOUT_CODE_MS||90000),retries:0,
    systemPrompt:[
      "Você é engenheiro front-end sênior e designer de interface.",
      "Escreva um componente específico para este lead, não um bloco de template.",
      "Você é EXECUTOR do dossiê criado pelo diretor premium. Não simplifique nem substitua as decisões de layout por padrões genéricos de cards.",
      "Stack: React/Next App Router, JavaScript JSX e CSS Modules.",
      "Proibido: TypeScript, Tailwind, styled-components, emotion, CSS-in-JS, style=, bibliotecas de UI e dependências externas.",
      "O JSX deve importar exatamente ./"+component.name+".module.css como styles.",
      "Pode importar hooks de react e utilidades locais relativas. Use img em vez de next/image.",
      "Se usar hooks React, window, document, requestAnimationFrame, listeners ou qualquer API de browser, a PRIMEIRA linha do JSX deve ser exatamente \"use client\";.",
      "Se não precisar de interatividade no cliente, mantenha o componente como Server Component.",
      "O componente recebe a prop site. Os dados reais são contexto; em modo prévia você pode criar conteúdo e dados demonstrativos coerentes para tornar a experiência completa.",
      "Use as variáveis semânticas globais do design system antes de inventar valores locais. Valores únicos são permitidos quando fazem parte do visualHook específico da seção.",
      "Não use Lorem Ipsum nem placeholders visuais pobres. Prefira site.images; conteúdo textual, produtos, preços, avaliações e ofertas demonstrativas podem ser criados livremente para a prévia.",
      "Todo visual fica no CSS Module. CSS deve ser mobile-first; amplie com @media (min-width:...).",
      "Em 320px, 360px e 390px: zero overflow horizontal; evite larguras fixas; prefira min(), max(), clamp(), minmax() e fluxo normal para conteúdo essencial. Composição desktop complexa deve ter uma transformação mobile explicitamente coerente.",
      "Acessibilidade, foco visível e touch targets são obrigatórios.",
      "Retorne somente <JSX>...</JSX><CSS>...</CSS>."
    ].join(" "),
    prompt:[
      "SITE ESSENCIAL: "+JSON.stringify(facts(site)),
      productContractPrompt(site.productContract),
      "DIREÇÃO MESTRE ENXUTA: "+JSON.stringify({concept:plan.concept,creativeThesis:plan.creativeThesis,conversionStrategy:plan.conversionStrategy,visualSystem:plan.visualSystem,imageStrategy:plan.imageStrategy,designSystem:plan.designSystem}),
      "SEQUÊNCIA: "+JSON.stringify(plan.components.map(item=>({name:item.name,role:item.role}))),
      "CONTEXTO ADJACENTE: "+JSON.stringify({previous:previous?{name:previous.name,role:previous.role,visualHook:previous.visualHook}:null,next:next?{name:next.name,role:next.role,visualHook:next.visualHook}:null}),
      "GOAL: implemente fielmente este componente do dossiê, com identidade própria e transição coerente com os componentes vizinhos.",
      "MUST HOLD: "+JSON.stringify({component,designSystem:plan.designSystem,responsiveStrategy:plan.responsiveStrategy}),
      "OUT OF SCOPE: não troque o stack, não simplifique a composição para cards genéricos e não altere outros componentes. Conteúdo demonstrativo é permitido.",
      "DONE WHEN: JSX e CSS Module compilam, cumprem acceptanceCriteria, funcionam em 320/360/390/768/1024/1440px, não geram overflow horizontal, preservam acessibilidade e parecem parte do mesmo sistema visual.",
      "Variáveis CSS disponíveis: --color-primary, --color-accent, --color-background, --color-surface, --color-text, --color-muted, --font-display, --font-body, --space-section, --space-section-compact, --space-gutter, --content-max, --content-narrow, --radius-sm, --radius-md, --radius-lg, --radius-pill, --shadow-soft, --shadow-elevated, --transition-fast, --transition-base, --focus-ring, --button-height, --reading-measure.",
      "Para links use, quando necessário: import { actionHref } from \"../../lib/siteActions.js\"; e chame sempre actionHref(action, site), por exemplo actionHref(site.ctas?.primary?.action, site).",
      errors.length?"CORRIJA ESTES ERROS: "+errors.join(" | "):""
    ].filter(Boolean).join("\n\n")
  };
}
function componentPatchRequest(site,plan,component,currentSource,instruction,errors=[]){
  const index=plan.components.findIndex(item=>item.name===component.name);
  const editContext=buildComponentEditContext(plan,component.name,currentSource);
  const patchBudget=patchBudgetFor(currentSource,instruction);
  const previous=index>0?plan.components[index-1]:null;
  const next=index>=0&&index<plan.components.length-1?plan.components[index+1]:null;
  const jsxPath="components/"+component.name+"/"+component.name+".jsx";
  const cssPath="components/"+component.name+"/"+component.name+".module.css";
  return{
    model:roleModel("code"),siteRole:"code",siteVariant:site.siteVariant||"leadflow",temperature:.28,maxTokens:7500,timeoutMs:Number(process.env.LEADFLOW_SITE_TIMEOUT_CODE_MS||240000),retries:1,
    systemPrompt:[
      "Você é um engenheiro sênior editando código existente com precisão cirúrgica.",
      "Retorne SOMENTE unified git diff. Não retorne arquivos completos, markdown explicativo, JSON ou comentários fora do diff.",
      "Modifique somente os arquivos explicitamente permitidos. Não renomeie arquivos e não altere arquitetura, outros componentes ou dados do site.",
      "Preserve tudo que não precisa mudar para cumprir o pedido. Hunk context e linhas removidas devem copiar EXATAMENTE o código atual.",
      "Stack obrigatória: Next App Router, JavaScript JSX e CSS Modules. Proibido TypeScript, Tailwind, CSS inline, UI kits ou novas dependências.",
      "O resultado deve continuar responsivo em 320/360/390/768/1024/1440px, acessível e coerente com o design system.",
      "Use somente fatos e imagens já existentes em site. Sem placeholders ou conteúdo inventado."
    ].join(" "),
    prompt:[
      "PEDIDO: "+instruction,
      "ARQUIVOS PERMITIDOS: "+JSON.stringify([jsxPath,cssPath]),
      "COMPONENTE: "+JSON.stringify(component),
      "DIREÇÃO GLOBAL: "+JSON.stringify({concept:plan.concept,creativeThesis:plan.creativeThesis,visualSystem:plan.visualSystem,designSystem:plan.designSystem,imageStrategy:plan.imageStrategy,responsiveStrategy:plan.responsiveStrategy,conversionStrategy:plan.conversionStrategy}),
      "VIZINHOS: "+JSON.stringify({previous:previous?{name:previous.name,role:previous.role,visualHook:previous.visualHook}:null,next:next?{name:next.name,role:next.role,visualHook:next.visualHook}:null}),
      "MANIFESTO ESTRUTURAL SOMENTE PARA CONTEXTO: "+JSON.stringify(editContext),
      "ORÇAMENTO DO PATCH: altere no máximo "+patchBudget.maxChangedLines+" linhas somando adições e remoções. Se não couber, preserve mais código e faça um diff menor.",
      "CONTRATO DE PRESERVAÇÃO: mantenha imports, export default, diretiva use client, IDs/âncoras e classes existentes que não precisem mudar. Arquivos e componentes fora do escopo são somente leitura.",
      "DADOS VERIFICADOS: "+JSON.stringify(facts(site)),
      "ARQUIVO ATUAL "+jsxPath+":\n"+clean(currentSource.jsx,18000),
      "ARQUIVO ATUAL "+cssPath+":\n"+clean(currentSource.css,24000),
      errors.length?"ERROS DA TENTATIVA ANTERIOR. Reescreva apenas o diff problemático e não repita o erro:\n- "+errors.join("\n- "):"",
      "Formato obrigatório: --- a/"+jsxPath+" / +++ b/"+jsxPath+" e/ou --- a/"+cssPath+" / +++ b/"+cssPath+" com hunks @@. Use o menor diff que resolva o pedido."
    ].filter(Boolean).join("\n\n")
  };
}
async function generateComponentPatch(site,plan,component,currentSource,instruction,initialErrors=[]){
  const jsxPath="components/"+component.name+"/"+component.name+".jsx";
  const cssPath="components/"+component.name+"/"+component.name+".module.css";
  let errors=[...initialErrors];
  for(let attempt=0;attempt<3;attempt++){
    const result=await generateWithDefaultProvider(componentPatchRequest(site,plan,component,currentSource,instruction,errors));
    try{
      const applied=applyUnifiedDiff({[jsxPath]:currentSource.jsx,[cssPath]:currentSource.css},result.text,[jsxPath,cssPath]);
      const candidate=normalizeComponentSource({jsx:applied.files[jsxPath],css:applied.files[cssPath]});
      const preservation=validatePatchPreservation(currentSource,candidate,instruction,{changedLines:applied.changedLines});
      if(!preservation.ok){errors=preservation.errors.map(error=>"Preservação: "+error);continue}
      const validation=validateComponent(component.name,candidate);
      if(validation.length){errors=validation.map(error=>"Validação: "+error);continue}
      return{source:candidate,patch:{attempts:attempt+1,changedPaths:applied.changedPaths,changedLines:applied.changedLines,patchBudget:preservation.budget.maxChangedLines,preservationChecked:true}};
    }catch(error){errors=[clean(error.message,1800)]}
  }
  throw new Error("A IA não conseguiu produzir um diff aplicável para "+component.name+" após 3 tentativas: "+errors.join(" | "));
}

function fallbackComponent(component){
  const name=component.name,role=component.role;
  let body="";
  let importAction="";
  if(role==="hero"){
    importAction='"use client";\n\nimport { actionHref } from "../../lib/siteActions.js";\n';
    body='<section className={styles.root} id="top"><div className={styles.content}><p className={styles.kicker}>{site.eyebrow}</p><h1>{site.heroTitle}</h1><p>{site.heroText}</p><a className={styles.cta} href={actionHref(site.ctas?.primary?.action, site)}>{site.ctas?.primary?.label || "Falar agora"}</a></div>{site.images?.[0] ? <img className={styles.image} src={site.images[0]} alt={site.brandName} /> : null}</section>';
  }else if(role==="footer"){
    body='<footer className={styles.root}><strong>{site.brandName}</strong><span>{site.city || ""}</span></footer>';
  }else if(role==="mobile-cta"){
    importAction='"use client";\n\nimport { actionHref } from "../../lib/siteActions.js";\n';
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
async function generateComponent(site,plan,component,skipAi,initialNotes=[],onAttempt=null,onDegraded=null){
  if(skipAi)return fallbackComponent(component);
  let errors=[...initialNotes];
  for(let attempt=0;attempt<2;attempt++){
    let result;
    try{result=await generateWithDefaultProvider({...componentRequest(site,plan,component,errors),onAttempt})}
    catch(error){
      const message=String(error?.message||error);
      if(["AI_TOOL_CALLS","AI_EMPTY_RESPONSE"].includes(error?.code)||/tempo limite|timeout|HTTP (429|502|503|504)/i.test(message)){await onDegraded?.({component:component.name,reason:message});return fallbackComponent(component)}
      throw error;
    }
    let source;
    try{source=normalizeComponentSource(parseComponent(result.text))}catch(error){errors=[error.message];continue}
    errors=validateComponent(component.name,source);
    if(!errors.length)return source;
  }
  await onDegraded?.({component:component.name,reason:"Resposta inválida do worker."});
  return fallbackComponent(component);
}
async function concurrent(items,limit,fn){
  const output=new Array(items.length);let cursor=0;
  async function worker(){while(true){const index=cursor++;if(index>=items.length)return;output[index]=await fn(items[index],index)}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return output;
}
function actionLib(){
  return 'export function actionHref(actionInput, siteInput = {}) {\n  let action = actionInput;\n  let site = siteInput;\n  if (actionInput && typeof actionInput === "object" && typeof siteInput === "string") { site = actionInput; action = siteInput; }\n  else if (actionInput && typeof actionInput === "object" && actionInput.action) { action = actionInput.action; site = siteInput || {}; }\n  if (action === "whatsapp" && site.whatsapp) return "https://wa.me/" + site.whatsapp;\n  if (action === "phone" && site.phone) return "tel:" + String(site.phone).replace(/[^+\\d]/g, "");\n  if (action === "instagram" && site.instagram) return site.instagram;\n  if (action === "maps" && site.mapsLink) return site.mapsLink;\n  return "#contato";\n}\n';
}
function seoLib(){
  return 'function numeric(value){const raw=String(value??"").replace(/\\./g,"").replace(",",".");const parsed=Number(raw);return Number.isFinite(parsed)?parsed:null}\nexport function localBusinessJsonLd(site={}){\n  const data={"@context":"https://schema.org","@type":"LocalBusiness",name:site.brandName||undefined,address:site.address||undefined,telephone:site.phone||undefined};\n  if(site.instagram)data.sameAs=[site.instagram];\n  const rating=numeric(site.rating),reviews=numeric(site.reviews);\n  if(rating&&reviews)data.aggregateRating={"@type":"AggregateRating",ratingValue:rating,reviewCount:reviews};\n  return Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined&&value!==""));\n}\n';
}
function pageSource(plan){
  const imports=plan.components.map(function(item){return 'import '+item.name+' from "../components/'+item.name+'/'+item.name+'.jsx";'}).join("\n");
  const body=plan.components.map(function(item){return '      <div className="leadflow-component-marker" data-leadflow-component="'+item.name+'"><'+item.name+' site={siteData} /></div>';}).join("\n");
  return 'import siteData from "../data/siteData.js";\nimport { localBusinessJsonLd } from "../lib/siteSeo.js";\n'+imports+'\n\nexport default function Home() {\n  const jsonLd=localBusinessJsonLd(siteData);\n  return (\n    <>\n      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}} />\n'+body+'\n    </>\n  );\n}\n';
}
function fontConfig(pair){
  const configs={
    editorial:{imports:"Cormorant_Garamond, Manrope",display:'Cormorant_Garamond({ subsets: ["latin"], weight: ["500","600","700"], variable: "--font-display" })',body:'Manrope({ subsets: ["latin"], variable: "--font-body" })'},
    modern:{imports:"Space_Grotesk, Manrope",display:'Space_Grotesk({ subsets: ["latin"], variable: "--font-display" })',body:'Manrope({ subsets: ["latin"], variable: "--font-body" })'},
    geometric:{imports:"Montserrat, Inter",display:'Montserrat({ subsets: ["latin"], weight: ["500","600","700","800"], variable: "--font-display" })',body:'Inter({ subsets: ["latin"], variable: "--font-body" })'},
    humanist:{imports:"Fraunces, DM_Sans",display:'Fraunces({ subsets: ["latin"], variable: "--font-display" })',body:'DM_Sans({ subsets: ["latin"], variable: "--font-body" })'},
    luxury:{imports:"Playfair_Display, Manrope",display:'Playfair_Display({ subsets: ["latin"], weight: ["500","600","700"], variable: "--font-display" })',body:'Manrope({ subsets: ["latin"], variable: "--font-body" })'}
  };
  return configs[pair]||configs.modern;
}
function inspectorScript(){
  return '(function(){if(new URLSearchParams(location.search).get("leadflowInspect")!=="1")return;var current=null;function marker(event){return event.target&&event.target.closest?event.target.closest("[data-leadflow-component]"):null}function clear(){if(current)current.classList.remove("leadflow-inspect-selected");current=null}document.addEventListener("mouseover",function(event){var item=marker(event);if(item)item.classList.add("leadflow-inspect-hover")},true);document.addEventListener("mouseout",function(event){var item=marker(event);if(item)item.classList.remove("leadflow-inspect-hover")},true);document.addEventListener("click",function(event){var item=marker(event);if(!item)return;event.preventDefault();event.stopPropagation();clear();current=item;item.classList.add("leadflow-inspect-selected");window.top.postMessage({type:"leadflow:component-selected",component:item.getAttribute("data-leadflow-component")},"*")},true);window.addEventListener("keydown",function(event){if(event.key==="Escape"){clear();window.top.postMessage({type:"leadflow:component-selected",component:""},"*")}})})();';
}
function layoutSource(site){
  const fonts=fontConfig(site.design?.fontPair);
  const title=site.seoTitle||site.brandName||"Site",description=site.seoDescription||site.heroText||"";
  const theme=site.design?.colors?.primary||"#17324D";
  return 'import { '+fonts.imports+' } from "next/font/google";\nimport "./globals.css";\nimport styles from "./theme.module.css";\n\nconst displayFont = '+fonts.display+';\nconst bodyFont = '+fonts.body+';\n\nexport const metadata = { title: '+JSON.stringify(title)+', description: '+JSON.stringify(description)+', robots:{index:true,follow:true}, openGraph:{title:'+JSON.stringify(title)+',description:'+JSON.stringify(description)+',type:"website",locale:"pt_BR"}, twitter:{card:"summary",title:'+JSON.stringify(title)+',description:'+JSON.stringify(description)+'} };\nexport const viewport = { width:"device-width", initialScale:1, viewportFit:"cover", themeColor:'+JSON.stringify(theme)+' };\n\nexport default function RootLayout({ children }) {\n  const inspector=process.env.NODE_ENV==="development";\n  return <html lang="pt-BR"><body className={displayFont.variable + " " + bodyFont.variable + " " + styles.body}>{children}{inspector ? <script src="/leadflow-inspector.js" defer /> : null}</body></html>;\n}\n';
}
function globalsCss(){return '*{box-sizing:border-box}html{scroll-behavior:smooth}html,body{margin:0;padding:0;min-height:100%;width:100%;max-width:100%;overflow-x:hidden}body{min-width:0}img,svg{max-width:100%}button,a,input,textarea,select{font:inherit}button,a{touch-action:manipulation}.leadflow-component-marker{display:contents}.leadflow-inspect-hover>*{outline:2px dashed rgba(37,99,235,.72)!important;outline-offset:-2px}.leadflow-inspect-selected>*{outline:3px solid #2563eb!important;outline-offset:-3px}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}'}
function themeCss(site,plan){return codegenThemeCss(site,plan)}
function packageSource(folderName){return JSON.stringify({name:folderName,version:"1.0.0",private:true,scripts:{dev:"next dev",build:"next build",start:"next start"},dependencies:{next:"latest",react:"latest","react-dom":"latest"}},null,2)}
function readme(site,plan){return '# '+(site.brandName||"Site")+'\n\nProjeto exclusivo gerado pelo LeadFlow para este lead.\n\nStack: Next latest, React latest, JavaScript JSX, CSS Modules, sem Tailwind, sem TypeScript e sem CSS inline.\n\nCada seção possui sua própria pasta em components, com JSX e module.css.\n\nConceito: '+plan.concept+'\n\nPara executar: npm install e depois npm run dev.\n\nAntes de publicar, confirme os dados comerciais com o cliente.\n'}
async function clearCode(root){for(const name of ["app","components","data","lib"])await fs.rm(path.join(root,name),{recursive:true,force:true})}
async function writeProject(root,folderName,site,plan,sources){
  await clearCode(root);
  for(const name of ["app","components","data","lib","public"])await fs.mkdir(path.join(root,name),{recursive:true});
  const writes=[
    fs.writeFile(path.join(root,"app","layout.jsx"),layoutSource(site),"utf8"),
    fs.writeFile(path.join(root,"app","page.jsx"),pageSource(plan),"utf8"),
    fs.writeFile(path.join(root,"app","globals.css"),globalsCss(),"utf8"),
    fs.writeFile(path.join(root,"app","theme.module.css"),themeCss(site,plan),"utf8"),
    fs.writeFile(path.join(root,"data","siteData.js"),'const siteData = '+JSON.stringify(site,null,2)+';\n\nexport default siteData;\n',"utf8"),
    fs.writeFile(path.join(root,"lib","siteActions.js"),actionLib(),"utf8"),
    fs.writeFile(path.join(root,"lib","siteSeo.js"),seoLib(),"utf8"),
    fs.writeFile(path.join(root,"package.json"),packageSource(folderName),"utf8"),
    fs.writeFile(path.join(root,"next.config.mjs"),'import path from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst projectRoot=path.dirname(fileURLToPath(import.meta.url));\nconst nextConfig={distDir:process.env.LEADFLOW_BUILD_DIST_DIR||".next",outputFileTracingRoot:projectRoot};\nexport default nextConfig;\n',"utf8"),
    fs.writeFile(path.join(root,"public","leadflow-inspector.js"),inspectorScript(),"utf8"),
    fs.writeFile(path.join(root,"README.md"),readme(site,plan),"utf8"),
    fs.writeFile(path.join(root,"generation-format.json"),JSON.stringify({format:"unique-codegen-v4",generatedAt:new Date().toISOString(),plan},null,2),"utf8"),
    fs.writeFile(path.join(root,".gitignore"),"node_modules\n.next\n.leadflow-build\n.env*\n","utf8")
  ];
  for(let i=0;i<plan.components.length;i++){
    const item=plan.components[i],source=sources[i],dir=path.join(root,"components",item.name);
    await fs.mkdir(dir,{recursive:true});
    writes.push(fs.writeFile(path.join(dir,item.name+".jsx"),source.jsx,"utf8"));
    writes.push(fs.writeFile(path.join(dir,item.name+".module.css"),source.css,"utf8"));
  }
  await Promise.all(writes);
}
async function reviewSources(site,plan,sources,progress){
  const snapshot=plan.components.map(function(component,index){
    return {name:component.name,role:component.role,jsx:clean(sources[index]?.jsx,3200),css:clean(sources[index]?.css,4200)};
  });
  const result=await generateWithDefaultProvider({
    model:roleModel("review"),siteRole:"review",siteVariant:site.siteVariant||"leadflow",
    temperature:.22,
    maxTokens:5000,
    timeoutMs:Number(process.env.LEADFLOW_SITE_TIMEOUT_REVIEW_MS||90000),
    retries:1,
    systemPrompt:[
      "Você é o revisor final de uma agência premium.",
      "Revise o site como produto comercial real, não como exercício de código.",
      "Procure aparência genérica, repetição de cards, baixa personalidade, problemas de hierarquia, mobile fraco, CTA escondido, acessibilidade e inconsistência entre componentes.",
      "Avalie a proposta como prévia comercial; conteúdo demonstrativo é permitido e não deve ser penalizado.",
      "Retorne somente JSON válido no formato solicitado."
    ].join(" "),
    prompt:[
      "DIREÇÃO: "+JSON.stringify({concept:plan.concept,creativeThesis:plan.creativeThesis,conversionStrategy:plan.conversionStrategy,visualSystem:plan.visualSystem,imageStrategy:plan.imageStrategy,motionStrategy:plan.motionStrategy,responsiveStrategy:plan.responsiveStrategy,designSystem:plan.designSystem}),
      "DADOS: "+JSON.stringify(facts(site)),
      "COMPONENTES: "+JSON.stringify(snapshot),
      "Retorne: "+JSON.stringify({pass:true,issues:[{component:"Nome",severity:"high",instruction:"Correção objetiva para este componente"}]})
    ].join("\n\n")
  });
  let data;
  data=await parseJsonWithRepair(result.text,"review",progress);
  if(!data || typeof data.pass!=="boolean" || !Array.isArray(data.issues))throw new Error("O reviewer retornou uma revisão sem o contrato esperado.");
  const known=new Set(plan.components.map(function(item){return item.name}));
  const severityOrder={high:0,medium:1};
  const valid=(Array.isArray(data.issues)?data.issues:[]).filter(function(issue){
    return known.has(issue?.component)&&["high","medium"].includes(String(issue?.severity||"").toLowerCase())&&clean(issue?.instruction,1200);
  }).sort(function(a,b){return severityOrder[String(a.severity).toLowerCase()]-severityOrder[String(b.severity).toLowerCase()]});
  const grouped=new Map();
  for(const issue of valid){
    if(!grouped.has(issue.component))grouped.set(issue.component,[]);
    grouped.get(issue.component).push("["+String(issue.severity).toUpperCase()+"] "+clean(issue.instruction,1200));
  }
  return [...grouped.entries()].slice(0,5).map(function(entry){
    return {component:entry[0],note:"REVISÃO FINAL CONSOLIDADA:\n- "+entry[1].join("\n- ")};
  });
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
  let page="";
  try{page=await fs.readFile(path.join(root,"app","page.jsx"),"utf8")}catch{errors.push("app/page.jsx ausente")}
  for(const required of ["app/layout.jsx","app/theme.module.css","data/siteData.js","lib/siteActions.js","lib/siteSeo.js"]){
    try{await fs.access(path.join(root,...required.split("/")))}catch{errors.push(required+" ausente")}
  }
  for(const item of plan.components){
    if(page&&!page.includes("../components/"+item.name+"/"+item.name+".jsx"))errors.push("page.jsx não importa "+item.name);
    if(page&&!page.includes('data-leadflow-component="'+item.name+'"'))errors.push("page.jsx não marca "+item.name+" para inspeção");
    try{
      const jsx=await fs.readFile(path.join(root,"components",item.name,item.name+".jsx"),"utf8");
      const css=await fs.readFile(path.join(root,"components",item.name,item.name+".module.css"),"utf8");
      errors.push(...validateComponent(item.name,{jsx,css}).map(function(error){return item.name+": "+error}));
    }catch{errors.push("Componente incompleto: "+item.name)}
  }
  return errors;
}
async function resolveBuildNext(root){
  const generatedNext=path.join(root,"node_modules","next","dist","bin","next");
  const rootNext=path.join(process.cwd(),"node_modules","next","dist","bin","next");
  try{await fs.access(generatedNext);return generatedNext}catch{return rootNext}
}
async function cleanupBuildArtifacts(root){await fs.rm(path.join(root,".leadflow-build"),{recursive:true,force:true})}
async function runBuild(root){
  const nextBin=await resolveBuildNext(root);
  await cleanupBuildArtifacts(root);
  try{
    const result=await execFileAsync(process.execPath,[nextBin,"build"],{cwd:root,timeout:180000,maxBuffer:3*1024*1024,env:{...process.env,NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",LEADFLOW_BUILD_DIST_DIR:".leadflow-build"}});
    return{ok:true,log:(result.stdout||"")+"\n"+(result.stderr||""),nextBin};
  }catch(error){
    await cleanupBuildArtifacts(root);
    return{ok:false,log:clean((error.stdout||"")+"\n"+(error.stderr||"")+"\n"+error.message,80000),nextBin};
  }
}

export async function generateUniqueSiteCode(options={}){
  const progress=async event=>{try{await options.onProgress?.(event)}catch{}};
  const folderPath=options.folderPath,folderName=options.folderName,site=options.siteData||{},skipAi=Boolean(options.skipAi);
  const root=path.resolve(process.cwd(),folderPath);
  const visualImages=Array.isArray(options.visualImages)?options.visualImages.filter(item=>item?.dataUrl).slice(0,6):[];
  let plan;
  if(skipAi)plan=fallbackPlan(site);
  else{
    await progress({phase:"architecture",title:"Projetando arquitetura",detail:"A IA está decidindo a composição e os componentes únicos deste site."});
    const request=architectureRequest(site,options.instruction||"",options.currentPlan||null,visualImages); request.siteVariant=site.siteVariant||"leadflow";
    request.onAttempt=event=>progress({phase:"ai",title:event.status==="success"?"Arquiteto respondeu":event.status==="error"?"Arquiteto falhou — fallback":"Chamando arquiteto",detail:[event.model,event.elapsedMs?Math.round(event.elapsedMs/1000)+"s":"",event.error||""].filter(Boolean).join(" · "),kind:"model"});
    let firstError=null,result=null;
    try{
      result=await generateWithDefaultProvider(request);
      plan=normalizePlan(await parseJsonWithRepair(result.text,"review",progress),site);
    }catch(error){firstError=error}
    if(!plan){
      await progress({phase:"architecture",title:"Arquiteto saiu do formato esperado",detail:"Executando nova tentativa stateless com contrato JSON estrito."});
      try{
        result=await generateWithDefaultProvider({...request,temperature:0.35,disableTools:true,maxTokens:12000,systemPrompt:request.systemPrompt+" ATENÇÃO: retorne exclusivamente um objeto JSON estrito iniciado por { e terminado por }, sem ferramentas, cercas, comentários ou texto adicional.",prompt:request.prompt+"\n\nNova tentativa: responda somente com o objeto JSON solicitado."});
        plan=normalizePlan(await parseJsonWithRepair(result.text,"review",progress),site);
      }catch(secondError){
        await progress({phase:"architecture",title:"Arquitetura de contingência ativada",detail:"O provider não entregou arquitetura utilizável. O Builder continuará com um plano determinístico compatível com o contrato "+(site.productContract?.type||"do site")+".",kind:"fallback"});
        plan=fallbackPlan(site);
      }
    }
  }
  plan=normalizePlan(plan,site);
  await progress({phase:"architecture",title:"Arquitetura definida",detail:plan.components.length+" componentes planejados."});
  applyPlanCopy(site,plan);
  const componentConcurrency=Math.max(1,Math.min(3,Number(process.env.LEADFLOW_SITE_COMPONENT_CONCURRENCY||2)));
  const sources=await concurrent(plan.components,componentConcurrency,async function(component){await progress({phase:"code",title:"Criando "+component.name,detail:component.role||"Gerando JSX e CSS Module.",file:"components/"+component.name+"/"+component.name+".jsx"});const source=await generateComponent(site,plan,component,skipAi,[],event=>progress({phase:"ai",title:event.status==="success"?component.name+" · modelo concluiu":event.status==="error"?component.name+" · modelo falhou":component.name+" · chamando modelo",detail:[event.model,event.elapsedMs?Math.round(event.elapsedMs/1000)+"s":"",event.error||""].filter(Boolean).join(" · "),kind:"model",file:"components/"+component.name+"/"+component.name+".jsx"}),event=>progress({phase:"code",title:component.name+" · fallback seguro",detail:"O worker não respondeu ou retornou código inválido. O pipeline preservou a geração usando o plano arquitetural.",kind:"fallback",file:"components/"+component.name+"/"+component.name+".jsx"}));await progress({phase:"code",title:component.name+" concluído",detail:"JSX e CSS Module gerados.",file:"components/"+component.name+"/"+component.name+".module.css",code:String(source.jsx||"").slice(0,2200)});return source});
  if(!skipAi){
    await progress({phase:"review",title:"Revisando código",detail:"O reviewer está procurando inconsistências antes do build."});
    let review=[];
    try{review=await reviewSources(site,plan,sources,progress)}catch(error){
      await progress({phase:"review",title:"Revisão por IA indisponível",detail:"Os componentes foram preservados. As validações de engenharia continuam; revisão por IA pendente. "+clean(error?.message,250),kind:"fallback"});
    }
    if(review.length){
      await concurrent(review,2,async function(issue){
        const index=plan.components.findIndex(function(item){return item.name===issue.component});
        if(index<0)return;
        sources[index]=await generateComponent(site,plan,plan.components[index],false,[issue.note]);
      });
    }
  }
  await progress({phase:"files",title:"Montando estrutura de arquivos",detail:"Escrevendo app, componentes, estilos, dados e configuração.",file:"app/page.jsx"});
  await writeProject(root,folderName,site,plan,sources);
  let errors=await validateProject(root,plan);
  if(errors.length)throw new Error("Projeto reprovado pelas regras de engenharia: "+errors.join(" | "));
  let build={ok:true,log:"Build ignorado."};
  if(options.validateBuild!==false&&!skipAi){
    await progress({phase:"build",title:"Executando Next.js build",detail:"Validando imports, sintaxe, renderização e bundle."});
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
    if(!build.ok){
      await cleanupBuildArtifacts(root);
      throw new Error("O código foi gerado, mas falhou no build automático: "+clean(build.log,3500));
    }
  }

  let quality={available:false,pass:true,score:null,threshold:Number(process.env.LEADFLOW_SITE_QUALITY_MIN_SCORE||78),judgeUsed:false,skippedReason:skipAi?"Auditoria visual ignorada no modo de teste/fallback.":"Build visual não executado."};
  if(build.ok&&!skipAi&&options.visualQa!==false){
    await progress({phase:"qa",title:"Abrindo site no Chromium",detail:"Auditando desktop e mobile no navegador real."});
    quality=await runVisualQualityAudit({root,nextBin:build.nextBin||await resolveBuildNext(root),site,plan});
    const repair=quality.available
      ? quality.issues.filter(issue=>["high","medium"].includes(issue.severity)).slice(0,4)
      : [];
    if(repair.length){
      await progress({phase:"repair",title:"Autocorreção visual",detail:repair.length+" ajuste(s) encontrados pelo reviewer visual."});
      await concurrent(repair,2,async function(issue){
        const index=plan.components.findIndex(item=>item.name===issue.component);
        if(index<0)return;
        const note="AUDITORIA VISUAL DO SITE RENDERIZADO ["+issue.severity.toUpperCase()+"]: "+issue.instruction+(issue.evidence?" Evidência: "+issue.evidence:"");
        sources[index]=await generateComponent(site,plan,plan.components[index],false,[note]);
      });
      const affected=[...new Set(repair.map(issue=>issue.component))];
      await rewriteComponents(root,plan,sources,affected);
      errors=await validateProject(root,plan);
      if(errors.length){
        await cleanupBuildArtifacts(root);
        throw new Error("Projeto reprovado após correção visual: "+errors.join(" | "));
      }
      build=await runBuild(root);
      if(!build.ok){
        await cleanupBuildArtifacts(root);
        throw new Error("A correção visual quebrou o build: "+clean(build.log,3500));
      }
      const second=await runVisualQualityAudit({root,nextBin:build.nextBin||await resolveBuildNext(root),site,plan});
      quality={...second,attempts:2,initialScore:quality.score,initialSummary:quality.summary||""};
    }else quality={...quality,attempts:quality.available?1:0};
  }
  if(quality.available&&quality.hardFailure){
    await cleanupBuildArtifacts(root);
    const evidence=(quality.issues||[]).filter(issue=>issue.severity==="high").slice(0,4).map(issue=>issue.component+": "+issue.instruction).join(" | ");
    throw new Error("O site ainda apresenta falha objetiva no render após a autocorreção e não será entregue como pronto. "+clean(evidence||quality.summary,2600));
  }
  await progress({phase:"qa",title:"Validação concluída",detail:quality.available&&quality.score!==null?"QA visual: "+quality.score+"/100":"Validações de engenharia concluídas."});
  await cleanupBuildArtifacts(root);
  return{plan,format:"unique-codegen-v4",buildOk:build.ok,quality};
}

export async function refineUniqueSiteComponent(options={}){
  const progress=async event=>{try{await options.onProgress?.(event)}catch{}};
  const root=path.resolve(process.cwd(),options.folderPath||"");
  const site=options.siteData||{};
  const plan=normalizePlan(options.currentPlan||site.codegenPlan||{},site);
  const name=clean(options.componentName,80);
  const instruction=clean(options.instruction,5000);
  const index=plan.components.findIndex(item=>item.name===name);
  if(index<0)throw new Error("O componente selecionado não existe mais na arquitetura atual.");
  if(!instruction)throw new Error("Descreva o que deve mudar no componente selecionado.");
  const component=plan.components[index],dir=path.join(root,"components",name);
  const jsxPath=path.join(dir,name+".jsx"),cssPath=path.join(dir,name+".module.css");
  let currentJsx="",currentCss="";
  try{currentJsx=await fs.readFile(jsxPath,"utf8");currentCss=await fs.readFile(cssPath,"utf8")}catch{throw new Error("Não foi possível carregar o componente selecionado.")}
  const siteDataPath=path.join(root,"data","siteData.js"),reportFile=path.join(root,"generation-report.json");
  return withFileTransaction([jsxPath,cssPath,siteDataPath,reportFile],async function(){
  await progress({phase:"code",title:"Refinando "+name,detail:"O agente está preparando um patch incremental preservando o restante do componente.",file:"components/"+name+"/"+name+".jsx"});
  let patchResult=await generateComponentPatch(site,plan,component,{jsx:currentJsx,css:currentCss},instruction);
  let source=patchResult.source;
  const patchHistory=[{phase:"user",...patchResult.patch}];
  await fs.writeFile(jsxPath,source.jsx,"utf8");
  await fs.writeFile(cssPath,source.css,"utf8");
  let errors=await validateProject(root,plan);
  if(errors.length)throw new Error("Refinamento reprovado: "+errors.join(" | "));
  let build=await runBuild(root);
  if(!build.ok){
    patchResult=await generateComponentPatch(site,plan,component,source,"Corrija somente os problemas de build sem desfazer a alteração solicitada pelo usuário.",["BUILD FALHOU: "+clean(build.log,2200)]);
    source=patchResult.source;patchHistory.push({phase:"build",...patchResult.patch});
    await fs.writeFile(jsxPath,source.jsx,"utf8");
    await fs.writeFile(cssPath,source.css,"utf8");
    errors=await validateProject(root,plan);
    if(errors.length){await cleanupBuildArtifacts(root);throw new Error("Refinamento reprovado após correção: "+errors.join(" | "))}
    build=await runBuild(root);
  }
  if(!build.ok){await cleanupBuildArtifacts(root);throw new Error("O refinamento direcionado falhou no build: "+clean(build.log,3500))}
  let quality=await runVisualQualityAudit({root,nextBin:build.nextBin||await resolveBuildNext(root),site,plan});
  const ownIssue=quality.available?quality.issues.find(issue=>issue.component===name&&["high","medium"].includes(issue.severity)):null;
  if(ownIssue){
    patchResult=await generateComponentPatch(site,plan,component,source,"Corrija o problema encontrado na auditoria visual preservando a alteração aprovada e todo o restante do componente.",["AUDITORIA DO RENDER: "+ownIssue.instruction+(ownIssue.evidence?" Evidência: "+ownIssue.evidence:"")]);
    source=patchResult.source;patchHistory.push({phase:"visual",...patchResult.patch});
    await fs.writeFile(jsxPath,source.jsx,"utf8");
    await fs.writeFile(cssPath,source.css,"utf8");
    errors=await validateProject(root,plan);
    if(errors.length){await cleanupBuildArtifacts(root);throw new Error("Autocorreção visual reprovada: "+errors.join(" | "))}
    build=await runBuild(root);
    if(!build.ok){await cleanupBuildArtifacts(root);throw new Error("A autocorreção visual falhou no build: "+clean(build.log,3500))}
    const second=await runVisualQualityAudit({root,nextBin:build.nextBin||await resolveBuildNext(root),site,plan});
    quality={...second,attempts:2,initialScore:quality.score,initialSummary:quality.summary||""};
  }else quality={...quality,attempts:quality.available?1:0};
  if(quality.available&&quality.hardFailure){
    await cleanupBuildArtifacts(root);
    const evidence=(quality.issues||[]).filter(issue=>issue.severity==="high").slice(0,4).map(issue=>issue.component+": "+issue.instruction).join(" | ");
    throw new Error("O refinamento ainda apresenta falha objetiva no render e foi bloqueado. "+clean(evidence||quality.summary,2600));
  }
  await cleanupBuildArtifacts(root);
  site.codegenPlan=plan;
  site.codegenQuality=quality;
  await fs.writeFile(siteDataPath,'const siteData = '+JSON.stringify(site,null,2)+';\n\nexport default siteData;\n',"utf8");
  try{
    const report=JSON.parse(await fs.readFile(reportFile,"utf8"));
    report.codegenPlan=plan;report.codegenQuality=quality;report.codegenBuildOk=true;report.lastTargetedRefinement={component:name,instruction,editingStrategy:"validated-unified-diff",patchHistory,at:new Date().toISOString()};
    await fs.writeFile(reportFile,JSON.stringify(report,null,2),"utf8");
  }catch{}
  return{plan,quality,buildOk:true,componentName:name,editingStrategy:"validated-unified-diff-atomic",patchHistory,atomic:true};
  });
}

export async function hardenUniqueCodegenProject(folderPath){
  const root=path.resolve(process.cwd(),folderPath);
  let changed=0;
  try{
    await cleanupBuildArtifacts(root);
    const componentsRoot=path.join(root,"components");
    const dirs=await fs.readdir(componentsRoot,{withFileTypes:true});
    for(const dir of dirs){
      if(!dir.isDirectory())continue;
      const jsxPath=path.join(componentsRoot,dir.name,dir.name+".jsx");
      try{
        const original=await fs.readFile(jsxPath,"utf8");
        const normalized=normalizeComponentSource({jsx:original,css:""}).jsx;
        if(normalized!==original.trim()){
          await fs.writeFile(jsxPath,normalized+"\n","utf8");
          changed++;
        }
      }catch{}
    }
    const libDir=path.join(root,"lib");
    await fs.mkdir(libDir,{recursive:true});
    await fs.mkdir(path.join(root,"public"),{recursive:true});
    await fs.writeFile(path.join(root,"public","leadflow-inspector.js"),inspectorScript(),"utf8");
    const actionsPath=path.join(libDir,"siteActions.js");
    const expectedActions=actionLib();
    let currentActions="";
    try{currentActions=await fs.readFile(actionsPath,"utf8")}catch{}
    if(currentActions!==expectedActions){
      await fs.writeFile(actionsPath,expectedActions,"utf8");
      changed++;
    }
    await enforceLatestPackage(folderPath);
  }catch{}
  return {changed};
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
