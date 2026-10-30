"use client";
import {useEffect,useState} from "react";
import s from "./CaptureControl.module.css";
export default function CaptureControl(){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function refresh(){
  const res=await fetch("/api/capture/control",{cache:"no-store"});
  const data=await res.json();if(!res.ok)throw Error(data.error||"Falha ao consultar Captação.");
  setState(data);
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message));const timer=setInterval(()=>refresh().catch(e=>setError(e.message)),30000);return ()=>clearInterval(timer)},[]);
 async function toggle(){
  const action=state.running?"pause":"start";
  const question=action==="start"
   ?"Iniciar o Agente de Captação? Leads aprovados poderão receber WhatsApp automaticamente durante o expediente, respeitando descanso e cota compartilhados.":"Pausar novos envios da Captação? Um envio já iniciado pode terminar.";
  if(!confirm(question))return;
  let confirmation="";
  if(action==="start"){confirmation=prompt("Para iniciar os envios reais, digite exatamente: INICIAR CAPTAÇÃO")||"";if(confirmation!=="INICIAR CAPTAÇÃO")return}
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/capture/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,confirmation})});
   const json=await response.json();if(!response.ok)throw Error(json.error||"Falha ao alterar Captação.");
   setState(json);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className={s.panel}>
  <div><strong>Agente de Captação</strong><p>{state?.running?"Ativo — aguardando o próximo ciclo permitido pelo worker.":"Pausado — nenhum novo envio de Captação será iniciado."}</p>
  <small>Somente leads autorizados individualmente · 08h–18h · 30 min de descanso · até 10 envios/dia para Captação e outros 10 para Recuperação</small>
  {state&&<p>{state.approved} aprovado(s) aguardando · {state.sent} enviado(s) · {state.uncertain} em andamento/incerto(s)</p>}
  {state?.blocked&&<p role="status" className={s.error}>Há um envio em andamento. O agente aguardará sua conclusão antes de abordar o próximo lead.</p>}
  {state&&state.uncertain>0&&<p role="status">{state.uncertain} tentativa(s) em andamento/incerta(s) para conferência. Resultados incertos não bloqueiam os próximos leads; não serão reenviados automaticamente.</p>}
  {error&&<p role="alert" className={s.error}>{error}</p>}</div>
  <button type="button" onClick={toggle} disabled={busy||!state}>{busy?"Atualizando...":state?.running?"Pausar Captação":"Iniciar Captação"}</button>
 </section>;
}
