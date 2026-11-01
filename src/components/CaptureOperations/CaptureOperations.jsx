"use client";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import s from "./CaptureOperations.module.css";
import {CAPTURE_APPROACHES} from "../../services/capture/approaches.js";
const groups=[["all","Todos"],["approved","Aguardando envio"],["sending","Em envio"],["sent","Enviados / acompanhar"],["uncertain","Verificar envio"],["rejected","Rejeitados"]];
const labels=Object.fromEntries(groups);
const date=value=>value?new Date(value).toLocaleString("pt-BR"):"—";
export default function CaptureOperations({items=[]}){
 const router=useRouter();
 const [filter,setFilter]=useState("all"),[query,setQuery]=useState(""),[busy,setBusy]=useState(""),[error,setError]=useState("");
 async function confirmSent(item){
  if(!confirm("Você conferiu esta conversa diretamente no WhatsApp e identificou a mensagem enviada? Isso não dispara outra mensagem."))return;
  const confirmation=prompt("Digite exatamente CONFERI NO WHATSAPP")||"";
  if(confirmation!=="CONFERI NO WHATSAPP")return;
  setBusy(item.id);setError("");
  try{const r=await fetch("/api/capture/reconcile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,action:"confirmed_sent",confirmation})});const json=await r.json();if(!r.ok)throw Error(json.error||"Falha na conferência");router.refresh();}catch(e){setError(e.message)}finally{setBusy("")}
 }
 const counts=Object.fromEntries(groups.map(([key])=>[key,key==="all"?items.length:items.filter(x=>x.status===key).length]));
 const variants=CAPTURE_APPROACHES.map(v=>{const rows=items.filter(i=>i.approachVariant===v.id);const sent=rows.filter(i=>i.status==="sent");const replied=sent.filter(i=>i.replyStatus==="replied");const positive=replied.filter(i=>i.replyCategory==="positive_intent");const meetings=sent.filter(i=>i.meetingAt);const contracts=sent.filter(i=>["won","ganho","closed_won"].includes(i.outcome)||i.contractAmount>0);return {...v,approved:rows.length,sent:sent.length,replied:replied.length,positive:positive.length,meetings:meetings.length,contracts:contracts.length}});
 const visible=useMemo(()=>items.filter(item=>(filter==="all"||item.status===filter)&&[item.name,item.phone,item.message].some(x=>String(x||"").toLowerCase().includes(query.toLowerCase()))),[items,filter,query]);
 return <section className={s.section}>
 <div className={s.variantSection}><h2>Resultados por abordagem</h2><p>Respostas observadas no WhatsApp e resultados registrados no CRM. Comparações são exploratórias; taxas com poucos envios não são conclusivas.</p><div className={s.variantGrid}>{variants.map(v=><div className={s.variantCard} key={v.id}><strong>{v.label}</strong><span>Aprovados: {v.approved} · Enviados: {v.sent}</span><span>Responderam: {v.replied} ({v.sent?Math.round(v.replied/v.sent*100):0}%)</span><span>Interesse positivo: {v.positive}</span><span>Reuniões: {v.meetings} · Contratos: {v.contracts}</span></div>)}</div></div>
 <div className={s.summary}>{groups.slice(1).map(([key,label])=><div key={key}><span>{label}</span><strong>{counts[key]}</strong></div>)}</div>
 <div className={s.filters}>{groups.map(([key,label])=><button key={key} type="button" className={filter===key?s.active:""} onClick={()=>setFilter(key)}>{label} ({counts[key]})</button>)}</div>
 <input className={s.search} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar empresa, número ou mensagem"/>
 <p className={s.note}>Limite: 10 envios diários da Captação, independente dos 10 da Recuperação. Enviado = confirmação de envio pelo OpenWA, não confirmação de leitura ou resposta. Selecione um lead para continuar o atendimento no CRM.</p>
 {error&&<p role="alert">{error}</p>}
 <div className={s.list}>{visible.length===0?<p>Nenhum atendimento nesta situação.</p>:visible.map(item=><article className={s.card} key={item.id}>
 <div className={s.top}><strong>{item.name}</strong><span>{labels[item.status]||item.status}</span></div>
 <small>{item.phone} · Abordagem: {CAPTURE_APPROACHES.find(v=>v.id===item.approachVariant)?.label||"Anterior"} · Etapa CRM: {item.leadStage||"Não definida"}</small>
 <p>{item.message}</p><small>Resposta: {item.replyStatus==="replied"?"Detectada ("+item.replyCategory+")":"Não confirmada"} · Resultado comercial: {item.outcome||"Não registrado"}</small><small>Aprovado: {date(item.approvedAt)} · Enviado: {date(item.sentAt)}</small>
 {item.status==="uncertain"&&<div><p>Resultado incerto: confira no aplicativo WhatsApp antes de liberar o agente. Não será realizado reenvio.</p><button className={s.action} type="button" disabled={busy===item.id} onClick={()=>confirmSent(item)}>{busy===item.id?"Conferindo...":"Confirmar que foi enviado"}</button></div>}
 {item.status==="sending"&&<p>Envio em andamento ou interrompido. Não confirme antes de verificar o processo no terminal.</p>}
 <a href={"/crm/"+encodeURIComponent(item.leadId)}>Abrir ficha do lead →</a>
 </article>)}</div></section>;
}
