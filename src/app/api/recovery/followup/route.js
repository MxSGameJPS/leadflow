import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma.js";
export const runtime="nodejs";
const refusal=/\b(n[aã]o\s+(temos?|tenho|estamos|estou|queremos|quero)\s+interesse|sem\s+interesse|n[aã]o\s+interessa|pare\s+de\s+(me\s+)?enviar|n[aã]o\s+(me\s+)?mande|remova\s+(meu\s+)?contato)\b/i;
export async function GET(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Acompanhamento disponível somente no ambiente local."},{status:403});
 const sessionId=process.env.OPENWA_SESSION_ID?.trim();
 const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,"");
 const key=process.env.OPENWA_API_KEY?.trim();
 const chatId=new URL(request.url).searchParams.get("chatId")||"";
 if(!sessionId||!base||!key||!/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId))return NextResponse.json({error:"Configuração ou conversa inválida."},{status:400});
 const dispatch=await prisma.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
 if(!dispatch||dispatch.status!=="sent")return NextResponse.json({error:"Somente mensagens de recuperação confirmadas podem ser acompanhadas."},{status:400});
 const decision=await prisma.recoveryDecision.findUnique({where:{id:dispatch.decisionId}});
 if(!decision?.sentAt)return NextResponse.json({error:"Registro do envio ainda não confirmado."},{status:400});
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);
 try{
  const url=new URL(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(chatId)}/history`);
  url.searchParams.set("limit","100");url.searchParams.set("includeMedia","false");
  const response=await fetch(url,{headers:{"X-API-Key":key,Accept:"application/json"},cache:"no-store",signal:abort.signal});
  if(!response.ok)throw Error("Consulta ao vivo indisponível (HTTP "+response.status+").");
  const raw=await response.json();
  const rows=(Array.isArray(raw)?raw:Array.isArray(raw?.messages)?raw.messages:[]).filter(m=>m.chatId===chatId&&!m.isGroup);
  const sentSeconds=decision.sentAt.getTime()/1000;
  const incoming=rows.filter(m=>m.fromMe===false&&Number.isFinite(m.timestamp)&&m.timestamp>=sentSeconds-10).sort((a,b)=>a.timestamp-b.timestamp);
  const textMessages=incoming.filter(m=>String(m.body||"").trim()).map(m=>({text:String(m.body).slice(0,2000),timestamp:m.timestamp,type:m.type}));
  const refusalFound=textMessages.some(m=>refusal.test(m.text));
  const status=refusalFound?"possible_refusal":textMessages.length?"human_review":"no_text_reply_found";
  return NextResponse.json({status,suggestion:refusalFound?"Possível recusa explícita. Não enviar novamente; confira e aprove ou rejeite o encerramento.":textMessages.length?"Resposta identificada: revise o conteúdo antes de decidir o próximo passo.":"Nenhuma resposta textual após o envio encontrada nas últimas 100 mensagens consultadas.",messages:textMessages,nonTextCount:incoming.length-textMessages.length,decisionStatus:decision.status,source:"Histórico ao vivo do WhatsApp, até 100 mensagens; mensagens automáticas também podem aparecer."});
 }catch(e){return NextResponse.json({error:e.name==="AbortError"?"Consulta excedeu 20 segundos.":e.message},{status:502});}
 finally{clearTimeout(timer);}
}
