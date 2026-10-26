import { prisma } from "../../lib/prisma.js";
import { canSend } from "./decisionEngine.js";
import {getRecoveryRest} from "./workSchedule.js";
const DAILY_LIMIT = 10;
function saoPauloDate(value=new Date()) {
 return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
}
export async function getRecoveryQueue(sessionId) {
 if(!sessionId)return {rows:[],dailyLimit:DAILY_LIMIT,remaining:DAILY_LIMIT};
 const decisions=await prisma.recoveryDecision.findMany({where:{sessionId},orderBy:[{createdAt:"asc"},{id:"asc"}]});
 const log=await prisma.recoveryDispatch.findMany({where:{sessionId},select:{chatId:true,status:true,dayKey:true}});
 const contacted=new Set(log.map(item=>item.chatId));
 const day=saoPauloDate();
 const dailyCount=log.filter(item=>item.dayKey===day&&["reserved","sending","sent","uncertain","externally_sent"].includes(item.status)).length;
 const reservations=await prisma.recoveryDispatch.findMany({where:{sessionId,status:"reserved"},orderBy:{createdAt:"asc"},select:{chatId:true,messageSnapshot:true,createdAt:true}});
 const sent=await prisma.recoveryDispatch.findMany({where:{sessionId,status:"sent"},orderBy:{createdAt:"desc"},select:{chatId:true,messageSnapshot:true,createdAt:true}});
 const snapshots=await prisma.recoveryFollowupSnapshot.findMany({where:{sessionId}});
 const aiReviews=await prisma.recoveryAiReview.findMany({where:{sessionId}});
 const previews=await prisma.recoveryPreview.findMany({where:{sessionId}});
 const commercials=await prisma.recoveryCommercial.findMany({where:{sessionId}});
 const outcomes=await prisma.recoveryOutcome.findMany({where:{sessionId}});
 const outcomeByChat=new Map(outcomes.map(c=>[c.chatId,c]));
 const commercialByChat=new Map(commercials.map(c=>[c.chatId,c]));
 const previewByChat=new Map(previews.map(p=>[p.chatId,p]));
 const aiByChat=new Map(aiReviews.map(item=>[item.chatId,item]));
 const snapshotByChat=new Map(snapshots.map(item=>[item.chatId,item]));
 const sentRows=sent.map(row=>{
   const snapshot=snapshotByChat.get(row.chatId);
   let followup=null;
   if(snapshot){
     let messages=[];try{messages=JSON.parse(snapshot.messagesJson)}catch{}
     followup={status:snapshot.status,suggestion:snapshot.suggestion,messages,nonTextCount:snapshot.nonTextCount,checkedAt:snapshot.checkedAt,latestReplyAt:snapshot.latestReplyAt,reviewedReplyAt:snapshot.reviewedReplyAt,reviewedAt:snapshot.reviewedAt,source:"Última verificação salva no LeadFlow; atualize para consultar o WhatsApp novamente."};
   }
   const ai=aiByChat.get(row.chatId)||null;
   const aiFresh=!!ai?.analyzedReplyAt && !!snapshot?.latestReplyAt && ai.analyzedReplyAt.getTime()===snapshot.latestReplyAt.getTime();
   return {...row,preview:previewByChat.get(row.chatId)||null,commercial:commercialByChat.get(row.chatId)||null,outcome:outcomeByChat.get(row.chatId)||null,aiReview:ai,aiFresh,decisionStatus:decisions.find(d=>d.chatId===row.chatId)?.status||"sent",followup};
 });
 const testUsed=log.some(item=>["sending","sent","uncertain"].includes(item.status));
 const rows=decisions.filter(item=>canSend(item)&&!contacted.has(item.chatId)).map(item=>({chatId:item.chatId,decisionId:item.id,messageText:item.messageText,approvedAt:item.updatedAt}));
 const latest=decisions.filter(d=>d.sentAt).sort((a,b)=>b.sentAt-a.sentAt)[0];
 const latestSnapshot=latest?snapshotByChat.get(latest.chatId):null;
 const schedule=getRecoveryRest({lastSentAt:latest?.sentAt,lastReplyAt:latestSnapshot?.latestReplyAt});
 return {schedule,rows,reservations,sentRows,testUsed,dailyLimit:DAILY_LIMIT,remaining:Math.max(0,DAILY_LIMIT-dailyCount),day,dailyCount};
}
export async function reserveRecoveryForManualSend(sessionId,chatId) {
 if(!sessionId||!chatId)throw Error("Conversa inválida.");
 return prisma.$transaction(async tx=>{
   const existing=await tx.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
   if(existing)throw Error("Esta conversa já possui uma tentativa registrada; nenhuma segunda tentativa é permitida.");
   const decision=await tx.recoveryDecision.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
   if(!canSend(decision))throw Error("A mensagem deve estar aprovada e a permissão confirmada.");
   const day=saoPauloDate();
   const used=await tx.recoveryDispatch.count({where:{sessionId,dayKey:day,status:{in:["reserved","sending","sent","uncertain","externally_sent"]}}});
   if(used>=DAILY_LIMIT)throw Error("Limite diário de 10 tentativas atingido.");
   return tx.recoveryDispatch.create({data:{sessionId,chatId,decisionId:decision.id,dayKey:day,status:"reserved",messageSnapshot:decision.messageText}});
 });
}
