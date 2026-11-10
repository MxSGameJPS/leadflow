const positive=new Set(["positive_intent","interested","question"]);
const negative=new Set(["opt_out","not_interested","refusal"]);
const objections=new Set(["price_objection","timing_objection","existing_provider"]);
export function captureNextStep({replyStatus,replyCategory,aiCategory,outcome,meetingAt,lastError}={}){
 if(["won","lost"].includes(outcome))return {priority:0,label:"Ciclo comercial encerrado",action:"Nenhuma nova abordagem"};
 if(lastError)return {priority:3,label:"Conferência necessária",action:"Histórico do WhatsApp indisponível; não presumir ausência de resposta"};
 if(replyStatus==="replied"){
  const category=aiCategory||replyCategory;
  if(negative.has(category)||negative.has(replyCategory))return {priority:0,label:"Não contatar",action:"Respeitar recusa e registrar encerramento"};
  if(outcome==="meeting_scheduled"||meetingAt)return {priority:4,label:"Reunião agendada",action:"Confirmar agenda e preparar diagnóstico"};
  if(positive.has(category)||positive.has(replyCategory))return {priority:5,label:"Responder com prioridade",action:"Responder à dúvida e propor conversa breve, sem prometer prévia pronta"};
  if(objections.has(category)||objections.has(replyCategory))return {priority:4,label:"Objeção a trabalhar",action:"Entender o contexto antes de sugerir solução"};
  return {priority:3,label:"Resposta a revisar",action:"Ler a conversa antes de decidir"};
 }
 if(replyStatus==="no_reply_observed")return {priority:2,label:"Sem resposta observada",action:"Verificar data e histórico antes de eventual segunda tentativa"};
 return {priority:1,label:"Aguardando monitoramento",action:"Consultar OpenWA e evitar contato duplicado"};
}
export function summarizeCapturePerformance(items=[]){
 const summary={sent:0,replied:0,positive:0,meetings:0,contracts:0,segments:[],variants:[]};
 const segments=new Map(),variants=new Map();
 for(const item of items){
  if(item.status!=="sent")continue;
  summary.sent++;
  const reply=item.replyStatus==="replied",positive=reply&&["positive_intent","interested"].includes(item.aiCategory||item.replyCategory);
  const meeting=!!item.meetingAt||["meeting_scheduled","meeting_held"].includes(item.outcome);
  const contract=item.outcome==="won";
  if(reply)summary.replied++;
  if(positive)summary.positive++;
  if(meeting)summary.meetings++;
  if(contract)summary.contracts++;
  for(const [map,key] of [[segments,item.segment||"Não informado"],[variants,item.approachVariant||"legacy"]]){
   const data=map.get(key)||{key,sent:0,replied:0,positive:0,meetings:0,contracts:0};
   data.sent++;data.replied+=Number(reply);data.positive+=Number(positive);data.meetings+=Number(meeting);data.contracts+=Number(contract);map.set(key,data);
  }
 }
 summary.segments=[...segments.values()].sort((a,b)=>b.meetings-a.meetings||b.replied-a.replied);
 summary.variants=[...variants.values()].sort((a,b)=>b.meetings-a.meetings||b.replied-a.replied);
 return summary;
}
