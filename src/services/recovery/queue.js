import { prisma } from "../../lib/prisma.js";
import { canSend } from "./decisionEngine.js";
const DAILY_LIMIT = 10;
function saoPauloDate(value=new Date()) {
 return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
}
export async function getRecoveryQueue(sessionId) {
 if(!sessionId)return {rows:[],dailyLimit:DAILY_LIMIT,remaining:DAILY_LIMIT};
 const decisions=await prisma.recoveryDecision.findMany({where:{sessionId},orderBy:[{createdAt:"asc"},{id:"asc"}]});
 const log=await prisma.recoveryDispatch.findMany({where:{sessionId},select:{chatId:true,status:true,dayKey:true}});
 const contacted=new Set(log.filter(item=>["reserved","externally_sent"].includes(item.status)).map(item=>item.chatId));
 const day=saoPauloDate();
 const dailyCount=log.filter(item=>item.dayKey===day&&["reserved","externally_sent"].includes(item.status)).length;
 const rows=decisions.filter(item=>canSend(item)&&!contacted.has(item.chatId)).map(item=>({chatId:item.chatId,decisionId:item.id,messageText:item.messageText,approvedAt:item.updatedAt}));
 return {rows,dailyLimit:DAILY_LIMIT,remaining:Math.max(0,DAILY_LIMIT-dailyCount),day,dailyCount};
}
export async function reserveRecoveryForManualSend(sessionId,chatId) {
 if(!sessionId||!chatId)throw Error("Conversa inválida.");
 return prisma.$transaction(async tx=>{
   const existing=await tx.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
   if(existing)throw Error("Esta conversa já possui uma tentativa registrada; nenhuma segunda tentativa é permitida.");
   const decision=await tx.recoveryDecision.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
   if(!canSend(decision))throw Error("A mensagem deve estar aprovada e a permissão confirmada.");
   const day=saoPauloDate();
   const used=await tx.recoveryDispatch.count({where:{sessionId,dayKey:day,status:{in:["reserved","externally_sent"]}}});
   if(used>=DAILY_LIMIT)throw Error("Limite diário de 10 tentativas atingido.");
   return tx.recoveryDispatch.create({data:{sessionId,chatId,decisionId:decision.id,dayKey:day,status:"reserved",messageSnapshot:decision.messageText}});
 });
}
