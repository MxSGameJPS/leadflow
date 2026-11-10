"use client";
import {useMemo,useState} from "react";
import styles from "./CapturePriority.module.css";
const bands={high:"Prioridade alta",medium:"Prioridade média",low:"Prioridade baixa",blocked:"Revisão necessária"};
export default function CapturePriority({candidates=[]}){
 const [query,setQuery]=useState(""),[showBlocked,setShowBlocked]=useState(false);
 const visible=useMemo(()=>candidates.filter(x=>(showBlocked||x.eligible)&&[x.name,x.segment,x.city].some(v=>String(v||"").toLowerCase().includes(query.toLowerCase()))).slice(0,50),[candidates,query,showBlocked]);
 const eligible=candidates.filter(x=>x.eligible);
 return <section className={styles.panel}><header><h2>Fila inteligente de prospecção</h2><p>Ranking consultivo com dados do CRM. Pontuação não significa intenção de compra comprovada; nenhum contato é aprovado automaticamente.</p></header>
 <div className={styles.metrics}><div><strong>{eligible.length}</strong><span>Candidatos para avaliação</span></div><div><strong>{eligible.filter(x=>x.band==="high").length}</strong><span>Prioridade alta</span></div><div><strong>{candidates.length-eligible.length}</strong><span>Revisão ou bloqueio</span></div></div>
 <div className={styles.filters}><input type="search" placeholder="Pesquisar empresa ou segmento" value={query} onChange={e=>setQuery(e.target.value)}/><label><input type="checkbox" checked={showBlocked} onChange={e=>setShowBlocked(e.target.checked)}/> Mostrar também bloqueados</label></div>
 {visible.length===0?<p>Nenhum lead encontrado para este filtro.</p>:<div className={styles.list}>{visible.map(x=><article className={styles.card} key={x.id}><div className={styles.top}><div><strong>{x.name}</strong><p>{[x.segment,x.city].filter(Boolean).join(" · ")||"Segmento não informado"}</p></div><div className={styles.score}><strong>{x.score}/100</strong><small>{bands[x.band]}</small></div></div><p><strong>Por que entrou nesta posição?</strong> {x.reasons[0]||"Sem evidências comerciais suficientes."}</p>{x.warnings.length>0&&<p className={styles.warning}>Atenção: {x.warnings.join(" ")}</p>}<small>Confiança: {x.confidence}. Verifique evidências antes de aprovar.</small><a href={"/crm/"+encodeURIComponent(x.id)}>Revisar lead e preparar contato</a></article>)}</div>}
 </section>;
}
