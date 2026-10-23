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
  if(action==="message_approved" && (!text||text.length>2000))throw new Error("Digite uma mensagem válida com até 2.000 caracteres.");
  if(action==="message_approved" && consentConfirmed!==true)throw new Error("Confirme uma base adequada de permissão para esta mensagem antes de aprová-la.");
  const data={status,reason:String(reason||"").slice(0,500),messageText:text,consentConfirmed:action==="message_approved"};
  const decision=await tx.recoveryDecision.upsert({where:key,create:{sessionId,chatId,...data},update:data});
  await tx.recoveryDecisionAudit.create({data:{decisionId:decision.id,action,previousStatus:existing?.status||"pending",reason:data.reason,messageSnapshot:action==="message_approved"?text:null}});
  return decision;
 });
}
