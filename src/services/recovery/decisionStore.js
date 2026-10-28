import { prisma } from "../../lib/prisma.js";
import { nextDecision } from "./decisionEngine.js";
export async function listRecoveryDecisions(sessionId) {
 return prisma.recoveryDecision.findMany({where:{sessionId},orderBy:{createdAt:"asc"}});
}
export async function decideRecovery({sessionId,chatId,action,messageText,reason,consentConfirmed}) {
 if(!sessionId||!chatId)throw new Error("Identificação da conversa inválida.");
 return prisma.$transaction(async tx=>{
  const key={sessionId_chatId:{sessionId,chatId}};
  const existing=await tx.recoveryDecision.findUnique({where:key});
  const status=nextDecision(existing,action);
  const text=String(messageText||existing?.messageText||"").trim();
  if(["message_approved","approve_and_queue"].includes(action) && (!text||text.length>2000))throw new Error("Digite uma mensagem válida com até 2.000 caracteres.");
  if(action==="message_approved" && consentConfirmed!==true)throw new Error("Confirme uma base adequada de permissão para esta mensagem antes de aprová-la.");
  const data={status,reason:String(reason||"").slice(0,500),messageText:text,consentConfirmed:["message_approved","approve_and_queue"].includes(action)};
  const decision=await tx.recoveryDecision.upsert({where:key,create:{sessionId,chatId,...data},update:data});
  await tx.recoveryDecisionAudit.create({data:{decisionId:decision.id,action,previousStatus:existing?.status||"pending",reason:data.reason,messageSnapshot:["message_approved","approve_and_queue"].includes(action)?text:null}});
  // A aprovação explícita autoriza uma única tentativa futura. Nunca rearmar
  // um chat que já tenha tentativa (enviada, incerta ou reservada).
  if(["message_approved","approve_and_queue"].includes(action)){
   const attempt=await tx.recoveryDispatch.findUnique({where:key});
   if(!attempt){
    const now=new Date();
    const day=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
    await tx.recoveryDispatch.create({data:{sessionId,chatId,decisionId:decision.id,dayKey:day,status:"reserved",messageSnapshot:text}});
   }
  }
  return decision;
 });
}
