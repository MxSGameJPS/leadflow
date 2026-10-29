import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
export const runtime="nodejs";
const stages=["contacted","interested","meeting_scheduled","meeting_held","proposal_sent","won","lost"];
const fail=(error,status=400)=>NextResponse.json({error},{status});
export async function POST(request){
 if(process.env.NODE_ENV==="production")return fail("Recurso disponível apenas no ambiente local.",403);
 try{
  const {observationId,stage,meetingAt,proposalAmount,contractAmount,lossReason,notes}=await request.json();
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  if(!sessionId||typeof observationId!=="string"||!stages.includes(stage))return fail("Dados inválidos.");
  const observation=await prisma.outreachObservation.findFirst({where:{id:observationId,sessionId}});
  if(!observation)return fail("Contato monitorado não encontrado.",404);
  const key={sessionId_channel_chatId:{sessionId,channel:observation.channel,chatId:observation.chatId}};
  const prior=await prisma.commercialOutcome.findUnique({where:key});
  if(prior&&["won","lost"].includes(prior.stage)&&prior.stage!==stage)return fail("Resultado encerrado: alterações exigem revisão específica.",409);
  const date=meetingAt?new Date(meetingAt):prior?.meetingAt||null;
  if(date&&Number.isNaN(date.getTime()))return fail("Data de reunião inválida.");
  if(stage==="meeting_scheduled"&&!date)return fail("Informe a data da reunião.");
  const parseMoney=(value,old)=>value===""||value===null||value===undefined?old??null:Number(value);
  const proposal=parseMoney(proposalAmount,prior?.proposalAmount),contract=parseMoney(contractAmount,prior?.contractAmount);
  for(const amount of [proposal,contract])if(amount!==null&&(!Number.isSafeInteger(amount)||amount<0||amount>100000000))return fail("Valores devem ser inteiros em centavos.");
  if(stage==="won"&&(!contract||contract<=0))return fail("Informe o valor contratado em centavos.");
  if(stage==="lost"&&!String(lossReason||prior?.lossReason||"").trim())return fail("Informe o motivo da perda.");
  const data={stage,meetingAt:date,proposalAmount:proposal,contractAmount:stage==="won"?contract:null,lossReason:stage==="lost"?String(lossReason||prior?.lossReason||"").slice(0,800):"",notes:String(notes||"").slice(0,1000)};
  const outcome=await prisma.commercialOutcome.upsert({where:key,create:{sessionId,channel:observation.channel,chatId:observation.chatId,...data},update:data});
  return NextResponse.json({outcome,notice:"Resultado comercial registrado; nenhum envio ou alteração de campanha realizada."});
 }catch(e){return fail(String(e.message||e),500)}
}
