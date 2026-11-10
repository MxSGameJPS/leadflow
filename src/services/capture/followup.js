import {prisma} from "../../lib/prisma.js";
import {addBusinessDays,getLiveHistory,evaluateSecondAttempt,dayKey} from "../recovery/secondAttempt.js";
import {captureRunning} from "./dispatchControl.js";
import {getRecoveryRest} from "../recovery/workSchedule.js";

const locked=new Set(["sent","sending","uncertain","closed"]);
export async function inspectCaptureFollowup({sessionId,leadId}){
 if(!sessionId||!leadId)throw Error("Contato inválido.");
 const first=await prisma.captureApproval.findFirst({where:{sessionId,leadId,status:"sent",sentAt:{not:null}}});
 if(!first)throw Error("Primeiro envio não confirmado na Captação.");
 const existing=await prisma.captureFollowup.findUnique({where:{leadId}});
 if(existing&&locked.has(existing.status))return existing;
 const [outcome,history,recoveryConflict]=await Promise.all([
  prisma.commercialOutcome.findUnique({where:{sessionId_channel_chatId:{sessionId,channel:"capture",chatId:first.chatId}}}),
  getLiveHistory(sessionId,first.chatId),
  prisma.recoveryDecision.findFirst({where:{sessionId,chatId:first.chatId}})
 ]);
 const assessment=recoveryConflict?{status:"closed",reason:"Contato também registrado na Recuperação."}:outcome&&["interested","meeting_scheduled","meeting_held","proposal_sent","won","lost"].includes(outcome.stage)?
  {status:"closed",reason:"Contato em atendimento comercial ou encerrado."}:evaluateSecondAttempt({history,firstSentAt:first.sentAt});
 const status=assessment.status==="review"&&existing?.status==="approved"?"approved":assessment.status;
 const payload={sessionId,leadId,chatId:first.chatId,firstSentAt:first.sentAt,lastOutgoingAt:assessment.lastOutgoingAt||first.sentAt,eligibleAt:assessment.eligibleAt||addBusinessDays(first.sentAt),checkedAt:new Date(),status,reason:assessment.reason||"",messageText:existing?.messageText||"",approvedAt:status==="approved"?existing?.approvedAt:null};
 return prisma.captureFollowup.upsert({where:{leadId},create:payload,update:payload});
}
export async function approveCaptureFollowup({sessionId,leadId,messageText}){
 const content=String(messageText||"").trim();
 if(content.length<20||content.length>1000)throw Error("Mensagem deve conter entre 20 e 1.000 caracteres.");
 const row=await inspectCaptureFollowup({sessionId,leadId});
 if(!["review","approved"].includes(row.status)||row.eligibleAt>new Date())throw Error("Contato não está elegível; verifique o histórico novamente.");
 const changed=await prisma.captureFollowup.updateMany({where:{id:row.id,status:{in:["review","approved"]},checkedAt:row.checkedAt},data:{status:"approved",approvedAt:new Date(),messageText:content}});
 if(!changed.count)throw Error("O estado mudou. Atualize e revise.");
 return prisma.captureFollowup.findUnique({where:{id:row.id}});
}
export async function scanCaptureFollowups(sessionId){
 if(!sessionId)return;
 const candidates=await prisma.captureApproval.findMany({where:{sessionId,status:"sent",sentAt:{not:null}},select:{leadId:true,sentAt:true},orderBy:{sentAt:"asc"},take:300});
 let examined=0;
 for(const candidate of candidates){
  if(examined>=4)break;
  if(addBusinessDays(candidate.sentAt)>new Date())continue;
  const existing=await prisma.captureFollowup.findUnique({where:{leadId:candidate.leadId}});
  if(existing&&existing.status!=="waiting")continue;
  if(existing&&Date.now()-existing.checkedAt.getTime()<24*3600000)continue;
  examined++;
  try{await inspectCaptureFollowup({sessionId,leadId:candidate.leadId})}
  catch(error){console.error("[captação acompanhamento] Histórico indisponível:",String(error.message).slice(0,150))}
 }
}
export async function dispatchCaptureFollowup(sessionId){
 if(!sessionId||!captureRunning()||new Date().getDay()===0)return false;
 const [lastCapture,lastRecovery,lastSecond,lastFollowup]=await Promise.all([
  prisma.captureApproval.findFirst({where:{sessionId,sentAt:{not:null}},orderBy:{sentAt:"desc"},select:{sentAt:true}}),
  prisma.recoveryDecision.findFirst({where:{sessionId,sentAt:{not:null}},orderBy:{sentAt:"desc"},select:{sentAt:true}}),
  prisma.recoverySecondAttempt.findFirst({where:{sessionId,status:"sent"},orderBy:{sentAt:"desc"},select:{sentAt:true}}),
  prisma.captureFollowup.findFirst({where:{sessionId,status:"sent"},orderBy:{sentAt:"desc"},select:{sentAt:true}})
 ]);
 const latest=[lastCapture?.sentAt,lastRecovery?.sentAt,lastSecond?.sentAt,lastFollowup?.sentAt].filter(Boolean).sort((a,b)=>b-a)[0];
 const schedule=getRecoveryRest({lastSentAt:latest});
 if(!schedule.working||schedule.resting)return false;
 const today=dayKey();
 const [initialUsed,followupUsed,firstSending,secondSending,otherSending,uncertain]=await Promise.all([
  prisma.captureApproval.count({where:{sessionId,status:{in:["sending","sent","uncertain"]},OR:[{sentAt:{gte:new Date(new Date().setHours(0,0,0,0))}},{status:{in:["sending","uncertain"]},updatedAt:{gte:new Date(new Date().setHours(0,0,0,0))}}]}}),
  prisma.captureFollowup.count({where:{sessionId,dayKey:today,status:{in:["sending","sent","uncertain"]}}}),
  prisma.captureApproval.count({where:{sessionId,status:"sending"}}),
  prisma.recoveryDispatch.count({where:{sessionId,status:"sending"}}),
  prisma.recoverySecondAttempt.count({where:{sessionId,status:"sending"}}),
  prisma.captureFollowup.count({where:{sessionId,status:{in:["sending","uncertain"]}}})
 ]);
 if(initialUsed+followupUsed>=10||firstSending||secondSending||otherSending||uncertain)return false;
 const rows=await prisma.captureFollowup.findMany({where:{sessionId,status:"approved",eligibleAt:{lte:new Date()},approvedAt:{not:null}},orderBy:{approvedAt:"asc"},take:10});
 for(const item of rows){
  const first=await prisma.captureApproval.findFirst({where:{sessionId,leadId:item.leadId,status:"sent"}});
  if(!first||first.chatId!==item.chatId){await prisma.captureFollowup.updateMany({where:{id:item.id,status:"approved"},data:{status:"closed",reason:"Primeiro contato não confere com o registro."}});continue;}
  let assessment;
  try{assessment=evaluateSecondAttempt({history:await getLiveHistory(sessionId,item.chatId),firstSentAt:first.sentAt})}
  catch(error){console.error("[captação acompanhamento] Falha no histórico:",error.message);continue;}
  const [outcome,recoveryConflict]=await Promise.all([
   prisma.commercialOutcome.findUnique({where:{sessionId_channel_chatId:{sessionId,channel:"capture",chatId:item.chatId}}}),
   prisma.recoveryDecision.findFirst({where:{sessionId,chatId:item.chatId}})
  ]);
  if(recoveryConflict)assessment={status:"closed",reason:"Contato também registrado na Recuperação. Revisão necessária."};
  if(outcome&&["interested","meeting_scheduled","meeting_held","proposal_sent","won","lost"].includes(outcome.stage))assessment={status:"closed",reason:"Existe negociação ou encerramento cadastrado."};
  if(assessment.status!=="review"){
   await prisma.captureFollowup.updateMany({where:{id:item.id,status:"approved"},data:{status:assessment.status,reason:assessment.reason}});continue;
  }
  if(!captureRunning()||!getRecoveryRest({lastSentAt:latest}).working||new Date().getDay()===0)return false;
  const claimed=await prisma.captureFollowup.updateMany({where:{id:item.id,status:"approved",approvedAt:item.approvedAt},data:{status:"sending",dayKey:dayKey(),checkedAt:new Date()}});
  if(!claimed.count)continue;
  const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,""),key=process.env.OPENWA_API_KEY?.trim();
  if(!base||!key){await prisma.captureFollowup.update({where:{id:item.id},data:{status:"approved",dayKey:null}});return false;}
  try{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);let res;
   try{res=await fetch(base+"/api/sessions/"+encodeURIComponent(sessionId)+"/messages/send-text",{method:"POST",headers:{"X-API-Key":key,"Idempotency-Key":"capture-followup-"+item.id,"Content-Type":"application/json"},body:JSON.stringify({chatId:item.chatId,text:item.messageText,linkPreview:false}),signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timeout)}
   if(!res.ok)throw Error("OpenWA HTTP "+res.status);
   await prisma.captureFollowup.update({where:{id:item.id},data:{status:"sent",sentAt:new Date(),lastError:""}});
   console.log("[captação acompanhamento] Segunda tentativa enviada:",item.leadId);
  }catch(error){
   await prisma.captureFollowup.update({where:{id:item.id},data:{status:"uncertain",lastError:String(error.message||error).slice(0,250)}});
   console.error("[captação acompanhamento] Resultado incerto. Não repetir:",error.message);
  }
  return true;
 }
 return false;
}
