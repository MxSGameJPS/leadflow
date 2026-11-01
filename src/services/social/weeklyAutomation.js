import {prisma} from "../../lib/prisma.js";
import {socialWeeklyReport} from "./weeklyReport.js";
import {generateResilientWithDefaultProvider} from "../ai/providerService.js";

const monday=(when=new Date())=>{
 const d=new Date(when.getFullYear(),when.getMonth(),when.getDate());
 d.setDate(d.getDate()-((d.getDay()+6)%7));
 return d;
};
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");

export async function latestSocialWeeklyAnalysis(){
 const row=await prisma.socialWeeklyAnalysis.findFirst({where:{status:"ready"},orderBy:{weekStart:"desc"}});
 if(!row)return null;
 return {weekStart:row.weekStart,analysis:row.analysis,report:JSON.parse(row.reportJson),generatedAt:row.updatedAt.toISOString()};
}

export async function generateAndStoreSocialWeeklyAnalysis({weekStart,force=false}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart||"")))throw Error("Semana inválida.");
 const current=dateKey(monday());
 if(weekStart>=current)throw Error("Relatórios automáticos são gerados após o fechamento da semana.");
 const existing=await prisma.socialWeeklyAnalysis.findUnique({where:{weekStart}});
 if(existing?.status==="ready"&&!force)return {weekStart,status:"ready",skipped:true};
 const report=await socialWeeklyReport({startDate:weekStart});
 const response=await generateResilientWithDefaultProvider({
  systemPrompt:"Você é analista de marketing digital para um profissional que desenvolve sites e sistemas. Faça avaliação objetiva da semana concluída: evidências verificáveis, limitações dos dados, até cinco melhorias práticas para a próxima semana com público, gancho e CTA, e um teste mensurável. Jamais invente resultados, métricas ou clientes. Um valor null significa indisponível, não zero. Não atribua conversões de CRM a posts sem rastreamento. Diferencie métricas entre Facebook e Instagram. Use português brasileiro, texto simples e conciso.",
  prompt:JSON.stringify({period:{start:report.start,endExclusive:report.endExclusive},totals:report.totals,posts:report.rows.map(({title,platform,likes,comments,shares,saves,reach,views})=>({title,platform,likes,comments,shares,saves,reach,views})),errors:report.errors,notes:report.notes}),disableTools:true,timeoutMs:60000,retries:1,maxTokens:1100
 });
 const analysis=String(response.text||"").trim().slice(0,6500);
 if(!analysis)throw Error("A IA não retornou análise semanal.");
 await prisma.socialWeeklyAnalysis.upsert({where:{weekStart},create:{weekStart,reportJson:JSON.stringify(report),analysis,status:"ready"},update:{reportJson:JSON.stringify(report),analysis,status:"ready",error:""}});
 return {weekStart,status:"ready",generated:true};
}

export async function checkScheduledSocialWeeklyAnalysis(now=new Date()){
 // From Monday 09:00 onward, catch up when the Windows computer was powered off on Monday.
 if(now.getDay()===1&&now.getHours()<9)return {skipped:"outside_window"};
 const previous=monday(now);previous.setDate(previous.getDate()-7);
 return generateAndStoreSocialWeeklyAnalysis({weekStart:dateKey(previous)});
}
