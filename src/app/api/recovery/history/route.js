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
  const headers={"X-API-Key":key,Accept:"application/json"};
  const liveUrl=new URL(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(chatId)}/history`);
  liveUrl.searchParams.set("limit","100");
  liveUrl.searchParams.set("includeMedia","false");
  let messages=[],total=0,source="";
  const live=await fetch(liveUrl,{headers,cache:"no-store",signal:abort.signal});
  if(live.ok){
    const data=await live.json();
    const rows=Array.isArray(data)?data:Array.isArray(data?.messages)?data.messages:[];
    messages=rows.filter(m=>m.chatId===chatId&&!m.isGroup).map(m=>({id:m.id,direction:m.fromMe===true?"outgoing":"incoming",body:String(m.body||"").slice(0,4000),type:m.type,timestamp:Number.isFinite(m.timestamp)?m.timestamp:null,status:null}));
    total=messages.length;
    source="Histórico ao vivo do WhatsApp, limitado às 100 mensagens recentes.";
  }else{
    const url=new URL(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages`);
    url.searchParams.set("chatId",chatId);url.searchParams.set("limit","100");url.searchParams.set("offset","0");url.searchParams.set("inlineMedia","false");
    const response=await fetch(url,{headers,cache:"no-store",signal:abort.signal});
    if(!response.ok)throw Error(`Histórico ao vivo HTTP ${live.status}; arquivo local HTTP ${response.status}`);
    const data=await response.json();
    messages=(Array.isArray(data.messages)?data.messages:[]).filter(m=>m.chatId===chatId).map(m=>({id:m.id,direction:m.direction,body:String(m.body||"").slice(0,4000),type:m.type,timestamp:Number.isFinite(m.timestamp)?m.timestamp:null,status:m.status}));
    total=Number(data.total)||messages.length;
    source=`Arquivo local: consulta ao vivo indisponível (HTTP ${live.status}). Pode faltar a abordagem original.`;
  }
  return NextResponse.json({messages,analysis:auditConversation(messages,total),source});
 }catch(e){return NextResponse.json({error:e.name==="AbortError"?"Consulta de histórico excedeu 20 segundos.":e.message},{status:502});}
 finally{clearTimeout(timer)}
}
