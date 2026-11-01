"use client";
import {useEffect,useState} from "react";
import styles from "./SocialOpportunities.module.css";
export default function SocialOpportunities(){
 const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 async function refresh(){
  setLoading(true);setError("");
  try{const response=await fetch("/api/social/opportunities",{cache:"no-store"});const result=await response.json();if(!response.ok)throw Error(result.error||"Falha ao consultar CRM.");setData(result)}
  catch(e){setError(e.message)}finally{setLoading(false)}
 }
 useEffect(()=>{refresh()},[]);
 return <section className={styles.panel}><header className={styles.header}><div><h2>Oportunidades geradas pelas redes</h2><p>Leads cadastrados a partir de comentários e mensagens, por confirmação manual. Ainda não representam contratos ou conversões atribuídas.</p></div><button type="button" disabled={loading} onClick={refresh}>{loading?"Atualizando...":"Atualizar"}</button></header>
 {error&&<p role="alert">{error}</p>}
 <div className={styles.cards}><div><strong>{data?data.total:"—"}</strong><span>Oportunidades exibidas</span></div><div><strong>{data?data.counts.instagram:"—"}</strong><span>Instagram</span></div><div><strong>{data?data.counts.facebook:"—"}</strong><span>Facebook</span></div></div>
 {data?.note&&<p>{data.note}</p>}
 {data?.leads?.length>0?<div className={styles.list}>{data.leads.slice(0,10).map(lead=><div className={styles.lead} key={lead.id}><div><strong>{lead.name}</strong><span>{lead.source==="social_instagram"?"Instagram":"Facebook"} · {lead.stage} · {new Date(lead.createdAt).toLocaleDateString("pt-BR")}</span></div><a href={"/crm/"+encodeURIComponent(lead.id)}>Abrir lead</a></div>)}</div>:<p>Nenhuma oportunidade registrada pelas redes ainda. Selecione um comentário ou DM na Central de Interações e escolha “Registrar oportunidade no CRM”.</p>}
 </section>;
}
