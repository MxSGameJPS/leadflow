"use client";
import { useState } from "react";
import s from "./CommercialSettings.module.css";
export default function CommercialSettings({initialPolicy}){
 const [services,setServices]=useState(initialPolicy.services);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 async function save(){
  setSaving(true);setMessage("");
  try {
   const response=await fetch("/api/commercial/policy",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...initialPolicy,services})});
   const payload=await response.json();
   if(!response.ok)throw Error(payload.error||"Falha ao salvar.");
   setMessage("Tabela comercial salva.");
  }catch(error){setMessage(error.message)}finally{setSaving(false)}
 }
 return <main className={s.main}><header><span className={s.kicker}>LeadFlow · Regras do agente</span><h1>Política comercial</h1><p>Valores iniciais e limites comerciais utilizados para orientar o atendimento. Nenhum envio automático é ativado nesta página.</p></header>
 <section className={s.grid}>{services.map(item=><article className={s.card} key={item.id}><h2>{item.name}</h2><label>Preço a partir de (R$)<input type="number" min="1" step="1" value={item.minimumPrice} onChange={e=>setServices(old=>old.map(x=>x.id===item.id?{...x,minimumPrice:Number(e.target.value)}:x))}/></label><p>Suporte: {item.supportDays} dias</p>{item.id==="express"?<label>Menor preço autorizado (R$)<input type="number" min="1" step="1" value={item.minimumNegotiablePrice} onChange={e=>setServices(old=>old.map(x=>x.id===item.id?{...x,minimumNegotiablePrice:Number(e.target.value)}:x))}/></label>:<p>Desconto máximo: 15%</p>}</article>)}</section>
 <section className={s.rules}><h2>Regras obrigatórias</h2><p>Entrada: 50% no fechamento do contrato. Call ou reunião presencial obrigatória antes de qualquer fechamento.</p><p>Hospedagem gratuita em plano elegível de Vercel, Netlify ou similar. Domínio à parte, com orientação para compra. SEO avançado; Supabase gratuito quando aplicável e dentro dos limites do provedor.</p><p>Todo projeto inclui Manual do Proprietário com stack e acessos técnicos aplicáveis.</p><p>O agente não pode inventar valores, cronogramas, serviços incluídos ou disponibilidade.</p></section>
 <button className={s.save} type="button" disabled={saving} onClick={save}>{saving?"Salvando...":"Salvar tabela comercial"}</button>{message&&<p role="status">{message}</p>}</main>;
}
