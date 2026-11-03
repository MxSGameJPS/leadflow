"use client";
import {useState} from "react";
import styles from "./RecoverySecondAttempt.module.css";
export default function RecoverySecondAttempt({rows:initial=[]}){
 const [rows,setRows]=useState(initial);
 const [drafts,setDrafts]=useState({});
 const [error,setError]=useState("");
 async function action(chatId,kind){
  const r=await fetch("/api/recovery/second-attempt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId,action:kind,messageText:drafts[chatId],confirmation:kind==="approve"?"APROVAR_SEGUNDA_TENTATIVA":null})});
  const data=await r.json();
  if(!r.ok){setError(data.error);return;}
  setRows(old=>[data.row,...old.filter(x=>x.chatId!==chatId)]);
 }
 return <section className={styles.panel}><h2>Segunda tentativa</h2>{error&&<p role="alert">{error}</p>}{rows.map(row=><article key={row.chatId} className={styles.card}><strong>{row.chatId}</strong><p>{row.status}: {row.reason}</p><p>Último envio: {new Date(row.lastOutgoingAt).toLocaleString("pt-BR")}</p><button onClick={()=>action(row.chatId,"inspect")}>Reavaliar</button>{row.status==="review"&&<><textarea value={drafts[row.chatId]||""} onChange={e=>setDrafts(old=>({...old,[row.chatId]:e.target.value}))}/><button onClick={()=>{if(confirm("Aprovar segunda tentativa?"))action(row.chatId,"approve")}}>Aprovar</button></>}{["review","waiting","approved","blocked"].includes(row.status)&&<button onClick={()=>action(row.chatId,"close")}>Encerrar</button>}</article>)}</section>
}
