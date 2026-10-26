"use client";
import {useEffect,useRef,useState} from "react";
import s from "./RecoveryQueue.module.css";
export default function RecoveryQueue({initial}){
 const [queue,setQueue]=useState(initial),[error,setError]=useState(""),[busy,setBusy]=useState("");
 const [followups,setFollowups]=useState(()=>Object.fromEntries((initial.sentRows||[]).filter(row=>row.followup).map(row=>[row.chatId,row.followup])));
 const [autoCheck,setAutoCheck]=useState(false);
 const checkCallback=useRef(null);
 useEffect(()=>{if(!autoCheck)return;const interval=setInterval(()=>checkCallback.current?.(),300000);return ()=>clearInterval(interval)},[autoCheck]);
 const [aiFollowups,setAiFollowups]=useState(()=>Object.fromEntries((initial.sentRows||[]).filter(row=>row.aiReview).map(row=>[row.chatId,row.aiReview])));
 const [batchRunning,setBatchRunning]=useState(false);
 const [batchProgress,setBatchProgress]=useState("");
 const [batchErrors,setBatchErrors]=useState({});
 const [showOnlyPending,setShowOnlyPending]=useState(false);
 const [acknowledged,setAcknowledged]=useState(()=>Object.fromEntries((initial.sentRows||[]).map(row=>[row.chatId,row.followup?.reviewedReplyAt||null])));
 function pendingReply(row){
   const info=followups[row.chatId];
   if(row.decisionStatus==="close_approved"||!info?.messages?.length)return false;
   const last=info.latestReplyAt||new Date(Math.max(...info.messages.map(m=>m.timestamp))*1000).toISOString();
   return !acknowledged[row.chatId]||new Date(last).getTime()>new Date(acknowledged[row.chatId]).getTime();
 }
 async function markReviewed(chatId){
   const data=followups[chatId];
   if(!data?.messages?.length)return;
   const last=data.latestReplyAt||new Date(Math.max(...data.messages.map(m=>m.timestamp))*1000).toISOString();
   setBusy(chatId);setError("");
   try{
     const response=await fetch("/api/recovery/followup/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId,latestReplyAt:last})});
     const result=await response.json();if(!response.ok)throw Error(result.error||"Falha ao marcar revisão.");
     setAcknowledged(old=>({...old,[chatId]:result.reviewedReplyAt}));
   }catch(e){setError(e.message)}finally{setBusy("")}
 }

 async function checkAllReplies(){
  if(batchRunning)return;
  setBatchRunning(true);setBatchErrors({});setError("");
  const rows=(queue.sentRows||[]).filter(row=>row.decisionStatus!=="close_approved");
  let completed=0,failed=0;
  try{
   for(const row of rows){
    setBatchProgress("Verificando "+(completed+1)+" de "+rows.length+" conversas enviadas...");
    try{
     const response=await fetch("/api/recovery/followup?chatId="+encodeURIComponent(row.chatId),{cache:"no-store"});
     const result=await response.json();
     if(!response.ok)throw Error(result.error||"Falha na consulta.");
     setFollowups(old=>({...old,[row.chatId]:result}));
    }catch(e){failed++;setBatchErrors(old=>({...old,[row.chatId]:e.message}));}
    completed++;
   }
   setBatchProgress("Verificação concluída: "+completed+" conversas; "+failed+" erro(s). Nenhuma mensagem foi enviada.");
  }finally{setBatchRunning(false)}
 }
 checkCallback.current=checkAllReplies;
 function aiFresh(row){
  const ai=aiFollowups[row.chatId],history=followups[row.chatId];
  if(!ai?.analyzedReplyAt||!history?.latestReplyAt)return false;
  return new Date(ai.analyzedReplyAt).getTime()===new Date(history.latestReplyAt).getTime();
 }
 function stage(row){
  if(row.decisionStatus==="close_approved")return "Encerrado";
  if(pendingReply(row))return "Nova resposta";
  if(!followups[row.chatId]?.messages?.length)return "Aguardando resposta";
  if(!aiFresh(row))return "Aguardando análise";
  if(aiFollowups[row.chatId]?.category==="interested")return "Interesse identificado";
  if(aiFollowups[row.chatId]?.category==="refusal")return "Encerramento a revisar";
  return "Resposta revisada / acompanhar";
 }
 const stages=(queue.sentRows||[]).reduce((acc,row)=>{const name=stage(row);acc[name]=(acc[name]||0)+1;return acc},{});
 const pendingReplies=(queue.sentRows||[]).filter(pendingReply);
 const pendingRefusals=pendingReplies.filter(row=>followups[row.chatId]?.status==="possible_refusal");
 const visibleSentRows=(queue.sentRows||[]).filter(row=>!showOnlyPending||pendingReply(row));
 async function analyzeReply(chatId){
  setBusy(chatId);setError("");
  try{
   const response=await fetch("/api/recovery/followup/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Erro na análise pelo OmniRoute.");
   setAiFollowups(prev=>({...prev,[chatId]:data.analysis}));
  }catch(e){setError(e.message)}finally{setBusy("")}
 }

 async function inspectReply(chatId){
  setBusy(chatId);setError("");
  try {
   const r=await fetch("/api/recovery/followup?chatId="+encodeURIComponent(chatId),{cache:"no-store"});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Falha na consulta");
   setFollowups(old=>({...old,[chatId]:d}));
  }catch(e){setError(e.message)}finally{setBusy("")}
 }
 async function reviewClosure(chatId,action){
  const followup=followups[chatId];
  if(!followup || followup.status!=="possible_refusal")return;
  const question=action==="close_approved"?"Confirmar encerramento deste contato por recusa? Nenhuma outra mensagem será enviada.":"Rejeitar a sugestão de encerramento?";
  if(!confirm(question))return;
  setBusy(chatId);setError("");
  try {
   const r=await fetch("/api/recovery/decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId,action,reason:"Revisão humana de resposta pós-envio. "+followup.messages.map(m=>m.text).join(" | ").slice(0,350)})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Falha ao salvar decisão");
   const refreshed=await fetch("/api/recovery/queue",{cache:"no-store"});setQueue(await refreshed.json());
  }catch(e){setError(e.message)}finally{setBusy("")}
 }

 async function sendTest(chatId){
  if(!confirm("ATENÇÃO: esta ação enviará UMA mensagem real pelo WhatsApp ao destinatário selecionado. Confirma?"))return;
  const confirmation=prompt('Para autorizar este único envio, digite exatamente: ENVIAR UMA MENSAGEM');
  if(confirmation!=="ENVIAR UMA MENSAGEM")return;
  setBusy(chatId);setError("");
  try {
   const r=await fetch("/api/recovery/send-test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId,confirmation})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Falha no envio.");
   alert("O OpenWA confirmou o envio. Confira também a conversa no WhatsApp.");
   const refreshed=await fetch("/api/recovery/queue",{cache:"no-store"});setQueue(await refreshed.json());
  }catch(e){setError(e.message)}finally{setBusy("")}
 }
 async function reserve(chatId){
  if(!confirm("Reservar esta conversa para envio manual? Nenhuma mensagem será transmitida pelo sistema."))return;
  setBusy(chatId);setError("");
  try{
   const response=await fetch("/api/recovery/queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId})});
   const json=await response.json();if(!response.ok)throw Error(json.error);
   const refreshed=await fetch("/api/recovery/queue",{cache:"no-store"});const data=await refreshed.json();
   if(!refreshed.ok)throw Error(data.error);setQueue(data);
  }catch(e){setError(e.message)}finally{setBusy("")}
 }
 return <main className={s.main}><a href="/recuperacao/conversas">← Voltar para conversas</a><h1>Fila de recuperação</h1><p>Mensagens previamente aprovadas por você. O LeadFlow não envia nenhuma mensagem nesta etapa.</p>
 <section className={s.metrics}><div><span>Limite diário</span><strong>{queue.dailyLimit}</strong></div><div><span>Vagas disponíveis hoje</span><strong>{queue.remaining}</strong></div><div><span>Mensagens aprovadas aguardando</span><strong>{queue.rows.length}</strong></div></section>
 {error&&<p role="alert">{error}</p>}
 <section className={s.list}><h2>Mensagens reservadas para revisão final</h2><p>O teste de envio único só funciona quando habilitado explicitamente no ambiente local. Nada é enviado ao reservar.</p>{(queue.reservations||[]).map(row=><article className={s.card} key={row.chatId}><div><strong>{row.chatId}</strong><p>{row.messageSnapshot}</p></div><button type="button" disabled={busy===row.chatId||queue.testUsed} onClick={()=>sendTest(row.chatId)}>{queue.testUsed?"Teste já utilizado":"Testar envio de 1 mensagem"}</button></article>)}</section>
 <section className={s.list}><h2>Situação comercial dos contatos enviados</h2>
 <div className={s.metrics}>{Object.entries(stages).map(([name,count])=><div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div>
 <p>Os estágios são indicativos; não alteram decisões ou encerramentos. Análises antigas não são consideradas após uma nova resposta.</p></section>
 <section className={s.list}><h2>Painel de acompanhamento</h2>
 <p>Consulte, de uma vez, as conversas já enviadas que ainda não tiveram encerramento aprovado. A consulta não utiliza a etiqueta de prospecção.</p>
 <div className={s.metrics}>
 <div><span>Enviadas registradas</span><strong>{(queue.sentRows||[]).length}</strong></div>
 <div><span>Respostas com revisão pendente</span><strong>{pendingReplies.length}</strong></div>
 <div><span>Possíveis recusas pendentes</span><strong>{pendingRefusals.length}</strong></div>
 </div>
 <button type="button" disabled={batchRunning||!!busy} onClick={checkAllReplies}>{batchRunning?"Consultando histórico...":"Verificar todas as respostas pendentes"}</button>
 <label><input type="checkbox" checked={autoCheck} onChange={e=>setAutoCheck(e.target.checked)}/> Verificar a cada 5 minutos enquanto esta página estiver aberta</label>
 {batchProgress&&<p role="status">{batchProgress}</p>}
 <label><input type="checkbox" checked={showOnlyPending} onChange={e=>setShowOnlyPending(e.target.checked)}/> Mostrar somente contatos com respostas a revisar</label>
 <p>As contagens consideram apenas os históricos verificados nesta tela. Use o botão para atualizar. A análise individual pelo OmniRoute continua sob demanda.</p>
 </section>
 <section className={s.list}><h2>Enviadas — acompanhamento após a retirada da etiqueta</h2>
 <p>Consulte respostas sem depender da etiqueta de prospecção. O sistema não responde nem encerra contatos automaticamente.</p>
 {visibleSentRows.map(row=><article className={s.card} key={row.chatId}>
 <div><p><strong>Situação: {stage(row)}</strong></p><strong>{row.chatId} · {row.decisionStatus==="close_approved"?"Encerramento aprovado":row.decisionStatus==="close_rejected"?"Encerramento rejeitado":"Enviada"}</strong><p>{row.messageSnapshot}</p>
 {batchErrors[row.chatId]&&<p role="alert">Erro ao verificar: {batchErrors[row.chatId]}</p>}
 {followups[row.chatId]&&<div role="status">
 {pendingReply(row)?<button type="button" disabled={!!busy} onClick={()=>markReviewed(row.chatId)}>Marcar resposta como revisada</button>:followups[row.chatId].messages?.length>0?<p>Respostas já revisadas ou oportunidade encerrada.</p>:null}
 {followups[row.chatId].checkedAt&&<p><small>Última verificação: {new Date(followups[row.chatId].checkedAt).toLocaleString("pt-BR")}</small></p>}<p><strong>{followups[row.chatId].suggestion}</strong></p>
 {followups[row.chatId].messages.map((m,i)=><p key={i}>Recebida em {new Date(m.timestamp*1000).toLocaleString("pt-BR")}: {m.text}</p>)}
 <small>{followups[row.chatId].source}</small>
 <div><button type="button" disabled={!!busy} onClick={()=>analyzeReply(row.chatId)}>{busy===row.chatId?"Analisando...":"Analisar resposta com OmniRoute"}</button></div>
 {aiFollowups[row.chatId]&&!aiFresh(row)&&<p role="status">Análise anterior desatualizada. Consulte as respostas e solicite nova análise ao OmniRoute.</p>}
 {aiFollowups[row.chatId]&&aiFresh(row)&&<section className={s.aiResult}>
 <strong>Análise consultiva do OmniRoute — nenhuma ação automática</strong>
 <p>Categoria: {({automatic:"Possível mensagem automática",refusal:"Recusa",interested:"Interesse",question:"Dúvida",uncertain:"Indeterminado"})[aiFollowups[row.chatId].category]}</p>
 <p>Justificativa: {aiFollowups[row.chatId].reasoning}</p>
 <p>Evidência: {aiFollowups[row.chatId].evidence}</p>
 <p>Próxima ação sugerida: {aiFollowups[row.chatId].recommendedAction}</p>
 {aiFollowups[row.chatId].draftReply&&<><p>Rascunho não enviado: {aiFollowups[row.chatId].draftReply}</p><button type="button" onClick={()=>navigator.clipboard.writeText(aiFollowups[row.chatId].draftReply)}>Copiar rascunho</button></>}
 </section>}
 {followups[row.chatId].status==="possible_refusal"&&row.decisionStatus==="sent"&&<div><button type="button" disabled={!!busy} onClick={()=>reviewClosure(row.chatId,"close_approved")}>Aprovar encerramento</button> <button type="button" disabled={!!busy} onClick={()=>reviewClosure(row.chatId,"close_rejected")}>Rejeitar encerramento</button></div>}
 </div>}</div><button type="button" disabled={!!busy} onClick={()=>inspectReply(row.chatId)}>{busy===row.chatId?"Consultando...":"Consultar respostas"}</button>
 </article>)}
 </section>
 <div className={s.list}>{queue.rows.length===0?<p>Nenhuma mensagem aprovada na fila.</p>:queue.rows.map((row,i)=><article key={row.chatId} className={s.card}><div><strong>{i+1}. Conversa {row.chatId}</strong><p>{row.messageText}</p></div><button type="button" disabled={busy===row.chatId||queue.remaining===0} onClick={()=>reserve(row.chatId)}>Reservar para envio manual</button></article>)}</div></main>;
}
