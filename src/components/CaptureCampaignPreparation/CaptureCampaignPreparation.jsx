"use client";
import {useEffect,useMemo,useState} from "react";
import s from "./CaptureCampaignPreparation.module.css";

const GROUPS=[["convert","Já aprovados"],["new","Novos elegíveis"]];
export default function CaptureCampaignPreparation(){
 const [data,setData]=useState(null),[group,setGroup]=useState("convert"),[selected,setSelected]=useState([]);
 const [drafts,setDrafts]=useState({}),[reviewed,setReviewed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState(null);
 async function refresh(){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/capture/campaign/prepare",{cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||"Falha ao preparar campanha.");
   setData(json);setSelected([]);setDrafts({});setReviewed(false);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 useEffect(()=>{refresh()},[]);
 const entries=useMemo(()=>data?[...data.old,...data.newLeads]:[],[data]);
 const visible=group==="convert"?(data?.old||[]):(data?.newLeads||[]);
 const queue=entries.filter(entry=>selected.includes(entry.leadId));
 const canCommit=data?.active&&!data?.running&&data?.inFlight===0&&reviewed&&queue.length>0&&!busy
  &&queue.every(entry=>entry.mode!=="new"||!data?.intakePaused);
 function toggle(row){
  if(!row.eligible)return;
  setReviewed(false);setResult(null);
  setSelected(ids=>ids.includes(row.leadId)?ids.filter(id=>id!==row.leadId):
   ids.length>=10?ids:[...ids,row.leadId]);
 }
 function selectSuggested(){
  setSelected(visible.filter(x=>x.eligible).slice(0,10).map(x=>x.leadId));
  setReviewed(false);setResult(null);
 }
 async function commit(){
  if(!canCommit)return;
  if(!window.confirm("Confirma a alteração das mensagens dos contatos selecionados? Para aprovados antigos, o texto anterior será substituído apenas enquanto não foi enviado. Nenhum WhatsApp será disparado nesta operação."))return;
  const confirmation=window.prompt("Digite exatamente: CONFIRMO CAMPANHA BLACK FRIDAY")||"";
  if(confirmation!=="CONFIRMO CAMPANHA BLACK FRIDAY")return;
  setBusy(true);setError("");setResult(null);
  try{
   const items=queue.map(entry=>({
    mode:entry.mode,leadId:entry.leadId,
    originalMessage:entry.originalMessage,approvedAt:entry.approvedAt,
    message:drafts[entry.leadId]??entry.message
   }));
   const response=await fetch("/api/capture/campaign/prepare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items,confirmation})});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||"Falha ao confirmar revisão.");
   setResult(json);
   const refreshed=await fetch("/api/capture/campaign/prepare",{cache:"no-store"});
   const updated=await refreshed.json();
   if(refreshed.ok){setData(updated);setSelected([]);setDrafts({});setReviewed(false)}
   else setError(updated.error||"Atualize a lista antes de continuar.");
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className={s.panel} aria-labelledby="campaign-preparation-title">
  <header className={s.header}>
   <div><span className={s.eyebrow}>BLACK FRIDAY · MODO EMERGÊNCIA</span><h2 id="campaign-preparation-title">Preparar campanha e revisar a fila</h2>
    <p>Escolha até 10 contatos, confira os números e ajuste cada mensagem antes de autorizar. Aprovação não envia WhatsApp automaticamente.</p></div>
   <button type="button" onClick={refresh} disabled={busy}>{busy?"Carregando...":"Atualizar candidatos"}</button>
  </header>
  {!data&&<p>Carregando prévia de contatos...</p>}
  {data&&<>
   <div className={s.status}>
    <span>{data.active?"Campanha ativa":"Campanha desativada"}</span>
    <span>{data.running?"Captação ligada — pause antes de confirmar":"Captação pausada — revisão permitida"}</span>
    <span>{data.inFlight>0?data.inFlight+" envio(s) em andamento":"Sem envios em andamento"}</span>
   </div>
   {!data.active&&<p className={s.warning}>Ative a Black Friday no painel acima para preparar os contatos.</p>}
   {data.running&&<p className={s.warning}>Pause a Captação no painel acima antes de converter mensagens antigas ou aprovar novos contatos.</p>}
   {data.inFlight>0&&<p className={s.warning}>Confira os envios em andamento antes de confirmar qualquer alteração.</p>}
   <div className={s.tabs}>
    {GROUPS.map(([key,label])=><button key={key} type="button" aria-pressed={group===key} className={group===key?s.tabActive:""} onClick={()=>setGroup(key)}>{label} <strong>{key==="convert"?data.old.length:data.newLeads.length}</strong></button>)}
   </div>
   <div className={s.controls}>
    <button type="button" onClick={selectSuggested} disabled={busy||!visible.some(x=>x.eligible)}>Selecionar até 10 elegíveis desta aba</button>
    <button type="button" onClick={()=>{setSelected([]);setReviewed(false)}} disabled={busy||!selected.length}>Limpar seleção</button>
    <span>{selected.length}/10 selecionados</span>
   </div>
   {group==="new"&&data.intakePaused&&<p className={s.warning}>O CRM está com novas aprovações pausadas. Retome a entrada de leads no CRM para confirmar novos contatos.</p>}
   <div className={s.entries}>
    {visible.length===0&&<p>Nenhum contato encontrado para esta categoria.</p>}
    {visible.map(row=><article key={row.leadId} className={row.eligible?s.card:s.cardBlocked}>
     <div className={s.cardHead}>
      <label><input type="checkbox" disabled={!row.eligible||busy||(!selected.includes(row.leadId)&&selected.length>=10)} checked={selected.includes(row.leadId)} onChange={()=>toggle(row)}/>
       <strong>{row.name}</strong></label>
      <span>{row.eligible?"Elegível para revisão":"Bloqueado"}</span>
     </div>
     <small>{row.city||"Cidade não informada"} · {row.segment||"Segmento não informado"} · {row.phone||"Telefone ausente"}{row.mode==="new"?" · Score: "+row.score:" · Aprovado anteriormente"}</small>
     {!row.eligible&&<p className={s.warning}>{row.reason}</p>}
     {row.mode==="convert"&&row.originalMessage&&<details><summary>Ver mensagem anteriormente aprovada (não enviada)</summary><p className={s.oldText}>{row.originalMessage}</p></details>}
     {row.eligible&&<label className={s.editor}>Mensagem Black Friday para revisão
      <textarea rows={4} maxLength={500} disabled={busy} value={drafts[row.leadId]??row.message} onChange={e=>{setDrafts(prev=>({...prev,[row.leadId]:e.target.value}));setReviewed(false)}}/>
     </label>}
     <a href={"/crm/"+encodeURIComponent(row.leadId)} target="_blank" rel="noopener noreferrer">Conferir ficha no CRM</a>
    </article>)}
   </div>
   {queue.length>0&&<div className={s.queue}>
    <h3>Prévia da fila Black Friday ({queue.length})</h3>
    <p>Contatos selecionados aparecerão antes da fila tradicional quando a campanha estiver ativa. A ordem final respeita a data de aprovação e o worker.</p>
    <ol>{queue.map(row=><li key={row.leadId}><strong>{row.name}</strong> · {row.phone} · {row.mode==="convert"?"Converter texto já aprovado":"Novo primeiro contato"}<p>{drafts[row.leadId]??row.message}</p></li>)}</ol>
    <label className={s.review}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} disabled={busy}/> Conferi cada destinatário, o histórico no CRM, a mensagem e autorizo a preparação destas abordagens.</label>
    <button type="button" className={s.confirm} disabled={!canCommit} onClick={commit}>{busy?"Registrando...":"Confirmar revisão e preparar "+queue.length+" contato(s)"}</button>
   </div>}
  </>}
  {error&&<p role="alert" className={s.warning}>{error}</p>}
  {result&&<div className={s.result} role="status"><strong>{result.approved} preparado(s) · {result.review} para revisão</strong>
   {(result.results||[]).filter(x=>x.status==="review").map(x=><p key={x.leadId}>{x.leadId}: {x.reason}</p>)}
   <p>Não houve disparo de mensagens nesta etapa. Confira o contador da campanha antes de reativar a Captação.</p>
  </div>}
 </section>;
}
