import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {inspectCaptureFollowup,approveCaptureFollowup} from "../../../../services/capture/followup.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const error=(message,status=400)=>NextResponse.json({error:message},{status});
export async function POST(request){
 if(process.env.NODE_ENV==="production")return error("Apenas no ambiente local.",403);
 const sessionId=process.env.OPENWA_SESSION_ID?.trim();
 if(!sessionId)return error("Sessão OpenWA ausente.");
 try{
  const {leadId,action,messageText,confirmation}=await request.json();
  if(typeof leadId!=="string"||!leadId||leadId.length>128)return error("Lead inválido.");
  if(action==="inspect")return NextResponse.json({row:await inspectCaptureFollowup({sessionId,leadId}),notice:"Histórico verificado; nada foi enviado."});
  if(action==="approve"){
   if(confirmation!=="APROVAR ACOMPANHAMENTO")return error("Confirme explicitamente a segunda tentativa.");
   return NextResponse.json({row:await approveCaptureFollowup({sessionId,leadId,messageText}),notice:"Segunda tentativa aprovada; aguardando worker e expediente."});
  }
  if(action==="close"){
   const row=await prisma.captureFollowup.findUnique({where:{leadId}});
   if(!row||row.sessionId!==sessionId||!["waiting","review","approved","blocked"].includes(row.status))return error("Estado não permite encerramento.",409);
   const result=await prisma.captureFollowup.updateMany({where:{id:row.id,status:row.status},data:{status:"closed",reason:"Encerrado manualmente; não realizar novo contato."}});
   if(!result.count)return error("Estado alterado; atualize a tela.",409);
   return NextResponse.json({row:await prisma.captureFollowup.findUnique({where:{leadId}})});
  }
  return error("Ação desconhecida.");
 }catch(e){return error(String(e.message||e).slice(0,250))}
}
