import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
export const runtime="nodejs";
const phases=["negotiating","meeting_scheduled","meeting_held","proposal_prepared","proposal_presented"];
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Recurso local sem autenticação de produção."},{status:403});
 try{
  const {chatId,phase,meetingAt,proposalAmount,notes}=await request.json();
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  if(!sessionId||typeof chatId!=="string"||!/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(chatId)||!phases.includes(phase))return NextResponse.json({error:"Dados inválidos."},{status:400});
  const dispatch=await prisma.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  const decision=dispatch&&await prisma.recoveryDecision.findUnique({where:{id:dispatch.decisionId}});
  if(dispatch?.status!=="sent"||!decision||decision.status==="close_approved")return NextResponse.json({error:"Contato sem envio confirmado ou encerrado."},{status:403});
  const preview=await prisma.recoveryPreview.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  if(preview?.status!=="presented")return NextResponse.json({error:"Registre primeiro a apresentação da prévia."},{status:409});
  const existing=await prisma.recoveryCommercial.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
  const step=phases.indexOf(phase),previous=existing?phases.indexOf(existing.phase):-1;
  if(step<previous||step>previous+1)return NextResponse.json({error:"Registre cada etapa comercial em ordem."},{status:409});
  const date=meetingAt?new Date(meetingAt):existing?.meetingAt||null;
  if(date&&!Number.isFinite(date.getTime()))return NextResponse.json({error:"Data da reunião inválida."},{status:400});
  if(step>=1&&!date)return NextResponse.json({error:"Informe a data da reunião."},{status:400});
  const amount=proposalAmount===""||proposalAmount===null||proposalAmount===undefined?existing?.proposalAmount??null:Number(proposalAmount);
  if(amount!==null&&(!Number.isInteger(amount)||amount<0||amount>100000000))return NextResponse.json({error:"Valor inválido: informe centavos inteiros."},{status:400});
  if(step>=3&&(amount===null||amount<=0))return NextResponse.json({error:"Informe o valor da proposta em centavos."},{status:400});
  const data={phase,meetingAt:date,proposalAmount:amount,notes:String(notes||"").slice(0,1000)};
  const record=await prisma.recoveryCommercial.upsert({where:{sessionId_chatId:{sessionId,chatId}},create:{sessionId,chatId,...data},update:data});
  return NextResponse.json({commercial:record,notice:"Etapa registrada. Nenhuma mensagem, reunião ou proposta foi enviada automaticamente."});
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:400})}
}
