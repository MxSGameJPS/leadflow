import { NextResponse } from "next/server";
import { decideRecovery } from "../../../../services/recovery/decisionStore.js";
export const runtime="nodejs";
export async function POST(request) {
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Operação local indisponível em produção sem autenticação."},{status:403});
 try {
  const {chatId,action,messageText,reason,consentConfirmed}=await request.json();
  const sessionId=process.env.OPENWA_SESSION_ID;
  if(!sessionId||typeof chatId!=="string"||chatId.length>128||!/@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId))return NextResponse.json({error:"Conversa inválida."},{status:400});
  if(!["eligible","ineligible","approve_and_queue","message_approved","message_rejected","close_approved","close_rejected"].includes(action))return NextResponse.json({error:"Ação inválida."},{status:400});
  const decision=await decideRecovery({sessionId,chatId,action,messageText,reason,consentConfirmed});
  return NextResponse.json({decision});
 }catch(e){return NextResponse.json({error:e.message||"Falha na decisão."},{status:400});}
}
