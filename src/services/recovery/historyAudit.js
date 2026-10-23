export function auditConversation(messages,total=0){
 const ordered=[...messages].filter(m=>Number.isFinite(m.timestamp)).sort((a,b)=>a.timestamp-b.timestamp);
 const outgoing=ordered.filter(m=>m.direction==="outgoing");
 const incoming=ordered.filter(m=>m.direction==="incoming");
 const first=outgoing[0]||null;
 const laterIncoming=first?incoming.filter(m=>m.timestamp>=first.timestamp):incoming;
 const hasReply=laterIncoming.some(m=>String(m.body||"").trim() && m.type!=="unknown");
 const hasInitial=!!first && !!String(first.body||"").trim();
 return {
  firstApproach:first,
  lastOutgoing:outgoing.at(-1)||null,
  lastIncoming:incoming.at(-1)||null,
  outgoingCount:outgoing.length,
  incomingCount:incoming.length,
  replyAfterApproach:hasReply,
  suggestedStatus:!hasInitial?"insufficient_history":hasReply?"review":"potentially_unanswered",
  rationale:!hasInitial?"Primeira abordagem não recuperada. Não é possível afirmar se houve resposta do cliente.":hasReply?"Há resposta textual após a abordagem; exige revisão humana.":"Nenhuma resposta textual identificada após a primeira abordagem no trecho consultado; isso não comprova silêncio definitivo.",
  historyIncomplete:total>messages.length,
  examinedCount:messages.length,total,
 };
}
