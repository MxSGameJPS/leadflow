import {scoreCaptureLead} from "./prioritization.js";

const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const refusal=/\b(nao tenho interesse|sem interesse|nao quero receber|pare de enviar|remova meu contato|nao queremos)\b/;
const closed=new Set(["ganho","perdido","descartado","excluido"]);
export const CAMPAIGN_BATCH_LIMIT=10;
export const CAMPAIGN_CONFIRMATION="CONFIRMO CAMPANHA BLACK FRIDAY";

export function validateCampaignDraft(value){
 const message=String(value||"").trim();
 const clean=normalize(message);
 if(message.length<50||message.length>500)throw Error("Mensagem deve ter entre 50 e 500 caracteres.");
 if(!/r\$\s*500\b/.test(clean))throw Error("A mensagem precisa informar a oferta de R$ 500.");
 if(!clean.includes("previa gratuita"))throw Error("A mensagem precisa oferecer prévia gratuita.");
 if(/ja (preparei|criei|fiz) (a |uma )?previa|garantimos|100%|primeiro lugar/.test(clean))
  throw Error("Revise alegações não comprovadas sobre prévia ou resultados.");
 return message;
}

export function campaignBlockers({mode,lead,approval,workspace,sessionId,phone,hasConflict=false,hasLinkedChat=false}){
 const errors=[],stage=normalize(lead?.stage);
 if(!lead?.name?.trim())errors.push("Empresa sem identificação.");
 if(stage!=="novo")errors.push("Lead não está na etapa Novo; revisar atendimento anterior.");
 if(closed.has(stage))errors.push("Lead encerrado no CRM.");
 if(!phone)errors.push("Telefone válido não encontrado.");
 if(workspace?.lastContactAt||Number(workspace?.contactCount||0)>0)errors.push("Há contato registrado no histórico comercial.");
 const context=normalize([lead?.notes,lead?.reason,lead?.problem,lead?.nextAction].filter(Boolean).join(" "));
 if(refusal.test(context))errors.push("Possível recusa registrada.");
 if(hasConflict)errors.push("Há histórico de Recuperação, resposta ou destino duplicado.");
 if(mode==="convert"){
  if(!approval||approval.sessionId!==sessionId||approval.status!=="approved"||approval.sentAt)
   errors.push("Este registro não está aprovado e aguardando primeiro envio.");
  if(!approval?.approvedAt||!Number.isFinite(new Date(approval.approvedAt).getTime()))errors.push("Aprovação anterior sem data válida.");
  if(phone&&approval?.chatId!==phone+"@c.us")errors.push("Número cadastrado mudou após a aprovação; revisar manualmente.");
 }else if(mode==="new"){
  if(approval)errors.push("Lead já possui registro de Captação.");
  if(hasLinkedChat)errors.push("Há conversa de WhatsApp vinculada; revisar histórico.");
  const evaluation=scoreCaptureLead(lead);
  if(!evaluation.eligible)errors.push(...evaluation.warnings);
 }else errors.push("Tipo de operação inválido.");
 return [...new Set(errors)];
}

export function checkCampaignPreparationState({campaignActive,running,inFlight,intakePaused,mode}){
 if(!campaignActive)throw Error("Ative a campanha Black Friday antes de preparar contatos.");
 if(running)throw Error("Pause a Captação antes de converter ou aprovar contatos pela campanha.");
 if(inFlight>0)throw Error("Existe envio em andamento ou sem conclusão. Confira o worker e tente novamente.");
 if(mode==="new"&&intakePaused)throw Error("Novas aprovações estão pausadas no CRM.");
}
