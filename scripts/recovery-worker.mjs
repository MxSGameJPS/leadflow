import fs from "node:fs";
import {pollOutreachReplies} from "../src/services/intelligence/outreach.js";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {PrismaClient} from "@prisma/client";
import {getRecoveryRest} from "../src/services/recovery/workSchedule.js";
import {captureRunning} from "../src/services/capture/dispatchControl.js";

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
// Um único worker opera os dois canais e aplica a mesma janela de trabalho.
function dayKey(now=new Date()){return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0")}
async function globalState(){
 const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const recoveryCount=await prisma.recoveryDispatch.count({where:{sessionId,dayKey:dayKey(now),status:{in:["sending","sent","uncertain","externally_sent"]}}});
 const captureCount=await prisma.captureApproval.count({where:{sessionId,OR:[{status:"sent",sentAt:{gte:start}},{status:{in:["sending","uncertain"]},updatedAt:{gte:start}}]}});
 const recoveryLatest=await prisma.recoveryDecision.findFirst({where:{sessionId,sentAt:{not:null}},orderBy:{sentAt:"desc"},select:{sentAt:true,chatId:true}});
 const captureLatest=await prisma.captureApproval.findFirst({where:{sessionId,sentAt:{not:null}},orderBy:{sentAt:"desc"},select:{sentAt:true,chatId:true}});
 const latest=(!captureLatest?.sentAt||recoveryLatest?.sentAt>captureLatest.sentAt)?recoveryLatest:captureLatest;
 const latestFromRecovery=latest===recoveryLatest;
 let lastReplyAt=null;
 if(latestFromRecovery&&latest?.chatId){
  const snapshot=await prisma.recoveryFollowupSnapshot.findUnique({where:{sessionId_chatId:{sessionId,chatId:latest.chatId}},select:{latestReplyAt:true}});
  lastReplyAt=snapshot?.latestReplyAt||null;
 }
 return {recoveryCount,captureCount,latest,lastReplyAt,latestFromRecovery};
}
async function captureOne(){
 if(!captureRunning())return;
 const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,""),key=process.env.OPENWA_API_KEY?.trim();
 if(!sessionId||!base||!key)return;
 const conflict=await prisma.recoveryDispatch.count({where:{sessionId,status:{in:["sending","uncertain"]}}});
 const captureConflict=await prisma.captureApproval.count({where:{sessionId,status:{in:["sending","uncertain"]}}});
 if(conflict||captureConflict){console.error("[captação] Há envio em andamento/incerto; despacho bloqueado.");return}
 const state=await globalState();
 if(state.captureCount>=10){console.log("[captação] Limite diário próprio de 10 envios atingido.");return;}
 const schedule=getRecoveryRest({lastSentAt:state.latest?.sentAt,lastReplyAt:state.lastReplyAt});
 if(!schedule.working||schedule.resting)return;
 const rows=await prisma.captureApproval.findMany({where:{sessionId,status:"approved"},orderBy:{approvedAt:"asc"},take:30});
 for(const item of rows){
  if(!/^55\d{10,11}@c\.us$/.test(item.chatId)||!item.messageText?.trim())continue;
  const linkedChats=await prisma.whatsAppLeadLink.findMany({where:{leadId:item.leadId},select:{chatId:true}});
  const knownChatIds=[item.chatId,...linkedChats.map(link=>link.chatId)];
  const recovery=await prisma.recoveryDecision.count({where:{sessionId,chatId:{in:knownChatIds}}});
  const previouslySent=await prisma.recoveryDispatch.count({where:{sessionId,chatId:{in:knownChatIds}}});
  if(recovery||previouslySent){console.error("[captação] Contato consta na Recuperação, pulando:",item.leadId);continue}
  if(!captureRunning())return;
  const claimed=await prisma.captureApproval.updateMany({where:{id:item.id,status:"approved",messageText:item.messageText,chatId:item.chatId},data:{status:"sending"}});
  if(claimed.count!==1)continue;
  if(!captureRunning()){await prisma.captureApproval.updateMany({where:{id:item.id,status:"sending"},data:{status:"approved"}});return;}
  console.log("[captação] Enviando contato autorizado:",item.leadId);
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
   let response;
   try{response=await fetch(base+"/api/sessions/"+encodeURIComponent(sessionId)+"/messages/send-text",{
    method:"POST",headers:{"X-API-Key":key,"Idempotency-Key":"capture-"+item.id,"Content-Type":"application/json"},
    body:JSON.stringify({chatId:item.chatId,text:item.messageText,linkPreview:false}),signal:controller.signal,cache:"no-store"
   });}finally{clearTimeout(timer)}
   if(!response.ok)throw Error("OpenWA HTTP "+response.status);
   await prisma.captureApproval.update({where:{id:item.id},data:{status:"sent",sentAt:new Date()}});
   console.log("[captação] Confirmado:",item.leadId);
  }catch(e){
   await prisma.captureApproval.update({where:{id:item.id},data:{status:"uncertain"}}).catch(()=>{});
   console.error("[captação] Resultado incerto; envio suspenso até revisão:",e.message);
  }
  return;
 }
}
// Disabled unless explicitly opted in. This process never generates or approves messages.
async function dispatchOne(){
 const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,"");
 const key=process.env.OPENWA_API_KEY?.trim();
 if(!base||!key){console.error("[envio] OpenWA não configurado.");return}
 // Never proceed while an outcome is uncertain: an earlier HTTP timeout may have sent.
 const uncertain=await prisma.recoveryDispatch.count({where:{sessionId,status:{in:["uncertain","sending"]}}})+await prisma.captureApproval.count({where:{sessionId,status:{in:["uncertain","sending"]}}});
 if(uncertain){console.error("[envio] Bloqueado: há envio incerto ou em andamento.");return}
 const today=new Date();
 const day=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
 const count=await prisma.recoveryDispatch.count({where:{sessionId,dayKey:day,status:{in:["sending","sent","uncertain","externally_sent"]}}});
 if(count>=10){console.error("[envio] Limite diário da Recuperação de 10 envios atingido.");return}
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
 const captureForChat=await prisma.captureApproval.findFirst({where:{sessionId,chatId:candidate.chatId,status:{in:["approved","sending","sent","uncertain"]}}});
 if(captureForChat){console.error("[envio] Contato também está na Captação; revisão manual necessária:",candidate.chatId);return;}
 if(candidate.dayKey!==day)console.log("[envio] Reserva antiga aprovada será contabilizada no dia do envio:",candidate.id);
 const latest=await prisma.recoveryDecision.findFirst({where:{sessionId,sentAt:{not:null}},orderBy:{sentAt:"desc"},select:{sentAt:true,chatId:true}});
 const snapshot=latest?await prisma.recoveryFollowupSnapshot.findUnique({where:{sessionId_chatId:{sessionId,chatId:latest.chatId}},select:{latestReplyAt:true}}):null;
 let lastReplyAt=snapshot?.latestReplyAt;
 if(latest?.sentAt&&(!lastReplyAt||new Date(lastReplyAt)<=latest.sentAt)){
  try{lastReplyAt=await findLatestLiveReply(latest.chatId,latest.sentAt)}catch(e){console.error("[envio] Não foi possível confirmar resposta:",e.message);return}
 }
 const shared=await globalState();
 const schedule=getRecoveryRest({lastSentAt:shared.latest?.sentAt,lastReplyAt:shared.latestFromRecovery?lastReplyAt:null});
 if(!schedule.working||schedule.resting)return;
 if(!getRecoveryRest({lastSentAt:shared.latest?.sentAt,lastReplyAt:shared.latestFromRecovery?lastReplyAt:null}).working)return;
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
let lastOutreachScan=0;
async function check(){
 if(sessionId&&Date.now()-lastOutreachScan>5*60*1000){
  lastOutreachScan=Date.now();
  try{const result=await pollOutreachReplies({sessionId,limit:5});console.log("[inteligência] Monitoramento de respostas:",JSON.stringify(result));}
  catch(e){console.error("[inteligência] Monitoramento indisponível:",e.message)}
 }
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
 const shared=await globalState();
 const state=getRecoveryRest({lastSentAt:shared.latest?.sentAt,lastReplyAt:shared.latestFromRecovery?lastReplyAt:null});
 const pending=await prisma.recoveryDispatch.count({where:{sessionId,status:"reserved"}});
 if(state.working&&!state.resting){
  if(process.env.LEADFLOW_RECOVERY_AUTO_SEND==="true"&&pending>0&&shared.recoveryCount<10)await dispatchOne();
  else if(shared.captureCount<10)await captureOne();
 }
 const phase=!state.working?"dormindo":state.resting?"descansando":"em expediente";
 if(state.working&&pending>0&&process.env.LEADFLOW_RECOVERY_AUTO_SEND!=="true")console.log("[expediente] Envios pendentes, mas despacho automático desativado.");
 console.log("[expediente]",new Date().toLocaleString(),phase,"reservas:",pending,"captação aprovada:",await prisma.captureApproval.count({where:{sessionId,status:"approved"}}),"recuperação hoje:",shared.recoveryCount+"/10","captação hoje:",shared.captureCount+"/10",state.restUntil?"retorno: "+new Date(state.restUntil).toLocaleTimeString():"");
}
try{
 console.log("[expediente] Relógio local Windows; 08h–18h; pausa de 30 min. Recuperação: "+(process.env.LEADFLOW_RECOVERY_AUTO_SEND==="true"?"ATIVADA":"DESATIVADA")+"; Captação: "+(captureRunning()?"ATIVADA":"DESATIVADA"));
 while(running){try{await check()}catch(e){console.error("[expediente]",e.message)}if(running)await nap(60000)}
}finally{
 await prisma.$disconnect();
 try{fs.closeSync(lockFd);fs.unlinkSync(lock)}catch{}
}
