import {parseSocialJson} from "../../../../services/social/parseAiJson.js";
import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {generateResilientWithDefaultProvider} from "../../../../services/ai/providerService.js";
import {latestSocialWeeklyAnalysis} from "../../../../services/social/weeklyAutomation.js";
export const runtime="nodejs";
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Apenas ambiente local."},{status:403});
 try{
  const data=await request.json(),count=Math.max(1,Math.min(7,Number(data.count)||5));
  const start=String(data.start||"").slice(0,10);
  const date=new Date(start+"T12:00:00");
  if(!start||!Number.isFinite(date.getTime()))return NextResponse.json({error:"Informe data inicial válida."},{status:400});
  const goal=String(data.goal||"Crescimento orgânico com autoridade e conversão em conversas qualificadas sobre sites e sistemas").slice(0,350);
  const existing=await prisma.socialPost.findMany({where:{scheduledAt:{gte:new Date(date.getTime()-86400000),lte:new Date(date.getTime()+14*86400000)}},select:{title:true,scheduledAt:true},take:50});
  const latest=await latestSocialWeeklyAnalysis();
  const response=await generateResilientWithDefaultProvider({
   systemPrompt:"Você é estrategista e redator do Social Media de Saulo Pavanello, desenvolvedor de sites e sistemas. Monte um calendário de conteúdo ORIGINAL, educativo e comercial, em português brasileiro. Você escreve apenas copy e roteiro de produção: NUNCA cria mídias, nem publica. Não invente clientes, métricas, cases ou promessas. Responda SOMENTE JSON como array com exatamente o número de itens solicitado. Cada item: title (até 100 caracteres), format (image|carousel|video|text), platforms (array com instagram e/ou facebook), caption (até 1800 caracteres; gancho, benefício, CTA leve e hashtags), script (roteiro de vídeo, estrutura de slides ou briefing da arte, até 3500 caracteres), dayOffset (inteiro >=0 a <14), hour (inteiro 8 a 20). Você é responsável por uma estratégia de marketing orgânico voltada a atrair comerciantes e prestadores de serviços e iniciar conversas comerciais qualificadas. Distribua os conteúdos entre descoberta (dor ou pergunta real do público), educação prática (ensinamento útil e concreto), autoridade verificável (processo de trabalho e exemplos reais, sem clientes fictícios) e conversão (CTA específico para contato ou diagnóstico). Para cada conteúdo, o roteiro deve começar com Objetivo: descoberta, educação, autoridade ou conversão; Hipótese de interesse; Gancho; Conteúdo visual passo a passo; CTA; Métrica para acompanhar (comentários relevantes, salvamentos, visitas ao perfil ou contatos, conforme objetivo). Prefira ganchos específicos a frases genéricas. Não prometa alcance nem engajamento. Alterne formatos, não repita pautas nem invente números, promessas ou clientes. Inclua CTA relevante e o site https://www.saulopavanello.com.br/ quando apropriado. Evite publicações somente texto no Instagram. Caso exista uma análise da semana anterior, use-a como contexto para testar melhorias nos próximos conteúdos sem assumir causalidade ou repetir formatos sem evidência.",
   prompt:JSON.stringify({count,goal,topics:String(data.topics||"").slice(0,600),targetAudience:String(data.audience||"pequenos e médios negócios").slice(0,250),alreadyPlanned:existing.map(p=>({title:p.title,date:p.scheduledAt?.toISOString()})),previousWeekAnalysis:latest?{period:latest.weekStart,analysis:latest.analysis.slice(0,3500),metrics:latest.report.totals}:null}),
   disableTools:true,timeoutMs:90000,retries:1,maxTokens:6500
  });
  let items;
  try{items=parseSocialJson(response.text,{array:true})}catch{
   const repaired=await generateResilientWithDefaultProvider({systemPrompt:"Retorne SOMENTE um array JSON válido de posts. Cada item deve conter title,format,platforms,caption,script,dayOffset,hour. Não invente dados, apenas reformate e preserve o conteúdo original.",prompt:JSON.stringify({count,original:String(response.text||"").slice(0,22000)}),disableTools:true,timeoutMs:45000,retries:0,maxTokens:5000});
   items=parseSocialJson(repaired.text,{array:true});
  }
  if(!Array.isArray(items)||items.length!==count)throw Error("A IA retornou quantidade inválida de publicações.");
  const formats=new Set(["image","carousel","video","text"]),posts=[];
  for(const item of items){
   const mediaType=formats.has(item.format)?item.format:"image",platforms=Array.isArray(item.platforms)?[...new Set(item.platforms.filter(x=>x==="instagram"||x==="facebook"))]:[];
   if(!platforms.length)platforms.push("instagram","facebook");
   if(mediaType==="text"){const i=platforms.indexOf("instagram");if(i>=0)platforms.splice(i,1);if(!platforms.length)platforms.push("facebook")}
   const offset=Math.max(0,Math.min(13,Math.floor(Number(item.dayOffset)||0))),hour=Math.max(8,Math.min(20,Math.floor(Number(item.hour)||12)));
   const local=new Date(date);local.setDate(local.getDate()+offset);local.setHours(hour,0,0,0);
   posts.push({title:String(item.title||"Conteúdo planejado").slice(0,100),caption:String(item.caption||"").slice(0,1800),script:String(item.script||"").slice(0,3500),mediaType,mediaJson:"[]",platformsJson:JSON.stringify(platforms),scheduledAt:local,status:"draft"});
  }
  if(posts.some(x=>!x.caption.trim()))throw Error("A IA retornou uma legenda vazia.");
  const result=await prisma.$transaction(posts.map(data=>prisma.socialPost.create({data})));
  return NextResponse.json({created:result.length,posts:result});
 }catch(e){return NextResponse.json({error:String(e.message||e).slice(0,350)},{status:502})}
}
