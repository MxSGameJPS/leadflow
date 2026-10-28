"use client";
import {useState} from "react";
import s from "./RecoveryCentral.module.css";
const sections=[["review","Para revisar"],["queue","Fila de envio"],["sent","Em acompanhamento"],["closed","Encerrados"]];
export default function RecoveryCentral({data}){
 const [tab,setTab]=useState("review");
 const [error,setError]=useState(""),[busy,setBusy]=useState("");
 const review=data.reviewRows||[],unreserved=data.rows||[],reserved=data.reservations||[],sent=data.sentRows||[],closed=data.closedRows||[];
 const counts={review:review.length,queue:unreserved.length+reserved.length,sent:sent.filter(x=>x.decisionStatus!=="close_approved").length,closed:closed.length};
 async function reserve(chatId){
  if(!confirm("Colocar esta mensagem já aprovada na fila? Ela poderá ser enviada automaticamente durante o expediente."))return;
  setBusy(chatId);setError("");
  try{const r=await fetch("/api/recovery/queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId})}),j=await r.json();if(!r.ok)throw Error(j.error||"Não foi possível reservar.");window.location.reload()}catch(e){setError(e.message)}finally{setBusy("")}
 }
 return <main className={s.main}><h1>Central de Recuperação</h1><p>Uma visão operacional do processo, da revisão humana ao acompanhamento. Os históricos permanecem registrados.</p>
 <nav className={s.links}><a href="/recuperacao/conversas">Auditar conversas</a><a href="/recuperacao/fila">Fila detalhada e acompanhamento</a><a href="/recuperacao/indicadores">Indicadores comerciais</a></nav>
 <div className={s.tabs}>{sections.map(([id,label])=><button key={id} type="button" className={tab===id?s.active:""} onClick={()=>setTab(id)}><strong>{counts[id]}</strong><span>{label}</span></button>)}</div>
 {error&&<p role="alert">{error}</p>}
 {tab==="review"&&<section><h2>Para revisar ({review.length})</h2><p>Revise e aprove as mensagens na tela de conversas. Nada nesta etapa é enviado automaticamente.</p>{review.length===0?<p>Nenhuma decisão pendente registrada.</p>:review.map(x=><article className={s.card} key={x.chatId}><strong>{x.chatId}</strong><span>{({pending:"Aguardando triagem",eligible:"Elegível — revisar mensagem",message_rejected:"Mensagem rejeitada",close_rejected:"Acompanhamento necessário"})[x.status]||x.status}</span><a href="/recuperacao/conversas">Revisar conversa</a></article>)}</section>}
 {tab==="queue"&&<section><h2>Fila de envio ({counts.queue})</h2><p>{data.autoSendEnabled?"Despacho automático ativado.":"Despacho automático desativado."} Horário: 08h–18h, descanso de 30 minutos e limite de 10 envios/dia da Recuperação (mais 10 independentes na Captação).</p>{unreserved.map(x=><article className={s.card} key={x.chatId}><strong>{x.chatId}</strong><p>{x.messageText}</p><button disabled={busy===x.chatId} onClick={()=>reserve(x.chatId)}>Colocar na fila</button></article>)}{reserved.map(x=><article className={s.card} key={x.chatId}><strong>{x.chatId}</strong><p>{x.messageSnapshot}</p><span>Reservada — aguardando despacho</span></article>)}{counts.queue===0&&<p>Nenhuma mensagem aguardando envio.</p>}</section>}
 {tab==="sent"&&<section><h2>Em acompanhamento ({counts.sent})</h2><p>Consulte as respostas e registre interesse, recusa ou negociação na fila detalhada.</p>{sent.filter(x=>x.decisionStatus!=="close_approved").map(x=><article className={s.card} key={x.chatId}><strong>{x.chatId}</strong><p>{x.followup?.suggestion||"Enviada — resposta ainda não verificada."}</p><a href="/recuperacao/fila">Acompanhar resposta</a></article>)}{counts.sent===0&&<p>Nenhum envio em acompanhamento.</p>}</section>}
 {tab==="closed"&&<section><h2>Encerrados ({closed.length})</h2><p>Contatos que tiveram exclusão ou encerramento aprovado. Não devem receber novas abordagens.</p>{closed.map(x=><article className={s.card} key={x.chatId}><strong>{x.chatId}</strong><span>{x.status==="close_approved"?"Encerramento aprovado":"Não elegível"}</span></article>)}{closed.length===0&&<p>Nenhum encerramento registrado.</p>}</section>}
 </main>;
}
