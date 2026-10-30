import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {generateResilientWithDefaultProvider} from "../../../../services/ai/providerService.js";
export const runtime="nodejs";
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Apenas ambiente local."},{status:403});
 try{
  const input=await request.json();
  const subject=String(input.subject||"").trim().slice(0,1200);
  const details=String(input.details||"").trim().slice(0,1600);
  const audience=String(input.audience||"").trim().slice(0,250);
  const format=["image","carousel","video","text"].includes(input.format)?input.format:"image";
  const platforms=Array.isArray(input.platforms)?[...new Set(input.platforms.filter(x=>["instagram","facebook"].includes(x)))]:[];
  if(subject.length<8||!platforms.length)return NextResponse.json({error:"Descreva o assunto ou promoção e selecione ao menos uma rede."},{status:400});
  if(format==="text"&&platforms.includes("instagram"))return NextResponse.json({error:"Post somente texto pode ser publicado no Facebook, não no Instagram."},{status:400});
  const output=await generateResilientWithDefaultProvider({
   systemPrompt:"Você é redator e estrategista de social media brasileiro. Crie EXATAMENTE UM post avulso para o negócio descrito, sem elaborar calendário. Responda apenas um OBJETO JSON com title (até 100 caracteres), caption (até 1800 caracteres, com CTA e hashtags apropriadas), script (até 3500 caracteres: roteiro de vídeo, estrutura slide a slide de carrossel ou briefing visual completo para arte estática). Respeite rigorosamente o assunto, público, formato e redes informados. Não invente preços, porcentagens, prazos, condições de promoções ou afirmações factuais não fornecidas pelo usuário. Caso faltem condições ou valores, escreva uma copy sem inventá-los e inclua no roteiro quais detalhes devem ser confirmados. Você NÃO cria a mídia, NÃO agenda e NÃO publica. Português brasileiro.",
   prompt:JSON.stringify({subject,details,audience,format,platforms}),disableTools:true,timeoutMs:60000,retries:1
  });
  const raw=String(output.text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  let item;try{item=JSON.parse(raw)}catch{throw Error("A IA não retornou JSON válido. Tente novamente.")}
  if(!item||Array.isArray(item)||typeof item!=="object")throw Error("Resposta inválida do agente.");
  const title=String(item.title||"").trim().slice(0,100),caption=String(item.caption||"").trim().slice(0,1800),script=String(item.script||"").trim().slice(0,3500);
  if(!title||!caption||!script)throw Error("O agente retornou conteúdo incompleto. Tente novamente.");
  const post=await prisma.socialPost.create({data:{title,caption,script,mediaType:format,mediaJson:"[]",platformsJson:JSON.stringify(platforms),status:"draft"}});
  return NextResponse.json({post},{status:201});
 }catch(error){return NextResponse.json({error:String(error.message||error).slice(0,350)},{status:502})}
}
