import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {getLead,updateLead} from "../../../../repositories/leadRepository.js";
export const runtime="nodejs";
const invalid=error=>NextResponse.json({error},{status:400});
function normalizeWhatsapp(phone){
 let digits=String(phone||"").replace(/\D/g,"");
 if(digits.length===11&&digits.startsWith("0"))digits=digits.slice(1);
 if(digits.length===10||digits.length===11)digits="55"+digits;
 return /^55\d{10,11}$/.test(digits)?digits:null;
}
export async function GET(request){
 if(process.env.NODE_ENV==="production")return invalid("Somente ambiente local.");
 const leadId=new URL(request.url).searchParams.get("leadId");
 if(!leadId)return invalid("Lead obrigatório.");
 const approval=await prisma.captureApproval.findUnique({where:{leadId}});
 return NextResponse.json({approval});
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Somente ambiente local."},{status:403});
 try{
  const {leadId,action,messageText,confirmed,whatsapp}=await request.json();
  const lead=await getLead(leadId);
  if(!lead)return invalid("Lead não encontrado.");
  const proposed=String(whatsapp??lead.whatsapp??"").trim();
  const phone=normalizeWhatsapp(proposed);
  if(!phone)return invalid("Informe um WhatsApp brasileiro válido. Telefone comercial não é automaticamente WhatsApp.");
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  if(!sessionId)return invalid("Configure a sessão OpenWA.");
  const existing=await prisma.captureApproval.findUnique({where:{leadId}});
  if(existing?.status==="sent"||existing?.status==="sending"||existing?.status==="uncertain")return NextResponse.json({error:"Contato já enviado ou com situação incerta; bloqueado."},{status:409});
  const chatId=phone+"@c.us";
  const links=await prisma.whatsAppLeadLink.findMany({where:{leadId}});
  const chats=[chatId,...links.map(l=>l.chatId)];
  const previous=await prisma.recoveryDispatch.findFirst({where:{sessionId,chatId:{in:chats}}});
  const decision=await prisma.recoveryDecision.findFirst({where:{sessionId,chatId:{in:chats}}});
  if(previous||decision)return NextResponse.json({error:"Este lead já consta no fluxo de Recuperação. Revise a conversa antes de qualquer primeiro contato."},{status:409});
  const other=await prisma.captureApproval.findFirst({where:{sessionId,chatId,leadId:{not:leadId}}});
  if(other)return NextResponse.json({error:"Este WhatsApp já está associado a outro lead na Captação."},{status:409});
  if(action==="approve"){
   // Um lead novo não possui chat no OpenWA. Um histórico inexistente não é pré-requisito para aprovação humana.
   // Bloqueios locais acima permanecem; envio automático segue desativado nesta etapa.
   if(confirmed!==true)return invalid("Confirme a autorização para o primeiro contato.");
   const message=String(messageText||"").trim();
   if(message.length<20||message.length>2000)return invalid("Mensagem deve ter entre 20 e 2.000 caracteres.");
   if(existing&&existing.status!=="draft"&&existing.status!=="rejected")return NextResponse.json({error:"Esta autorização já foi registrada."},{status:409});
   if(proposed!==String(lead.whatsapp||"").trim())await updateLead(leadId,{whatsapp:phone});
   const approval=await prisma.captureApproval.upsert({where:{leadId},create:{leadId,sessionId,chatId,status:"approved",messageText:message,approvedAt:new Date()},update:{status:"approved",messageText:message,approvedAt:new Date(),sessionId,chatId}});
   return NextResponse.json({approval,notice:"Primeiro contato aprovado e salvo. Histórico remoto não foi verificado: confirme que é um contato inédito. O despacho da Captação ainda não está ativado."});
  }
  if(action==="save_phone"){
   if(existing?.status==="approved"||existing?.status==="sent"||existing?.status==="sending"||existing?.status==="uncertain")return NextResponse.json({error:"Destinatário já autorizado ou contatado; edição bloqueada."},{status:409});
   const saved=await updateLead(leadId,{whatsapp:phone});
   return NextResponse.json({whatsapp:saved.whatsapp,notice:"WhatsApp atualizado na ficha do lead. Nenhuma mensagem foi enviada."});
  }
  if(action==="reject"){
   if(existing&&existing.status!=="draft"&&existing.status!=="rejected")return NextResponse.json({error:"Autorização já registrada; não é possível rejeitar nesta etapa."},{status:409});
   const approval=await prisma.captureApproval.upsert({where:{leadId},create:{leadId,sessionId,chatId,status:"rejected",messageText:String(messageText||"").slice(0,2000)},update:{status:"rejected",messageText:String(messageText||"").slice(0,2000)}});
   return NextResponse.json({approval});
  }
  return invalid("Ação inválida.");
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:400})}
}
