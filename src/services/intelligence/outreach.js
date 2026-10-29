import {prisma} from "../../lib/prisma.js";

// Indicadores conservadores: só atribuir uma objeção quando ela foi escrita pelo contato.
export function classifyReply(text){
 const t=String(text||"").toLowerCase();
 const rules=[
  ["opt_out",/pare de (me )?(mandar|enviar)|remova (meu )?contato|não me (mande|envie)|nao me (mande|envie)|não quero receber/],
  ["not_interested",/sem interesse|não tenho interesse|nao tenho interesse|não queremos|nao queremos|não preciso|nao preciso/],
  ["price_objection",/muito caro|está caro|esta caro|fora do (meu )?orçamento|sem verba|sem orçamento/],
  ["timing_objection",/outro momento|mês que vem|mes que vem|ano que vem|agora não|agora nao|mais pra frente|depois das férias/],
  ["existing_provider",/já temos (site|agência|agencia|fornecedor)|já possuo site|já tenho site|temos agência|temos agencia/],
  ["positive_intent",/tenho interesse|gostei|quero saber|me explica|quanto custa|qual o valor|pode mostrar|envia a prévia|manda a prévia|marcar (uma )?reunião/]
 ];
 for(const [category,pattern] of rules)if(pattern.test(t))return category;
 return "needs_review";
}
const validChat=id=>/^\d+@(c\.us|s\.whatsapp\.net|lid)$/.test(id);
export async function pollOutreachReplies({sessionId,limit=8}={}){
 if(!sessionId)throw Error("Sessão OpenWA não configurada.");
 const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,""),key=process.env.OPENWA_API_KEY?.trim();
 if(!base||!key)throw Error("Credenciais OpenWA não configuradas.");
 const [capture,recovery]=await Promise.all([
  prisma.captureApproval.findMany({where:{sessionId,status:"sent",sentAt:{not:null}},select:{leadId:true,chatId:true,messageText:true,sentAt:true}}),
  prisma.recoveryDispatch.findMany({where:{sessionId,status:"sent"},select:{chatId:true,messageSnapshot:true,decision:{select:{sentAt:true}}}})
 ]);
 const targets=[
  ...capture.map(x=>({channel:"capture",leadId:x.leadId,chatId:x.chatId,messageText:x.messageText,sentAt:x.sentAt})),
  ...recovery.filter(x=>x.decision?.sentAt).map(x=>({channel:"recovery",chatId:x.chatId,messageText:x.messageSnapshot,sentAt:x.decision.sentAt}))
 ].filter(x=>validChat(x.chatId));
 const existing=await prisma.outreachObservation.findMany({where:{sessionId},select:{channel:true,chatId:true,checkedAt:true}});
 const last=new Map(existing.map(x=>[x.channel+":"+x.chatId,x.checkedAt?.getTime()||0]));
 targets.sort((a,b)=>(last.get(a.channel+":"+a.chatId)||0)-(last.get(b.channel+":"+b.chatId)||0));
 const report={checked:0,replyFound:0,failed:0,total:targets.length};
 for(const target of targets.slice(0,Math.max(1,Math.min(limit,20)))){
  const where={sessionId_channel_chatId:{sessionId,channel:target.channel,chatId:target.chatId}};
  const baseData={sessionId,channel:target.channel,chatId:target.chatId,leadId:target.leadId||null,messageText:target.messageText||""};
  let data;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const url=new URL(base+"/api/sessions/"+encodeURIComponent(sessionId)+"/messages/"+encodeURIComponent(target.chatId)+"/history");
   url.searchParams.set("limit","100");url.searchParams.set("includeMedia","false");
   const res=await fetch(url,{headers:{"X-API-Key":key,Accept:"application/json"},signal:controller.signal,cache:"no-store"});
   if(!res.ok)throw Error("OpenWA HTTP "+res.status);
   const json=await res.json();
   const messages=Array.isArray(json)?json:Array.isArray(json?.messages)?json.messages:null;
   if(!messages)throw Error("Formato inesperado do histórico OpenWA");
   const incoming=messages.filter(m=>m.chatId===target.chatId&&!m.isGroup&&m.fromMe===false&&Number.isFinite(Number(m.timestamp))&&Number(m.timestamp)*1000>=target.sentAt.getTime()-10000).sort((a,b)=>Number(a.timestamp)-Number(b.timestamp));
   const latest=incoming.at(-1);
   const text=incoming.filter(m=>String(m.body||"").trim()).at(-1);
   data={...baseData,status:incoming.length?"replied":"no_reply_observed",category:text?classifyReply(text.body):incoming.length?"non_text_reply":"unclassified",evidence:text?String(text.body).slice(0,500):"",replyAt:latest?new Date(Number(latest.timestamp)*1000):null,checkedAt:new Date(),lastError:""};
   report.checked++;if(incoming.length)report.replyFound++;
  }catch(e){
   report.failed++;
   // Falha de consulta NÃO apaga uma resposta já registrada nem vira "sem resposta".
   const previous=await prisma.outreachObservation.findUnique({where});
   data={...baseData,status:previous?.status||"unverified",category:previous?.category||"unclassified",evidence:previous?.evidence||"",replyAt:previous?.replyAt||null,checkedAt:new Date(),lastError:String(e.message||e).slice(0,250)};
  }finally{clearTimeout(timer)}
  await prisma.outreachObservation.upsert({where,create:data,update:data});
 }
 return report;
}
