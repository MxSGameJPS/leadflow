import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
export const runtime="nodejs";
const err=(message,status=400)=>NextResponse.json({error:message},{status});
export async function POST(request){
 if(process.env.NODE_ENV==="production")return err("Apenas ambiente local.",403);
 try{
  const {id,action,confirmation}=await request.json();
  if(typeof id!=="string"||id.length>128)return err("Registro inválido.");
  if(!["confirmed_sent","confirmed_not_sent"].includes(action))return err("Ação inválida.");
  if(confirmation!=="CONFERI NO WHATSAPP")return err("Confirme a conferência no WhatsApp.");
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  if(!sessionId)return err("Sessão não configurada.");
  const attempt=await prisma.captureApproval.findFirst({where:{id,sessionId,status:"uncertain"}});
  if(!attempt)return err("Nenhuma tentativa incerta encontrada.",409);
  if(action==="confirmed_not_sent")return err("Não é seguro liberar novo envio automaticamente com base na ausência de mensagem visível. Mantenha a tentativa bloqueada e faça análise manual.",409);
  const changed=await prisma.captureApproval.updateMany({where:{id,sessionId,status:"uncertain"},data:{status:"sent",sentAt:attempt.sentAt||attempt.updatedAt}});
  if(changed.count!==1)return err("O estado mudou; atualize a tela.",409);
  console.log("[captação] Resultado confirmado manualmente no WhatsApp; sem novo envio:",attempt.leadId);
  return NextResponse.json({ok:true,notice:"Envio marcado como confirmado manualmente. Nenhuma mensagem foi reenviada."});
 }catch(e){return err(String(e.message||e),500)}
}
