import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma.js";
export const runtime="nodejs";
export async function POST(request) {
  // Explicitly single-message diagnostic, disabled in production and by default.
  if (process.env.NODE_ENV === "production" || process.env.LEADFLOW_ENABLE_RECOVERY_SEND_TEST !== "true")
    return NextResponse.json({error:"Teste de envio desabilitado. Ative LEADFLOW_ENABLE_RECOVERY_SEND_TEST=true no ambiente local."},{status:403});
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,"");
  const key=process.env.OPENWA_API_KEY?.trim();
  const {chatId,confirmation}=await request.json().catch(()=>({}));
  if (confirmation!=="ENVIAR UMA MENSAGEM" || typeof chatId!=="string" || !/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId) || !sessionId || !base || !key)
    return NextResponse.json({error:"Confirmação explícita ou configuração inválida."},{status:400});
  let dispatch;
  try {
    dispatch=await prisma.$transaction(async tx=>{
      const prior=await tx.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
      if(!prior || prior.status!=="reserved")throw Error("Somente mensagens previamente reservadas podem ser enviadas.");
      const tested=await tx.recoveryDispatch.count({where:{sessionId,status:{in:["sending","sent","uncertain"]}}});
      if(tested>0)throw Error("O teste de envio único já foi utilizado nesta sessão. Não haverá outro envio.");
      const decision=await tx.recoveryDecision.findUnique({where:{id:prior.decisionId}});
      if(!decision || decision.status!=="message_approved" || !decision.consentConfirmed || decision.messageText!==prior.messageSnapshot || decision.sentAt)
        throw Error("A mensagem aprovada foi alterada ou a autorização deixou de ser válida.");
      const updated=await tx.recoveryDispatch.updateMany({where:{id:prior.id,status:"reserved"},data:{status:"sending"}});
      if(updated.count!==1)throw Error("Esta mensagem já está em processamento.");
      return prior;
    });
  } catch(e){return NextResponse.json({error:e.message},{status:409})}
  try {
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
    let response;
    try{
      response=await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,{
        method:"POST",headers:{"X-API-Key":key,"Idempotency-Key":dispatch.id,"Content-Type":"application/json"},
        body:JSON.stringify({chatId,text:dispatch.messageSnapshot,linkPreview:false}),signal:controller.signal,cache:"no-store",
      });
    }finally{clearTimeout(timeout)}
    if(!response.ok)throw Error("OpenWA retornou HTTP "+response.status+". Confira a conversa antes de qualquer nova tentativa.");
    await prisma.$transaction(async tx=>{
      await tx.recoveryDispatch.update({where:{id:dispatch.id},data:{status:"sent"}});
      await tx.recoveryDecision.update({where:{id:dispatch.decisionId},data:{status:"sent",sentAt:new Date()}});
      await tx.recoveryDecisionAudit.create({data:{decisionId:dispatch.decisionId,action:"sent",previousStatus:"message_approved",reason:"Envio unitário explicitamente confirmado pelo proprietário."}});
    });
    return NextResponse.json({success:true,message:"OpenWA confirmou o envio de uma mensagem."});
  }catch(error){
    // Do not retry automatically: a timeout may occur after WhatsApp accepted the send.
    await prisma.recoveryDispatch.update({where:{id:dispatch.id},data:{status:"uncertain"}}).catch(()=>{});
    return NextResponse.json({error:"Resultado do envio incerto: "+error.message+" Verifique o WhatsApp antes de fazer qualquer ação."},{status:502});
  }
}
