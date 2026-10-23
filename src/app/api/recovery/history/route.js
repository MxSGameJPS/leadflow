import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma.js";
import { auditConversation } from "../../../../services/recovery/historyAudit.js";
export const runtime="nodejs";
export async function GET(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Auditoria disponível somente na instalação local de desenvolvimento."},{status:403});
 const sessionId=process.env.OPENWA_SESSION_ID?.trim();
 const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,"");
 const key=process.env.OPENWA_API_KEY?.trim();
 const chatId=new URL(request.url).searchParams.get("chatId")||"";
 if(!sessionId||!base||!key||!chatId||chatId.length>128||!/@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId))return NextResponse.json({error:"Configuração ou conversa inválida."},{status:400});
 const link=await prisma.whatsAppLeadLink.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
 if(!link)return NextResponse.json({error:"Vincule manualmente este chat antes da auditoria."},{status:403});
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),20000);
 try{
  const url=new URL(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages`);
  url.searchParams.set("chatId",chatId);url.searchParams.set("limit","100");url.searchParams.set("offset","0");url.searchParams.set("orderBy","timestamp");
  const response=await fetch(url,{headers:{"X-API-Key":key,Accept:"application/json"},cache:"no-store",signal:abort.signal});
  if(!response.ok)throw Error("OpenWA respondeu HTTP "+response.status);
  const data=await response.json();
  const messages=(Array.isArray(data.messages)?data.messages:[]).filter(m=>m.chatId===chatId).map(m=>({id:m.id,direction:m.direction,body:String(m.body||"").slice(0,4000),type:m.type,timestamp:Number.isFinite(m.timestamp)?m.timestamp:null,status:m.status}));
  return NextResponse.json({messages,analysis:auditConversation(messages,Number(data.total)||messages.length),source:"Histórico armazenado no OpenWA; pode estar incompleto."});
 }catch(e){return NextResponse.json({error:e.name==="AbortError"?"Consulta de histórico excedeu 20 segundos.":e.message},{status:502});}
 finally{clearTimeout(timer)}
}
