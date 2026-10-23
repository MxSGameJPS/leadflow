import { NextResponse } from "next/server";
import { getRecoveryQueue,reserveRecoveryForManualSend } from "../../../../services/recovery/queue.js";
export const runtime="nodejs";
export async function GET(){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Fila local indisponível em produção."},{status:403});
 return NextResponse.json(await getRecoveryQueue(process.env.OPENWA_SESSION_ID));
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Operação somente local."},{status:403});
 try{
  const {chatId}=await request.json();
  if(typeof chatId!=="string"||!/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId))return NextResponse.json({error:"Identificador inválido."},{status:400});
  const reservation=await reserveRecoveryForManualSend(process.env.OPENWA_SESSION_ID,chatId);
  return NextResponse.json({reservation,notice:"Somente reservado. Nenhuma mensagem foi enviada."});
 }catch(e){return NextResponse.json({error:e.message},{status:400})}
}
