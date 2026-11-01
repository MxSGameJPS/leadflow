"use client";
import {useState} from "react";
import styles from "./SocialWeeklyReport.module.css";
const monday=()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const display=value=>value==null?"Não disponível":Number(value).toLocaleString("pt-BR");
export default function SocialWeeklyReport(){
 const [week,setWeek]=useState(monday),[report,setReport]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function load(analyze=false){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/social/weekly-report"+(analyze?"":"?week="+encodeURIComponent(week)),{method:analyze?"POST":"GET",headers:analyze?{"Content-Type":"application/json"}:undefined,body:analyze?JSON.stringify({week}):undefined,cache:"no-store"});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Não foi possível consultar o relatório.");
   setReport(result);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const t=report?.totals||{};
 return <section className={styles.panel}><header><h2>Relatório semanal de marketing</h2><p>Métricas retornadas pela Meta, publicações do LeadFlow e contexto comercial. Não confunda engajamento com contratos.</p></header>
 <div className={styles.toolbar}><label>Início da semana<input type="date" value={week} onChange={e=>setWeek(e.target.value)}/></label><button type="button" disabled={busy} onClick={()=>load(false)}>{busy?"Consultando...":"Consultar números reais"}</button><button type="button" disabled={busy} onClick={()=>load(true)}>Analisar e sugerir estratégia com IA</button></div>
 {error&&<p role="alert" className={styles.error}>{error}</p>}
 {report&&<><p className={styles.period}>Período: {report.start} a {report.endExclusive} (fim exclusivo). Atualizado em {new Date(report.generatedAt).toLocaleString("pt-BR")}.</p>
 <div className={styles.metrics}>{[["Posts publicados",t.publishedPosts],["Posts ainda planejados",t.plannedPosts],["Curtidas disponíveis",t.likes],["Comentários disponíveis",t.comments],["Compartilhamentos disponíveis",t.shares],["Alcance Instagram",t.instagramReach],["Salvamentos Instagram",t.instagramSaves],["Visualizações Facebook",t.facebookViews]].map(([label,value])=><div className={styles.metric} key={label}><strong>{display(value)}</strong><span>{label}</span></div>)}</div>
 <h3>Desempenho por publicação</h3><div className={styles.postList}>{report.rows.length?report.rows.map(item=><article key={item.platform+item.postId} className={styles.post}><strong>{item.title}</strong><span>{item.platform==="instagram"?"Instagram":"Facebook"}</span><small>Curtidas: {display(item.likes)} · Comentários: {display(item.comments)} · Compartilhamentos: {display(item.shares)} · {item.platform==="instagram"?"Alcance: "+display(item.reach)+" · Salvos: "+display(item.saves):"Visualizações: "+display(item.views)}</small>{item.permalink&&<a href={item.permalink} target="_blank" rel="noreferrer">Ver publicação</a>}</article>):<p>Nenhuma publicação com identificador da Meta nesta semana.</p>}</div>
 <h3>Contexto comercial (sem atribuição aos posts)</h3><p>{t.conversationsObserved} respostas observadas na Captação/Recuperação · {t.meetingsRecorded} reuniões registradas · {t.contractsRecorded} contratos registrados nos registros comerciais consultados.</p>
 {report.analysis&&<><h3>Análise e plano recomendado pela IA</h3><div className={styles.analysis}>{report.analysis}</div></>}
 {report.errors.length>0&&<div className={styles.warnings}><strong>Métricas indisponíveis ou falhas da Meta</strong>{report.errors.map((e,i)=><p key={i}>{e}</p>)}</div>}
 {report.notes.map((note,i)=><p key={i} className={styles.note}>{note}</p>)}
 </>}
 </section>;
}
