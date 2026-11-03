import {prisma} from "../../lib/prisma.js";

export const SECOND_ATTEMPT_WAIT_DAYS=5;
export const dayKey=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
export function addBusinessDays(value,days=SECOND_ATTEMPT_WAIT_DAYS){
 const date=new Date(value);let counted=0;
 while(counted<days){date.setDate(date.getDate()+1);if(date.getDay()!==0&&date.getDay()!==6)counted++;}
 return date;
}
export const validChat=id=>/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(String(id||""));
function refusal(text){return /(?:n[aã]o\s+(?:tenho|temos|quero|queremos)\s+interesse|sem\s+interesse|pare\s+de\s+(?:me\s+)?enviar|n[aã]o\s+me\s+mande|remova\s+meu\s+contato)/i.test(text)}
export async function getLiveHistory(sessionId,chatId){
 const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,""),key=process.env.OPENWA_API_KEY?.trim();
 if(!base||!key)throw Error("OpenWA não configurado.");
 const url=new URL(base+"/api/sessions/"+encodeURIComponent(sessionId)+"/messages/"+encodeURIComponent(chatId)+"/history");
 url.searchParams.set("limit","100");url.searchParams.set("includeMedia","false");
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(url,{headers:{"X-API-Key":key,Accept:"application/json"},signal:controller.signal,cache:"no-store"});
  if(!response.ok)throw Error("Histórico OpenWA HTTP "+response.status);
  const raw=await response.json(),items=Array.isArray(raw)?raw:Array.isArray(raw?.messages)?raw.messages:[];
  return items.filter(m=>m.chatId===chatId&&!m.isGroup&&typeof m.fromMe==="boolean"&&Number.isFinite(Number(m.timestamp))&&Number(m.timestamp)>0).map(m=>({...m,at:new Date(Number(m.timestamp)*1000)})).sort((a,b)=>a.at-b.at);
 }finally{clearTimeout(timeout)}
}
export function evaluateSecondAttempt({history,firstSentAt,now=new Date()}){
 const first=new Date(firstSentAt);
 if(!Number.isFinite(first.getTime()))return {status:"blocked",reason:"Data do primeiro envio indisponível."};
 if(!history.length)return {status:"blocked",reason:"Histórico WhatsApp indisponível ou vazio."};
 if(history.length>=100&&history[0].at.getTime()>first.getTime()+120000)return {status:"blocked",reason:"Histórico truncado; não é possível conferir as tentativas anteriores."};
 const after=history.filter(m=>m.at.getTime()>first.getTime()+120000);
 const replies=after.filter(m=>m.fromMe===false);
 const outgoing=after.filter(m=>m.fromMe===true);
 if(replies.some(m=>refusal(String(m.body||""))))return {status:"closed",reason:"Recusa identificada no histórico."};
 if(replies.length)return {status:"blocked",reason:"Lead já respondeu após o primeiro envio; acompanhamento comercial necessário."};
 if(outgoing.length)return {status:"closed",reason:"Já existe novo envio manual ou adicional após a primeira tentativa."};
 const lastOutgoing=history.filter(m=>m.fromMe===true).at(-1)?.at;
 if(!lastOutgoing||Math.abs(lastOutgoing.getTime()-first.getTime())>120000)return {status:"blocked",reason:"Primeiro envio não pôde ser confirmado no histórico WhatsApp."};
 const eligibleAt=addBusinessDays(lastOutgoing);
 return {status:now>=eligibleAt?"review":"waiting",reason:now>=eligibleAt?"Sem resposta: segunda tentativa pode ser revisada.":"Aguardando cinco dias úteis desde o último envio.",lastOutgoingAt:lastOutgoing,eligibleAt};
}
export async function inspectSecondAttempt({sessionId,chatId}){
 if(!sessionId||!validChat(chatId))throw Error("Conversa inválida.");
 const first=await prisma.recoveryDecision.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
 const dispatch=await prisma.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
 if(!first?.sentAt||dispatch?.status!=="sent")throw Error("Primeiro envio da recuperação não confirmado.");
 const existing=await prisma.recoverySecondAttempt.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
 if(existing&&["sending","sent","uncertain","closed"].includes(existing.status))return existing;
 const [outcome,commercial,history]=await Promise.all([
  prisma.recoveryOutcome.findUnique({where:{sessionId_chatId:{sessionId,chatId}}}),
  prisma.recoveryCommercial.findUnique({where:{sessionId_chatId:{sessionId,chatId}}}),
  getLiveHistory(sessionId,chatId)
 ]);
 const result=first.status==="close_approved"||first.status==="ineligible"||outcome||commercial?.phase?
  {status:"closed",reason:"Contato encerrado ou em negociação; não reenviar."}:
  evaluateSecondAttempt({history,firstSentAt:first.sentAt});
 const status=existing?.status==="approved"&&result.status==="review"?"approved":result.status;
 const payload={firstSentAt:first.sentAt,lastOutgoingAt:result.lastOutgoingAt||first.sentAt,checkedAt:new Date(),eligibleAt:result.eligibleAt||addBusinessDays(first.sentAt),status,reason:result.reason,messageText:existing?.messageText||"",approvedAt:status==="approved"?existing?.approvedAt:null};
 return prisma.recoverySecondAttempt.upsert({where:{sessionId_chatId:{sessionId,chatId}},create:{sessionId,chatId,...payload},update:payload});
}
export async function approveSecondAttempt({sessionId,chatId,messageText}){
 const text=String(messageText||"").trim();
 if(text.length<10||text.length>900)throw Error("Mensagem deve conter entre 10 e 900 caracteres.");
 // Recheck live messages at the moment of approval, never trust a cached decision.
 const inspected=await inspectSecondAttempt({sessionId,chatId});
 if(!["review","approved"].includes(inspected.status)||inspected.eligibleAt>new Date())throw Error("Histórico indica que a segunda tentativa não está elegível.");
 const changed=await prisma.recoverySecondAttempt.updateMany({where:{id:inspected.id,status:{in:["review","approved"]},checkedAt:inspected.checkedAt},data:{status:"approved",messageText:text,approvedAt:new Date()}});
 if(!changed.count)throw Error("Estado mudou; revise antes de aprovar.");
 return prisma.recoverySecondAttempt.findUnique({where:{id:inspected.id}});
}
