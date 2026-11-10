import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {authorizeCaptureBatch,repairInvalidCaptureNumber} from "../../../../services/capture/bulkApproval.js";
import {captureIntakePaused,setCaptureIntakePaused} from "../../../../services/capture/intakeControl.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const fail=(error,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 if(process.env.NODE_ENV==="production")return fail("Disponível somente no computador local.",403);
 const sessionId=process.env.OPENWA_SESSION_ID?.trim();
 if(!sessionId)return fail("Sessão OpenWA ausente.");
 const items=await prisma.captureApproval.findMany({where:{sessionId},select:{leadId:true,status:true,chatId:true,messageText:true,approvedAt:true,sentAt:true},orderBy:{approvedAt:"desc"}});
 return NextResponse.json({items,intakePaused:captureIntakePaused()});
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return fail("Disponível somente no computador local.",403);
 try{
  const data=await request.json();
  if(data.action==="pause_intake"||data.action==="resume_intake"){
   if(data.confirmation!=="CONFIRMO CONTROLE DE APROVACOES")return fail("Confirme a alteração.");
   return NextResponse.json(setCaptureIntakePaused(data.action==="pause_intake"));
  }
  if(data.action==="repair"){
   if(data.confirmation!=="CORRIGI O NUMERO")return fail("Confirme que alterou o número no CRM.");
   return NextResponse.json(await repairInvalidCaptureNumber({sessionId:process.env.OPENWA_SESSION_ID?.trim(),leadId:data.leadId}));
  }
  if(captureIntakePaused())return fail("Novas aprovações estão pausadas. Retome na aba Aprovados.",423);
  if(data.confirmation!=="AUTORIZO PRIMEIRO CONTATO")return fail("Confirme a autorização dos leads selecionados.");
  const result=await authorizeCaptureBatch({sessionId:process.env.OPENWA_SESSION_ID?.trim(),leadIds:data.leadIds});
  return NextResponse.json(result);
 }catch(error){return fail(String(error.message||error).slice(0,300))}
}
