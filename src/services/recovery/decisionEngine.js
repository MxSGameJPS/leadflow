export const DECISIONS=["pending","eligible","ineligible","message_approved","message_rejected","sent","close_approved","close_rejected"];
export function nextDecision(record,action) {
 const status=record?.status||"pending";
 const allowed={
  pending:["eligible","ineligible","approve_and_queue"],eligible:["ineligible","message_approved","message_rejected","approve_and_queue"],
  ineligible:["eligible","approve_and_queue"],message_approved:["message_rejected","eligible","sent"],
  message_rejected:["eligible","ineligible","message_approved","approve_and_queue"],
  sent:["close_approved","close_rejected"],
  close_rejected:["close_approved"],close_approved:["eligible"]
 };
 if(!allowed[status]?.includes(action)) throw new Error("Transição não permitida: "+status+" → "+action);
 if(action==="approve_and_queue")return "message_approved";
 if(action==="sent") throw new Error("O envio de mensagens ainda não está habilitado. Nenhum envio automático é permitido.");
 return action;
}
export function canSend(record) {
 return record?.status==="message_approved" && !!record?.consentConfirmed && !!record?.messageText?.trim() && !record?.sentAt;
}
