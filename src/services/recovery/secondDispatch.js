import {prisma} from "../../lib/prisma.js";
import {getLiveHistory,evaluateSecondAttempt,dayKey} from "./secondAttempt.js";
import {getRecoveryRest} from "./workSchedule.js";
import {recoveryRunning} from "./dispatchControl.js";
export async function dispatchSecondAttempt({sessionId,lastSentAt,lastReplyAt}){
 if(!sessionId||!recoveryRunning()||new Date().getDay()===0)return false;
 const schedule=getRecoveryRest({lastSentAt,lastReplyAt});
 if(!schedule.working||schedule.resting)return false;
 const today=dayKey();
 const [usedFirst,usedSecond,firstActive,secondActive,captureActive]=await Promise.all([
  prisma.recoveryDispatch.count({where:{sessionId,dayKey:today,status:{in:["sending","sent","uncertain","externally_sent"]}}}),
  prisma.recoverySecondAttempt.count({where:{sessionId,dayKey:today,status:{in:["sending","sent","uncertain"]}}}),
  prisma.recoveryDispatch.count({where:{sessionId,status:"sending"}}),
  prisma.recoverySecondAttempt.count({where:{sessionId,status:{in:["sending","uncertain"]}}}),
  prisma.captureApproval.count({where:{sessionId,status:"sending"}})
 ]);
 if(usedFirst+usedSecond>=10||firstActive||secondActive||captureActive)return false;
 const candidates=await prisma.recoverySecondAttempt.findMany({where:{sessionId,status:"approved",eligibleAt:{lte:new Date()},approvedAt:{not:null}},orderBy:{approvedAt:"asc"},take:10});
 for(const item of candidates){
  const decision=await prisma.recoveryDecision.findUnique({where:{sessionId_chatId:{sessionId,chatId:item.chatId}}});
  const first=await prisma.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId:item.chatId}}});
  const outcome=await prisma.recoveryOutcome.findUnique({where:{sessionId_chatId:{sessionId,chatId:item.chatId}}});
  if(!decision?.sentAt||first?.status!=="sent"||["close_approved","ineligible"].includes(decision.status)||outcome){
   await prisma.recoverySecondAttempt.updateMany({where:{id:item.id,status:"approved"},data:{status:"closed",reason:"Contato sem elegibilidade comercial."}});continue;
  }
  let assessment;
  try{assessment=evaluateSecondAttempt({history:await getLiveHistory(sessionId,item.chatId),firstSentAt:decision.sentAt})}
  catch(error){console.error("[recuperação 2ª] Histórico indisponível, nenhum envio:",error.message);continue}
  if(assessment.status!=="review"){
   await prisma.recoverySecondAttempt.updateMany({where:{id:item.id,status:"approved"},data:{status:assessment.status,reason:assessment.reason}});continue;
  }
  if(!item.messageText.trim())continue;
  if(!recoveryRunning()||new Date().getDay()===0)return false;
  const claimed=await prisma.recoverySecondAttempt.updateMany({where:{id:item.id,status:"approved",approvedAt:item.approvedAt},data:{status:"sending",dayKey:dayKey(),lastOutgoingAt:assessment.lastOutgoingAt,checkedAt:new Date()}});
  if(claimed.count!==1)continue;
  const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,""),key=process.env.OPENWA_API_KEY?.trim();
  if(!base||!key){await prisma.recoverySecondAttempt.update({where:{id:item.id},data:{status:"approved",dayKey:null,lastError:"OpenWA não configurado."}});return false}
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
   let response;
   try{response=await fetch(base+"/api/sessions/"+encodeURIComponent(sessionId)+"/messages/send-text",{method:"POST",headers:{"X-API-Key":key,"Idempotency-Key":"recovery-second-"+item.id,"Content-Type":"application/json"},body:JSON.stringify({chatId:item.chatId,text:item.messageText,linkPreview:false}),signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timer)}
   if(!response.ok)throw Error("OpenWA HTTP "+response.status);
   await prisma.recoverySecondAttempt.update({where:{id:item.id},data:{status:"sent",sentAt:new Date(),lastError:""}});
   console.log("[recuperação 2ª] Envio confirmado:",item.chatId);
  }catch(error){
   await prisma.recoverySecondAttempt.update({where:{id:item.id},data:{status:"uncertain",lastError:String(error.message).slice(0,250)}});
   console.error("[recuperação 2ª] Resultado incerto; bloqueado para repetição:",error.message);
  }
  return true;
 }
 return false;
}
