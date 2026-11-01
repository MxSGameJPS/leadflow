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
 async function toggle(agent="capture"){
  const recovery=agent==="recovery";
  const action=recovery?(state.recoveryRunning?"pause_recovery":"start_recovery"):(state.running?"pause":"start");
  const question=action.startsWith("start")
   ?"Ativar "+(recovery?"Recuperação":"Captação")+"? Envios aprovados acontecerão somente no expediente (08h–18h), nunca aos domingos, respeitando limites e intervalos.": "Pausar novos envios da "+(recovery?"Recuperação":"Captação")+"? Um envio já iniciado pode terminar.";
  if(!confirm(question))return;
  let confirmation="";
  if(action.startsWith("start")){const phrase=recovery?"INICIAR RECUPERAÇÃO":"INICIAR CAPTAÇÃO";confirmation=prompt("Para habilitar envios reais, digite exatamente: "+phrase)||"";if(confirmation!==phrase)return}
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/capture/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,confirmation})});
   const json=await response.json();if(!response.ok)throw Error(json.error||"Falha ao alterar Captação.");
   setState(json);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className={s.panel}>
  <div><strong>Agente de Captação</strong><p>{state?.running?"Ativo — aguardando o próximo ciclo permitido pelo worker.":"Pausado — nenhum novo envio de Captação será iniciado."}</p>
  <small>Captação: {state?.running?"ligada":"desligada"} · Recuperação: {state?.recoveryRunning?"ligada":"desligada"} · 08h–18h, segunda a sábado · domingo sem envio automático · até 10 mensagens/dia por agente · intervalo de 30 min</small>
  {state?.sundayBlocked&&<p role="status">Hoje é domingo: ambos os agentes ficam impedidos de enviar, mesmo se a chave estiver ligada. O painel continua disponível.</p>}
  {state&&<p>{state.approved} aprovado(s) aguardando · {state.sent} enviado(s) · {state.uncertain} em andamento/incerto(s)</p>}
  {state?.blocked&&<p role="status" className={s.error}>Há um envio em andamento. O agente aguardará sua conclusão antes de abordar o próximo lead.</p>}
  {state&&state.uncertain>0&&<p role="status">{state.uncertain} tentativa(s) em andamento/incerta(s) para conferência. Resultados incertos não bloqueiam os próximos leads; não serão reenviados automaticamente.</p>}
  {error&&<p role="alert" className={s.error}>{error}</p>}</div>
  <div className={s.controls}>
   <button type="button" onClick={()=>toggle("capture")} disabled={busy||!state}>{busy?"Atualizando...":state?.running?"Pausar Captação":"Iniciar Captação"}</button>
   <button type="button" onClick={()=>toggle("recovery")} disabled={busy||!state}>{busy?"Atualizando...":state?.recoveryRunning?"Pausar Recuperação":"Iniciar Recuperação"}</button>
  </div>
 </section>;
}
