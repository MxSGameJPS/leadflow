export function auditConversation(messages,total=0){
 const ordered=[...messages].filter(m=>Number.isFinite(m.timestamp)).sort((a,b)=>a.timestamp-b.timestamp);
 const outgoing=ordered.filter(m=>m.direction==="outgoing");
 const incoming=ordered.filter(m=>m.direction==="incoming");
 const first=outgoing[0]||null;
 const laterIncoming=first?incoming.filter(m=>m.timestamp>=first.timestamp):incoming;
 const hasReply=laterIncoming.length>0;
 return {
  firstApproach:first,
  lastOutgoing:outgoing.at(-1)||null,
  lastIncoming:incoming.at(-1)||null,
  outgoingCount:outgoing.length,
  incomingCount:incoming.length,
  replyAfterApproach:hasReply,
  suggestedStatus:hasReply?"review":"potentially_unanswered",
  rationale:hasReply?"Há resposta recebida no histórico consultado; exige revisão humana.":"Nenhuma resposta identificada após a primeira mensagem no trecho consultado; não prova ausência definitiva de resposta.",
  historyIncomplete:total>messages.length,
  examinedCount:messages.length,total,
 };
}
