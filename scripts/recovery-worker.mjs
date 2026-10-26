import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {PrismaClient} from "@prisma/client";
import {getRecoveryRest} from "../src/services/recovery/workSchedule.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
for(const name of [".env",".env.local"]){
 const filename=path.join(root,name);if(!fs.existsSync(filename))continue;
 for(const line of fs.readFileSync(filename,"utf8").split(/\r?\n/)){
  const match=line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
  if(!match||process.env[match[1]]!==undefined)continue;
  let value=match[2].trim();
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  process.env[match[1]]=value;
 }
}
const prisma=new PrismaClient();
const sessionId=process.env.OPENWA_SESSION_ID?.trim();
const lock=path.join(root,".recovery-worker.lock");
let lockFd;
try{
 lockFd=fs.openSync(lock,"wx");
}catch(e){
 if(e.code!=="EEXIST")throw e;
 const oldPid=Number(fs.readFileSync(lock,"utf8").trim());
 let active=false;
 if(Number.isInteger(oldPid)&&oldPid>0){try{process.kill(oldPid,0);active=true}catch(error){if(error.code!=="ESRCH")active=true}}
 if(active)throw Error("Monitor de expediente já está executando (PID "+oldPid+").");
 fs.unlinkSync(lock);
 lockFd=fs.openSync(lock,"wx");
}
fs.writeSync(lockFd,String(process.pid));
let running=true,abortSleep=null;
function stop(){running=false;abortSleep?.();}
process.on("SIGINT",stop);process.on("SIGTERM",stop);
const nap=ms=>new Promise(resolve=>{
 const timer=setTimeout(resolve,ms);
 abortSleep=()=>{clearTimeout(timer);resolve();};
});
// Disabled unless explicitly opted in. This process never generates or approves messages.
async function dispatchOne(){
 const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,"");
 const key=process.env.OPENWA_API_KEY?.trim();
 if(!base||!key){console.error("[envio] OpenWA não configurado.");return}
 // Never proceed while an outcome is uncertain: an earlier HTTP timeout may have sent.
 const uncertain=await prisma.recoveryDispatch.count({where:{sessionId,status:{in:["uncertain","sending"]}}});
 if(uncertain){console.error("[envio] Bloqueado: há envio incerto ou em andamento.");return}
 const today=new Date();
 const day=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
 const count=await prisma.recoveryDispatch.count({where:{sessionId,dayKey:day,status:{in:["reserved","sending","sent","uncertain","externally_sent"]}}});
 if(count>=10){console.error("[envio] Limite diário de 10 atingido.");return}
 const reservations=await prisma.recoveryDispatch.findMany({where:{sessionId,status:"reserved"},orderBy:{createdAt:"asc"}});
 let candidate=null;
 for(const item of reservations){
  const decision=await prisma.recoveryDecision.findUnique({where:{id:item.decisionId}});
  if(decision?.status==="message_approved"&&decision.consentConfirmed&&!decision.sentAt&&decision.messageText===item.messageSnapshot){
   candidate=item;break;
  }
  console.error("[envio] Reserva inválida ignorada, sem enviar:",item.id);
 }
 if(!candidate){console.log("[envio] Nenhuma reserva elegível entre",reservations.length,"reservas.");return;}
 if(candidate.dayKey!==day)console.log("[envio] Reserva antiga aprovada será contabilizada no dia do envio:",candidate.id);
 const latest=await prisma.recoveryDecision.findFirst({where:{sessionId,sentAt:{not:null}},orderBy:{sentAt:"desc"},select:{sentAt:true,chatId:true}});
 const snapshot=latest?await prisma.recoveryFollowupSnapshot.findUnique({where:{sessionId_chatId:{sessionId,chatId:latest.chatId}},select:{latestReplyAt:true}}):null;
 let lastReplyAt=snapshot?.latestReplyAt;
 if(latest?.sentAt&&(!lastReplyAt||new Date(lastReplyAt)<=latest.sentAt)){
  try{lastReplyAt=await findLatestLiveReply(latest.chatId,latest.sentAt)}catch(e){console.error("[envio] Não foi possível confirmar resposta:",e.message);return}
 }
 const schedule=getRecoveryRest({lastSentAt:latest?.sentAt,lastReplyAt});
 if(!schedule.working||schedule.resting)return;
 if(!getRecoveryRest({lastSentAt:latest?.sentAt,lastReplyAt}).working)return;
 // SQLite updateMany is our atomic claim; never retry sending/uncertain records.
 const claimed=await prisma.recoveryDispatch.updateMany({where:{id:candidate.id,status:"reserved"},data:{status:"sending",dayKey:day}});
 if(claimed.count!==1)return;
 console.log("[envio] Mensagem aprovada reservada, destino:",candidate.chatId);
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  let response;
  try{
   response=await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,{
    method:"POST",headers:{"X-API-Key":key,"Idempotency-Key":candidate.id,"Content-Type":"application/json"},
    body:JSON.stringify({chatId:candidate.chatId,text:candidate.messageSnapshot,linkPreview:false}),signal:controller.signal,cache:"no-store"
   });
  }finally{clearTimeout(timer)}
  if(!response.ok)throw Error("OpenWA HTTP "+response.status);
  await prisma.$transaction(async tx=>{
   await tx.recoveryDispatch.update({where:{id:candidate.id},data:{status:"sent"}});
   await tx.recoveryDecision.update({where:{id:candidate.decisionId},data:{status:"sent",sentAt:new Date()}});
   await tx.recoveryDecisionAudit.create({data:{decisionId:candidate.decisionId,action:"sent",previousStatus:"message_approved",reason:"Envio agendado autorizado por configuração local explícita e mensagem previamente aprovada."}});
  });
  console.log("[envio] Confirmado:",candidate.chatId);
 }catch(e){
  await prisma.recoveryDispatch.update({where:{id:candidate.id},data:{status:"uncertain"}}).catch(()=>{});
  console.error("[envio] RESULTADO INCERTO. Envio automático bloqueado até revisão:",e.message);
 }
}

async function findLatestLiveReply(chatId,sentAt){
 const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,""),key=process.env.OPENWA_API_KEY?.trim();
 if(!base||!key)return null;
 const url=new URL(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(chatId)}/history`);
 url.searchParams.set("limit","100");url.searchParams.set("includeMedia","false");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(url,{headers:{"X-API-Key":key,Accept:"application/json"},signal:controller.signal,cache:"no-store"});
  if(!res.ok)throw Error("OpenWA HTTP "+res.status);
  const payload=await res.json(),rows=Array.isArray(payload)?payload:Array.isArray(payload?.messages)?payload.messages:[];
  const replies=rows.filter(m=>m.chatId===chatId&&!m.isGroup&&m.fromMe===false&&Number.isFinite(m.timestamp)&&m.timestamp>sentAt.getTime()/1000);
  if(!replies.length)return null;
  return new Date(Math.max(...replies.map(m=>m.timestamp))*1000);
 }finally{clearTimeout(timer)}
}
async function check(){
 if(!sessionId){console.log("[expediente] OPENWA_SESSION_ID ausente.");return;}
 const latest=await prisma.recoveryDecision.findFirst({where:{sessionId,sentAt:{not:null}},orderBy:{sentAt:"desc"},select:{chatId:true,sentAt:true}});
 const snapshot=latest?await prisma.recoveryFollowupSnapshot.findUnique({where:{sessionId_chatId:{sessionId,chatId:latest.chatId}},select:{latestReplyAt:true}}):null;
 let lastReplyAt=snapshot?.latestReplyAt;
 if(latest?.sentAt&&(!lastReplyAt||new Date(lastReplyAt)<=latest.sentAt)){
  try{
   const live=await findLatestLiveReply(latest.chatId,latest.sentAt);
   if(live){lastReplyAt=live;
    await prisma.recoveryFollowupSnapshot.updateMany({where:{sessionId,chatId:latest.chatId},data:{latestReplyAt:live}}); 
   }
  }catch(e){console.error("[expediente] Consulta da resposta não confirmada:",e.message)}
 }
 const state=getRecoveryRest({lastSentAt:latest?.sentAt,lastReplyAt});
 const pending=await prisma.recoveryDispatch.count({where:{sessionId,status:"reserved"}});
 if(process.env.LEADFLOW_RECOVERY_AUTO_SEND==="true"&&state.working&&!state.resting&&pending>0)await dispatchOne();
 const phase=!state.working?"dormindo":state.resting?"descansando":"em expediente";
 if(state.working&&pending>0&&process.env.LEADFLOW_RECOVERY_AUTO_SEND!=="true")console.log("[expediente] Envios pendentes, mas despacho automático desativado.");
 console.log("[expediente]",new Date().toLocaleString(),phase,"reservas:",pending,state.restUntil?"retorno: "+new Date(state.restUntil).toLocaleTimeString():"");
}
try{
 console.log("[expediente] Relógio local Windows; 08h–18h; pausa de 30 min. Envio automático: "+(process.env.LEADFLOW_RECOVERY_AUTO_SEND==="true"?"ATIVADO por configuração local":"DESATIVADO"));
 while(running){try{await check()}catch(e){console.error("[expediente]",e.message)}if(running)await nap(60000)}
}finally{
 await prisma.$disconnect();
 try{fs.closeSync(lockFd);fs.unlinkSync(lock)}catch{}
}
