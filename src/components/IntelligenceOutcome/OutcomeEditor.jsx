"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import styles from "./OutcomeEditor.module.css";
const stages=[["contacted","Abordado"],["interested","Interessado"],["meeting_scheduled","Reunião agendada"],["meeting_held","Reunião realizada"],["proposal_sent","Proposta enviada"],["won","Contrato fechado"],["lost","Perdido"]];
export default function OutcomeEditor({observationId,initial}){
 const router=useRouter(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [stage,setStage]=useState(initial?.stage||"contacted"),[meetingAt,setMeetingAt]=useState(initial?.meetingAt?new Date(initial.meetingAt).toISOString().slice(0,16):""),[proposal,setProposal]=useState(initial?.proposalAmount!=null?String(initial.proposalAmount/100):""),[contract,setContract]=useState(initial?.contractAmount!=null?String(initial.contractAmount/100):""),[reason,setReason]=useState(initial?.lossReason||""),[notes,setNotes]=useState(initial?.notes||"");
 const money=v=>v===""?null:Math.round(Number(v.replace(",","."))*100);
 async function save(){
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/intelligence/outcome",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({observationId,stage,meetingAt:meetingAt||null,proposalAmount:money(proposal),contractAmount:money(contract),lossReason:reason,notes})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"Não foi possível salvar");
   setOpen(false);router.refresh();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className={styles.editor}><strong>{stages.find(x=>x[0]===(initial?.stage||"contacted"))?.[1]}</strong><button type="button" onClick={()=>setOpen(!open)}>{open?"Fechar":"Registrar etapa"}</button>{open&&<div className={styles.fields}>
  <label>Etapa<select value={stage} onChange={e=>setStage(e.target.value)}>{stages.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
  {stage==="meeting_scheduled"&&<label>Data da reunião<input type="datetime-local" value={meetingAt} onChange={e=>setMeetingAt(e.target.value)}/></label>}
  {["proposal_sent","won"].includes(stage)&&<label>Valor da proposta (R$)<input inputMode="decimal" value={proposal} onChange={e=>setProposal(e.target.value)} placeholder="1700,00"/></label>}
  {stage==="won"&&<label>Contrato (R$)<input inputMode="decimal" value={contract} onChange={e=>setContract(e.target.value)} placeholder="1700,00"/></label>}
  {stage==="lost"&&<label>Motivo da perda<textarea value={reason} onChange={e=>setReason(e.target.value)}/></label>}
  <label>Observações<textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label>
  {error&&<small role="alert">{error}</small>}<button disabled={busy} type="button" onClick={save}>{busy?"Salvando...":"Salvar resultado"}</button>
 </div>}</div>;
}
