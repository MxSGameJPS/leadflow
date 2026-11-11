import {prisma} from "../../lib/prisma.js";
import {listLeads,getLead} from "../../repositories/leadRepository.js";
import {getLeadWorkspace,appendLeadActivity} from "../workspaces/leadWorkspaceStore.js";
import {captureRunning,captureCampaignActive} from "./dispatchControl.js";
import {captureIntakePaused} from "./intakeControl.js";
import {candidatePhone} from "./bulkApproval.js";
import {buildCaptureMessage} from "./approaches.js";
import {rankCaptureCandidates} from "./prioritization.js";
import {CAMPAIGN_BATCH_LIMIT,CAMPAIGN_CONFIRMATION,validateCampaignDraft,campaignBlockers,checkCampaignPreparationState} from "./campaignPreparationPolicy.js";

async function inFlightCount(db=prisma,sessionId){
 const [capture,followup,recovery]=await Promise.all([
  db.captureApproval.count({where:{sessionId,status:"sending"}}),
  db.captureFollowup.count({where:{sessionId,status:{in:["sending","uncertain"]}}}),
  db.recoveryDispatch.count({where:{sessionId,status:"sending"}})
 ]);
 return capture+followup+recovery;
}
// Consulta leve para atualizar apenas os bloqueios de envio, sem reconstruir a lista.
export async function capturePreparationStatus({sessionId}){
 if(!sessionId)throw Error("Sessão OpenWA não configurada.");
 const inFlight=await inFlightCount(prisma,sessionId);
 return {active:captureCampaignActive(),running:captureRunning(),inFlight,intakePaused:captureIntakePaused()};
}
async function inspect({db=prisma,sessionId,lead,approval,mode,workspace}){
 const phone=candidatePhone(lead),chatId=phone?phone+"@c.us":null;
 const links=await db.whatsAppLeadLink.findMany({where:{leadId:lead.id},select:{chatId:true}});
 const knownChats=[...new Set([chatId,...links.map(x=>x.chatId)].filter(Boolean))];
 const [decision,dispatch,duplicate,response,followup]=await Promise.all([
  knownChats.length?db.recoveryDecision.findFirst({where:{sessionId,chatId:{in:knownChats}},select:{id:true}}):null,
  knownChats.length?db.recoveryDispatch.findFirst({where:{sessionId,chatId:{in:knownChats}},select:{id:true}}):null,
  knownChats.length?db.captureApproval.findFirst({where:{sessionId,chatId:{in:knownChats},leadId:{not:lead.id}},select:{id:true}}):null,
  knownChats.length?db.outreachObservation.findFirst({where:{sessionId,chatId:{in:knownChats},status:"replied"},select:{id:true}}):null,
  db.captureFollowup.findFirst({where:{sessionId,leadId:lead.id},select:{id:true}})
 ]);
 const blockers=campaignBlockers({
  mode,lead,approval,workspace,sessionId,phone,
  hasConflict:Boolean(decision||dispatch||duplicate||response||followup),
  hasLinkedChat:links.length>0
 });
 return {phone,chatId,blockers};
}
function previewEntry({mode,lead,approval,phone,blockers,score=0}){
 return {
  mode,leadId:lead.id,name:lead.name,city:lead.city||"",segment:lead.segment||"",
  phone:phone||"",score,eligible:blockers.length===0,reason:blockers.join(" "),
  message:buildCaptureMessage(lead,"black_friday"),
  originalMessage:mode==="convert"?approval.messageText:null,
  approvedAt:mode==="convert"?approval.approvedAt?.toISOString()||null:null
 };
}
export async function previewCaptureCampaign({sessionId}){
 if(!sessionId)throw Error("Sessão OpenWA não configurada.");
 const [leads,approvals,decisions,dispatches,count]=await Promise.all([
  listLeads(),
  prisma.captureApproval.findMany({orderBy:{approvedAt:"asc"}}),
  prisma.recoveryDecision.findMany({where:{sessionId},select:{chatId:true}}),
  prisma.recoveryDispatch.findMany({where:{sessionId},select:{chatId:true}}),
  inFlightCount(prisma,sessionId)
 ]);
 const current=approvals.filter(x=>x.sessionId===sessionId);
 const leadMap=new Map(leads.map(x=>[x.id,x]));
 const oldApprovals=current.filter(x=>x.status==="approved"&&!["black_friday","auto_black_friday"].includes(x.approachVariant)).slice(0,50);
 const ranked=rankCaptureCandidates(leads,{approvals,recoveryChatIds:[...decisions,...dispatches].map(x=>x.chatId)});
 const newCandidates=ranked.filter(x=>x.eligible).slice(0,50);
 const old=await Promise.all(oldApprovals.map(async approval=>{
  const lead=leadMap.get(approval.leadId);
  if(!lead)return {mode:"convert",leadId:approval.leadId,name:"Lead ausente",eligible:false,reason:"Lead não encontrado no CRM."};
  const workspace=await getLeadWorkspace(lead.id);
  const result=await inspect({sessionId,lead,approval,workspace,mode:"convert"});
  return previewEntry({mode:"convert",lead,approval,phone:result.phone,blockers:result.blockers});
 }));
 const fresh=await Promise.all(newCandidates.map(async candidate=>{
  const lead=leadMap.get(candidate.id),workspace=await getLeadWorkspace(candidate.id);
  const result=await inspect({sessionId,lead,approval:null,workspace,mode:"new"});
  return previewEntry({mode:"new",lead,phone:result.phone,blockers:result.blockers,score:candidate.score});
 }));
 return {
  active:captureCampaignActive(),running:captureRunning(),inFlight:count,intakePaused:captureIntakePaused(),
  old,newLeads:fresh,maxBatch:CAMPAIGN_BATCH_LIMIT,
  description:"Nenhuma mensagem é enviada ao preparar ou converter; o worker só envia depois de ativado separadamente."
 };
}
export async function commitCaptureCampaign({sessionId,items,confirmation}){
 if(!sessionId)throw Error("Sessão OpenWA não configurada.");
 if(confirmation!==CAMPAIGN_CONFIRMATION)throw Error("Confirme explicitamente a revisão de mensagens e destinatários.");
 if(!Array.isArray(items)||items.length<1||items.length>CAMPAIGN_BATCH_LIMIT)throw Error("Selecione de 1 a 10 contatos.");
 if(new Set(items.map(x=>x?.leadId)).size!==items.length)throw Error("Não envie contatos duplicados.");
 const results=[];
 for(const item of items){
  const leadId=item?.leadId;
  try{
   if(typeof leadId!=="string"||!leadId||leadId.length>128||!["convert","new"].includes(item?.mode))
    throw Error("Seleção inválida.");
   const message=validateCampaignDraft(item.message);
   checkCampaignPreparationState({
    campaignActive:captureCampaignActive(),running:captureRunning(),
    inFlight:await inFlightCount(prisma,sessionId),intakePaused:captureIntakePaused(),mode:item.mode
   });
   const lead=await getLead(leadId);
   if(!lead)throw Error("Lead não encontrado.");
   const workspace=await getLeadWorkspace(leadId);
   const receipt=await prisma.$transaction(async db=>{
    // Reconsulta o estado dentro da transação; a aprovação não pode mudar no intervalo.
    const approval=await db.captureApproval.findUnique({where:{leadId}});
    const current=await inspect({db,sessionId,lead,approval,workspace,mode:item.mode});
    if(current.blockers.length)throw Error(current.blockers.join(" "));
    if(!captureCampaignActive()||captureRunning())throw Error("Campanha pausada ou Captação religada durante a operação.");
    if(item.mode==="convert"){
     const previous=String(item.originalMessage||"");
     const approvedAt=approval.approvedAt?.toISOString();
     if(previous!==approval.messageText||!approvedAt||approvedAt!==item.approvedAt)
      throw Error("A mensagem aprovada foi alterada; atualize a prévia antes de converter.");
     const updated=await db.captureApproval.updateMany({
      where:{id:approval.id,sessionId,status:"approved",sentAt:null,approvedAt:approval.approvedAt,messageText:previous,chatId:current.chatId},
      data:{messageText:message,approachVariant:"black_friday"}
     });
     if(updated.count!==1)throw Error("O estado mudou; nenhuma alteração realizada.");
     return {mode:item.mode,leadId,name:lead.name,previous};
    }
    await db.captureApproval.create({data:{
     leadId,sessionId,chatId:current.chatId,status:"approved",
     messageText:message,approachVariant:"black_friday",approvedAt:new Date()
    }});
    return {mode:item.mode,leadId,name:lead.name,previous:null};
   });
   try{
    await appendLeadActivity(leadId,{
     type:"system",title:receipt.mode==="convert"?"Primeiro contato convertido para Black Friday":"Primeiro contato Black Friday aprovado",
     detail:receipt.previous
      ?"Texto anterior (não enviado): "+receipt.previous.slice(0,900)+" | Novo texto: "+message.slice(0,350)
      :"Contato autorizado e mensagem revisada para Black Friday: "+message.slice(0,350)
    });
   }catch(error){console.error("[campanha] Não foi possível atualizar histórico da ficha:",leadId,String(error.message).slice(0,120))}
   results.push({...receipt,status:"approved"});
  }catch(error){
   results.push({leadId,status:"review",reason:String(error.message||error).slice(0,250)});
  }
 }
 return {approved:results.filter(x=>x.status==="approved").length,review:results.filter(x=>x.status==="review").length,results};
}
