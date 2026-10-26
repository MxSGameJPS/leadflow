import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma.js";
export const runtime="nodejs";
const states=["interested","preparing","ready","presented"];
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Operação somente local."},{status:403});
 try{
  const {chatId,status,previewUrl,notes}=await request.json();
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  if(!sessionId||typeof chatId!=="string"||!/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId)||!states.includes(status))return NextResponse.json({error:"Dados inválidos."},{status:400});
  const dispatch=await prisma.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  const decision=dispatch&&await prisma.recoveryDecision.findUnique({where:{id:dispatch.decisionId}});
  if(dispatch?.status!=="sent"||!decision||decision.status==="close_approved")return NextResponse.json({error:"Contato sem envio confirmado ou encerrado."},{status:403});
  const existing=await prisma.recoveryPreview.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  const order={interested:0,preparing:1,ready:2,presented:3};
  if(existing&&order[status]<order[existing.status])return NextResponse.json({error:"Não é permitido retroceder a etapa já registrada."},{status:409});
  const safeUrl=String(previewUrl||existing?.previewUrl||"").trim();
  if(safeUrl.length>1000)return NextResponse.json({error:"URL muito longa."},{status:400});
  if(safeUrl){const parsed=new URL(safeUrl);if(!["https:","http:"].includes(parsed.protocol))return NextResponse.json({error:"URL inválida."},{status:400})}
  if(["ready","presented"].includes(status)&&!safeUrl)return NextResponse.json({error:"Informe o link da prévia antes de marcar como pronta."},{status:400});
  const data={status,previewUrl:safeUrl,notes:String(notes||"").slice(0,1000),updatedAt:new Date()};
  const result=await prisma.recoveryPreview.upsert({where:{sessionId_chatId:{sessionId,chatId}},create:{sessionId,chatId,...data},update:data});
  return NextResponse.json({preview:result,notice:"Etapa atualizada manualmente. Nenhuma mensagem foi enviada."});
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:400})}
}
