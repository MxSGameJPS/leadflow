import {prisma} from "../../lib/prisma.js";
import {inspectSecondAttempt,addBusinessDays} from "./secondAttempt.js";
export async function scanRecoverySecondAttempts(sessionId){
 if(!sessionId)return {checked:0};
 const first=await prisma.recoveryDecision.findMany({where:{sessionId,sentAt:{not:null}},select:{chatId:true,sentAt:true},orderBy:{sentAt:"asc"},take:400});
 const existing=await prisma.recoverySecondAttempt.findMany({where:{sessionId},select:{chatId:true,status:true,checkedAt:true}});
 const byChat=new Map(existing.map(x=>[x.chatId,x]));
 let checked=0;
 for(const row of first){
  if(checked>=4)break;
  if(addBusinessDays(row.sentAt)>new Date())continue;
  const old=byChat.get(row.chatId);
  if(old&&old.status!=="waiting")continue;
  if(old&&Date.now()-old.checkedAt.getTime()<24*3600000)continue;
  try{await inspectSecondAttempt({sessionId,chatId:row.chatId})}
  catch(error){console.error("[recuperação 2ª] Falha na análise:",row.chatId,String(error.message).slice(0,120))}
  checked++;
 }
 return {checked};
}
