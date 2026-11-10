"use client";
import {useState} from "react";
import styles from "./CaptureFollowup.module.css";
const labels={waiting:"Aguardando prazo",review:"Pronto para revisão",approved:"Aprovado para envio",blocked:"Histórico inconclusivo",closed:"Encerrado",sending:"Enviando",sent:"Acompanhamento enviado",uncertain:"Resultado incerto"};
export default function CaptureFollowup({candidates=[]}){
 const [rows,setRows]=useState(Object.fromEntries(candidates.filter(x=>x.followup).map(x=>[x.leadId,x.followup])));
 const [drafts,setDrafts]=useState({});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState("");
 async function action(item,type){
  if(busy)return;
  if(type==="approve"&&!confirm("Autorizar a segunda e última mensagem ao cliente, dentro do expediente e da cota diária?"))return;
  if(type==="close"&&!confirm("Encerrar o ciclo deste contato?"))return;
  setBusy(item.leadId);setError("");
  try{
   const response=await fetch("/api/capture/followup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({leadId:item.leadId,action:type,messageText:drafts[item.leadId],confirmation:type==="approve"?"APROVAR ACOMPANHAMENTO":null})});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Operação indisponível.");
   setRows(old=>({...old,[item.leadId]:data.row}));
  }catch(e){setError(e.message)}finally{setBusy("")}
 }
 async function suggest(item){
  setBusy(item.leadId);setError("");
  try{
   const response=await fetch("/api/capture/followup/suggest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({leadId:item.leadId})});
   const data=await response.json();if(!response.ok)throw Error(data.error||"IA indisponível.");
   setDrafts(old=>({...old,[item.leadId]:data.message}));
  }catch(e){setError(e.message)}finally{setBusy("")}
 }
 const shown=candidates.filter(x=>x.status==="sent");
 return <section className={styles.panel}><h2>Acompanhamento e segunda tentativa</h2><p>Consulta o histórico real do WhatsApp. Após cinco dias úteis sem resposta, permite uma única mensagem adicional com aprovação individual. Não reenvia mensagens incertas.</p>
 {error&&<p role="alert">{error}</p>}
 <div className={styles.list}>{shown.slice(0,100).map(item=>{const row=rows[item.leadId];return <article className={styles.card} key={item.leadId}><div className={styles.heading}><strong>{item.name}</strong><span>{row?labels[row.status]||row.status:"Ainda não analisado"}</span></div><small>Primeiro contato: {item.sentAt?new Date(item.sentAt).toLocaleString("pt-BR"):"Data não confirmada"}</small>
 {row&&<><p>{row.reason}</p><small>Última saída registrada: {new Date(row.lastOutgoingAt).toLocaleString("pt-BR")} · Elegível: {new Date(row.eligibleAt).toLocaleString("pt-BR")}</small></>}
 <div className={styles.actions}><button type="button" disabled={!!busy||["sent","sending","uncertain","closed"].includes(row?.status)} onClick={()=>action(item,"inspect")}>{busy===item.leadId?"Verificando...":"Verificar histórico"}</button>
 {row?.status==="review"&&<><button type="button" disabled={!!busy} onClick={()=>suggest(item)}>Sugerir mensagem com IA</button><label>Segunda mensagem<textarea rows={3} maxLength={1000} value={drafts[item.leadId]??row.messageText??""} onChange={e=>setDrafts(old=>({...old,[item.leadId]:e.target.value}))}/></label><button type="button" disabled={!!busy||!(drafts[item.leadId]??row.messageText??"").trim()} onClick={()=>action(item,"approve")}>Aprovar segunda tentativa</button></>}
 {row&&["review","waiting","blocked","approved"].includes(row.status)&&<button type="button" disabled={!!busy} onClick={()=>action(item,"close")}>Encerrar sem enviar</button>}</div></article>})}</div>
 {!shown.length&&<p>Nenhum primeiro contato enviado disponível para acompanhamento.</p>}
 </section>;
}
