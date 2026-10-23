"use client";
import {useState} from "react";
import s from "./RecoveryQueue.module.css";
export default function RecoveryQueue({initial}){
 const [queue,setQueue]=useState(initial),[error,setError]=useState(""),[busy,setBusy]=useState("");
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
 <div className={s.list}>{queue.rows.length===0?<p>Nenhuma mensagem aprovada na fila.</p>:queue.rows.map((row,i)=><article key={row.chatId} className={s.card}><div><strong>{i+1}. Conversa {row.chatId}</strong><p>{row.messageText}</p></div><button type="button" disabled={busy===row.chatId||queue.remaining===0} onClick={()=>reserve(row.chatId)}>Reservar para envio manual</button></article>)}</div></main>;
}
