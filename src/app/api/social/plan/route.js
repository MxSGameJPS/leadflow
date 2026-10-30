import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {generateResilientWithDefaultProvider} from "../../../../services/ai/providerService.js";
export const runtime="nodejs";
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Apenas ambiente local."},{status:403});
 try{
  const data=await request.json(),count=Math.max(1,Math.min(7,Number(data.count)||5));
  const start=String(data.start||"").slice(0,10);
  const date=new Date(start+"T12:00:00");
  if(!start||!Number.isFinite(date.getTime()))return NextResponse.json({error:"Informe data inicial válida."},{status:400});
  const goal=String(data.goal||"Autoridade e geração de conversas para criação de sites").slice(0,350);
  const response=await generateResilientWithDefaultProvider({
   systemPrompt:"Você é estrategista e redator do Social Media de Saulo Pavanello, desenvolvedor de sites e sistemas. Monte um calendário de conteúdo ORIGINAL, educativo e comercial, em português brasileiro. Você escreve apenas copy e roteiro de produção: NUNCA cria mídias, nem publica. Não invente clientes, métricas, cases ou promessas. Responda SOMENTE JSON como array com exatamente o número de itens solicitado. Cada item: title (até 100 caracteres), format (image|carousel|video|text), platforms (array com instagram e/ou facebook), caption (até 1800 caracteres; gancho, benefício, CTA leve e hashtags), script (roteiro de vídeo, estrutura de slides ou briefing da arte, até 3500 caracteres), dayOffset (inteiro >=0 a <14), hour (inteiro 8 a 20). Varie os temas e evite publicações somente texto no Instagram.",
   prompt:JSON.stringify({count,goal,topics:String(data.topics||"").slice(0,600),targetAudience:String(data.audience||"pequenos e médios negócios").slice(0,250)}),
   disableTools:true,timeoutMs:60000,retries:1
  });
  const raw=String(response.text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  let items;try{items=JSON.parse(raw)}catch{throw Error("A IA não retornou um calendário JSON válido.")}
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
