"use client";
import {useState} from "react";
import s from "./CaptureApproval.module.css";
export default function CaptureApproval({lead,initialMessage}){
 const [message,setMessage]=useState(initialMessage||"");
 const [whatsapp,setWhatsapp]=useState(lead.whatsapp||"");
 const [approval,setApproval]=useState(null);
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [loaded,setLoaded]=useState(false);
 async function load(){
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/capture/lead?leadId="+encodeURIComponent(lead.id),{cache:"no-store"}),d=await r.json();
   if(!r.ok)throw Error(d.error||"Erro ao consultar autorização");
   setApproval(d.approval);if(d.approval?.messageText)setMessage(d.approval.messageText);setLoaded(true);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function act(action){
  if(!loaded){setError("Clique primeiro em 'Consultar situação'.");return}
  if(action!=="save_phone"&&!confirm(action==="approve"?"Confirmar aprovação individual desta abordagem? Não haverá envio imediato.":"Rejeitar a primeira abordagem?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/capture/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({leadId:lead.id,action,messageText:message,confirmed,whatsapp})}),d=await r.json();
   if(!r.ok)throw Error(d.error||"Falha ao registrar");
   if(d.approval)setApproval(d.approval);if(d.whatsapp)setWhatsapp(d.whatsapp);setNotice(d.notice||"Decisão salva.");
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className={s.card}><h2>Agente de Captação — primeiro contato</h2>
 <p>Nova abordagem preparada na ficha do lead. Você revisa e autoriza individualmente. Não utiliza a fila de Recuperação.</p>
 <p><strong>Empresa:</strong> {lead.name} · <strong>Telefone comercial:</strong> {lead.phone||"Não informado"} (não confirmado como WhatsApp)</p>
 <label>WhatsApp confirmado do destinatário <input className={s.phone} type="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} disabled={busy||["approved","sending","sent","uncertain"].includes(approval?.status)} placeholder="Ex.: 51999998888"/></label>
 <p>Não copiamos automaticamente o telefone do Google: confirme que o número pertence à empresa e recebe WhatsApp.</p>
 <button type="button" disabled={busy||!loaded||["approved","sending","sent","uncertain"].includes(approval?.status)} onClick={()=>act("save_phone")}>Salvar WhatsApp na ficha</button>
 <button type="button" disabled={busy} onClick={load}>Consultar situação</button>
 {loaded&&<p role="status">Situação: <strong>{({approved:"Aprovada — aguardando despacho (Captação exige ativação específica)",rejected:"Rejeitada",draft:"Rascunho",sending:"Enviando",sent:"Enviada",uncertain:"Envio incerto"})[approval?.status]||"Não avaliada"}</strong></p>}
 <label>Mensagem de primeiro contato <textarea rows={7} disabled={busy||!loaded||["approved","sending","sent","uncertain"].includes(approval?.status)} value={message} onChange={e=>setMessage(e.target.value)}/></label>
 <label className={s.check}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo que revisei o destinatário, a mensagem e a base apropriada para este contato.</label>
 <div className={s.actions}><button type="button" disabled={busy||!loaded||!confirmed||["approved","sending","sent","uncertain"].includes(approval?.status)} onClick={()=>act("approve")}>Aprovar primeiro contato</button><button type="button" disabled={busy||approval?.status==="approved"||approval?.status==="sent"} onClick={()=>act("reject")}>Rejeitar</button></div>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <small>As mensagens aprovadas são processadas pelo worker somente quando LEADFLOW_CAPTURE_AUTO_SEND=true. O padrão é desligado. O expediente, a pausa e a cota são compartilhados com Recuperação.</small>
 </section>;
}
