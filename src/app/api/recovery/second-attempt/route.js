import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {inspectSecondAttempt,approveSecondAttempt,validChat} from "../../../../services/recovery/secondAttempt.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const fail=(error,status=400)=>NextResponse.json({error},{status});
const context=()=>({sessionId:process.env.OPENWA_SESSION_ID?.trim()});
export async function GET(){
 if(process.env.NODE_ENV==="production")return fail("Somente ambiente local.",403);
 const {sessionId}=context();if(!sessionId)return fail("Sessão WhatsApp não configurada.");
 const rows=await prisma.recoverySecondAttempt.findMany({where:{sessionId},orderBy:{updatedAt:"desc"},take:300});
 return NextResponse.json({rows});
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return fail("Somente ambiente local.",403);
 const {sessionId}=context();if(!sessionId)return fail("Sessão WhatsApp não configurada.");
 try{
  const input=await request.json(),chatId=input.chatId;
  if(!validChat(chatId))return fail("Conversa inválida.");
  if(input.action==="inspect")return NextResponse.json({row:await inspectSecondAttempt({sessionId,chatId}),notice:"Histórico verificado; nenhum envio realizado."});
  if(input.action==="approve"){
   if(input.confirmation!=="APROVAR_SEGUNDA_TENTATIVA")return fail("Aprovação explícita necessária.");
   return NextResponse.json({row:await approveSecondAttempt({sessionId,chatId,messageText:input.messageText}),notice:"Segunda tentativa aprovada para o worker; nenhum envio imediato."});
  }
  if(input.action==="close"){
   const existing=await prisma.recoverySecondAttempt.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
   if(!existing||!["review","waiting","blocked","approved"].includes(existing.status))return fail("Estado não permite encerramento.",409);
   const updated=await prisma.recoverySecondAttempt.update({where:{id:existing.id},data:{status:"closed",reason:"Encerrado manualmente no painel.",approvedAt:null}});
   return NextResponse.json({row:updated});
  }
  return fail("Ação inválida.");
 }catch(error){return fail(String(error.message||error).slice(0,250),400)}
}
