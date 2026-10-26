import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma.js";
export const runtime="nodejs";
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Disponível somente na instalação local."},{status:403});
 try{
  const {chatId,latestReplyAt}=await request.json();
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  if(!sessionId||typeof chatId!=="string"||!/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId))return NextResponse.json({error:"Conversa inválida."},{status:400});
  const reviewedDate=new Date(latestReplyAt);
  if(!Number.isFinite(reviewedDate.getTime()))return NextResponse.json({error:"Data da resposta inválida."},{status:400});
  const snapshot=await prisma.recoveryFollowupSnapshot.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  if(!snapshot?.latestReplyAt||snapshot.latestReplyAt.getTime()!==reviewedDate.getTime())return NextResponse.json({error:"Chegou uma resposta mais recente ou a consulta está desatualizada. Atualize a página."},{status:409});
  const dispatch=await prisma.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  if(dispatch?.status!=="sent")return NextResponse.json({error:"Apenas envios confirmados podem ser revisados."},{status:403});
  await prisma.recoveryFollowupSnapshot.update({where:{sessionId_chatId:{sessionId,chatId}},data:{reviewedReplyAt:snapshot.latestReplyAt,reviewedAt:new Date()}});
  return NextResponse.json({reviewedReplyAt:snapshot.latestReplyAt,notice:"Resposta marcada como revisada. Nenhuma mensagem foi enviada e nenhuma decisão foi alterada."});
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:400})}
}
