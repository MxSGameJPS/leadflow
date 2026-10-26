import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma.js";
export const runtime="nodejs";
export async function POST(request) {
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Somente ambiente local."},{status:403});
 try {
  const {chatId,result,contractAmount,reason}=await request.json();
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  if(!sessionId||typeof chatId!=="string"||!/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId)||!["won","lost"].includes(result))
    return NextResponse.json({error:"Dados inválidos."},{status:400});
  const commercial=await prisma.recoveryCommercial.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  if(commercial?.phase!=="proposal_presented")return NextResponse.json({error:"Apresente a proposta antes de registrar o resultado."},{status:409});
  const decision=await prisma.recoveryDecision.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  if(decision?.status==="close_approved")return NextResponse.json({error:"Oportunidade encerrada; nenhuma alteração automática permitida."},{status:409});
  const existing=await prisma.recoveryOutcome.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  if(existing)return NextResponse.json({error:"Resultado já registrado. Alterações exigem revisão administrativa específica."},{status:409});
  const amount=Number(contractAmount);
  if(result==="won"&&(!Number.isSafeInteger(amount)||amount<=0||amount>100000000))return NextResponse.json({error:"Informe o valor contratado em centavos."},{status:400});
  const note=String(reason||"").trim();
  if(result==="lost"&&(!note||note.length>1000))return NextResponse.json({error:"Informe o motivo da perda (até 1.000 caracteres)."}, {status:400});
  const record=await prisma.recoveryOutcome.create({data:{sessionId,chatId,result,contractAmount:result==="won"?amount:null,reason:note.slice(0,1000)}});
  return NextResponse.json({outcome:record,notice:"Resultado registrado manualmente, sem enviar mensagens ou alterar decisões de recuperação."});
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:400})}
}
