import {prisma} from "../../lib/prisma.js";
import {getLead} from "../../repositories/leadRepository.js";
import {captureApproachForLead,buildCaptureMessage} from "./approaches.js";
import {scoreCaptureLead} from "./prioritization.js";

export function candidatePhone(lead){
 let digits=String(lead.whatsapp||lead.phone||"").replace(/\D/g,"");
 if(digits.startsWith("0")&&digits.length===12)digits=digits.slice(1);
 if([10,11].includes(digits.length))digits="55"+digits;
 return /^55\d{10,11}$/.test(digits)?digits:null;
}
const blockedStages=new Set(["ganho","perdido","contatado","sem_resposta","com_resposta","proposta","proposta_rejeitada","negociacao"]);
export async function authorizeCaptureBatch({sessionId,leadIds}){
 if(!sessionId)throw Error("Sessão OpenWA não configurada.");
 if(!Array.isArray(leadIds)||!leadIds.length||leadIds.length>50||new Set(leadIds).size!==leadIds.length||leadIds.some(x=>typeof x!=="string"||x.length>128))throw Error("Selecione de 1 a 50 leads distintos.");
 const results=[];
 for(const leadId of leadIds){
  try{
   const lead=await getLead(leadId);
   if(!lead)throw Error("Lead não encontrado.");
   if(blockedStages.has(lead.stage))throw Error("Etapa comercial já iniciada ou encerrada.");
   const existing=await prisma.captureApproval.findUnique({where:{leadId}});
   if(existing)throw Error("Lead já possui registro na Captação ("+existing.status+").");
   const phone=candidatePhone(lead);
   if(!phone){
    const variant=captureApproachForLead(lead);
    await prisma.captureApproval.create({data:{leadId,sessionId,chatId:"pending:"+leadId,status:"number_review",messageText:buildCaptureMessage(lead,variant),approachVariant:"auto_"+variant,approvedAt:new Date()}});
    results.push({leadId,name:lead.name,status:"review",reason:"Sem telefone válido: corrija a ficha e reenfileire na aba Aprovados."});
    continue;
   }
   const chatId=phone+"@c.us";
   const duplicates=await prisma.captureApproval.count({where:{sessionId,chatId}});
   const recovery=await prisma.recoveryDecision.count({where:{sessionId,chatId}});
   const recoveryDispatch=await prisma.recoveryDispatch.count({where:{sessionId,chatId}});
   const links=await prisma.whatsAppLeadLink.findMany({where:{leadId},select:{chatId:true}});
   const otherRecovery=links.length?await prisma.recoveryDecision.count({where:{sessionId,chatId:{in:links.map(x=>x.chatId)}}}):0;
   if(duplicates||recovery||recoveryDispatch||otherRecovery)throw Error("Contato já registrado na Captação ou Recuperação.");
   const qualified=scoreCaptureLead(lead);
   if(!qualified.eligible)throw Error("Revisão necessária: "+qualified.warnings.join(" "));
   const variant=captureApproachForLead(lead);
   const message=buildCaptureMessage(lead,variant);
   if(message.length<20||message.length>2000)throw Error("Mensagem de abordagem inválida.");
   await prisma.captureApproval.create({data:{leadId,sessionId,chatId,status:"approved",messageText:message,approachVariant:"auto_"+variant,approvedAt:new Date()}});
   results.push({leadId,name:lead.name,status:"approved",reason:"Contato autorizado e mensagem contextual preparada."});
  }catch(error){results.push({leadId,status:"review",reason:String(error.message||error).slice(0,230)})}
 }
 return {approved:results.filter(x=>x.status==="approved").length,review:results.filter(x=>x.status==="review").length,results};
}

export async function repairInvalidCaptureNumber({sessionId,leadId}){
 if(!sessionId||typeof leadId!=="string")throw Error("Lead inválido.");
 const existing=await prisma.captureApproval.findUnique({where:{leadId}});
 if(!existing||existing.sessionId!==sessionId||!["invalid_number","number_review"].includes(existing.status))throw Error("Somente contatos com número pendente podem ser reenfileirados.");
 const lead=await getLead(leadId);
 if(!lead)throw Error("Lead não encontrado.");
 const phone=candidatePhone(lead);
 if(!phone)throw Error("Atualize um telefone brasileiro válido na ficha do CRM.");
 const chatId=phone+"@c.us";
 if(chatId===existing.chatId)throw Error("Altere o número no CRM antes de reenfileirar.");
 const [other,recovery]=await Promise.all([
  prisma.captureApproval.count({where:{sessionId,chatId,leadId:{not:leadId}}}),
  prisma.recoveryDecision.count({where:{sessionId,chatId}})
 ]);
 if(other||recovery)throw Error("Novo número já consta na Captação ou Recuperação.");
 const changed=await prisma.captureApproval.updateMany({where:{id:existing.id,status:existing.status,chatId:existing.chatId},data:{chatId,status:"approved",approvedAt:new Date()}});
 if(changed.count!==1)throw Error("Situação alterada; atualize a tela.");
 return {leadId,status:"approved",chatId};
}
