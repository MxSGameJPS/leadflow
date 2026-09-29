import { generateWithDefaultProvider,generateWithProvider } from "./providerService.js";

const FIELDS=["budget","authority","need","timeline","metrics","economicBuyer","decisionCriteria","decisionProcess","pain","champion"];
function clean(v,max=5000){return String(v??"").replace(/\u0000/g,"").trim().slice(0,max)}
function parse(raw){const s=clean(raw,30000).replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"");let o;try{o=JSON.parse(s)}catch{const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)try{o=JSON.parse(s.slice(a,b+1))}catch{}}if(!o||typeof o!=="object")throw new Error("A IA não retornou o plano de qualificação em JSON válido.");return o}
function evidence(workspace){return (workspace?.evidenceClaims||[]).filter(x=>["applied","suggested"].includes(x.status)).slice(0,40).map(x=>({field:x.field,value:x.value,status:x.status,band:x.band,score:x.score,method:x.method}))}
export function buildQualificationCopilotPrompt({lead={},workspace={}}={}){
 const qualification=workspace.qualification||{};
 const systemPrompt=[
 "Você é um copiloto brasileiro de vendas consultivas especializado em descoberta BANT e MEDDIC.",
 "Ajude o vendedor a DESCOBRIR informações faltantes; nunca invente respostas para preencher qualificação.",
 "Diferencie rigorosamente fato confirmado, evidência observada, hipótese e desconhecido.",
 "Dados de Google/website/social podem sustentar contexto, mas orçamento, autoridade, processo decisório e prazo só são confirmados quando houver evidência adequada ou fala do cliente.",
 "Não pressione, manipule ou crie urgência artificial. Sugira perguntas naturais, uma por vez, adequadas ao estágio.",
 "Retorne SOMENTE JSON válido, sem markdown.",
 'Formato: {"summary":"...","nextBestQuestion":"...","nextBestReason":"...","items":[{"field":"budget|authority|need|timeline|metrics|economicBuyer|decisionCriteria|decisionProcess|pain|champion","label":"...","state":"confirmed|evidence|hypothesis|unknown","known":"...","why":"...","question":"...","channel":"WhatsApp|Ligação|Reunião","priority":1}]}'
 ].join(" ");
 const context={lead:{name:clean(lead.name,180),segment:clean(lead.segment,120),city:clean(lead.city,120),stage:clean(lead.stage,50),problem:clean(lead.problem,1200),offer:clean(lead.offer,1200),nextAction:clean(lead.nextAction,800),notes:clean(lead.notes,2500),site:clean(lead.site,500),instagram:clean(lead.instagram,500),googleRating:lead.googleRating,googleReviews:lead.googleReviews},qualification,evidence:evidence(workspace),recentActivities:(workspace.activities||[]).slice(0,15).map(x=>({type:x.type,title:x.title,detail:x.detail,createdAt:x.createdAt}))};
 return{systemPrompt,prompt:"Crie o plano de descoberta deste lead com base SOMENTE no contexto abaixo. Priorize as lacunas que mais destravam a próxima conversa.\n\n"+JSON.stringify(context,null,2)};
}
export async function generateQualificationCopilot(input={}){
 const request=buildQualificationCopilotPrompt(input),result=input.providerId?await generateWithProvider(String(input.providerId),request):await generateWithDefaultProvider(request),data=parse(result.text);
 const items=(Array.isArray(data.items)?data.items:[]).filter(x=>FIELDS.includes(x?.field)).slice(0,10).map((x,i)=>({field:x.field,label:clean(x.label,80)||x.field,state:["confirmed","evidence","hypothesis","unknown"].includes(x.state)?x.state:"unknown",known:clean(x.known,1200),why:clean(x.why,1000),question:clean(x.question,1200),channel:["WhatsApp","Ligação","Reunião"].includes(x.channel)?x.channel:"WhatsApp",priority:Number.isFinite(Number(x.priority))?Number(x.priority):i+1})).sort((a,b)=>a.priority-b.priority);
 return{summary:clean(data.summary,1800),nextBestQuestion:clean(data.nextBestQuestion,1200),nextBestReason:clean(data.nextBestReason,1000),items,providerName:result.providerName,model:result.model,generatedAt:new Date().toISOString()};
}
