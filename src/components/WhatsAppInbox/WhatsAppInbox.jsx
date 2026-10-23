"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import s from "./WhatsAppInbox.module.css";

export default function WhatsAppInbox({ inbox, leads = [] }) {
  const router = useRouter();
  const [selectedChat, setSelectedChat] = useState("");
  const [selectedLead, setSelectedLead] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const availableLeads = useMemo(() => leads.filter(lead => [lead.name, lead.phone, lead.city].some(x => String(x || "").toLowerCase().includes(leadSearch.toLowerCase()))).slice(0, 40), [leads, leadSearch]);
  async function linkConversation(chatId, leadId) {
    if (!chatId || (!leadId && selectedLead !== "__remove__")) return;
    setSaving(true); setError("");
    try {
      const removing = leadId === "__remove__";
      const response = await fetch("/api/whatsapp/links", { method: removing ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(removing ? { chatId } : { chatId, leadId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha na vinculação.");
      setSelectedChat(""); setSelectedLead(""); setLeadSearch(""); router.refresh();
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  }
  const [reviewChat,setReviewChat] = useState("");
  const [reviewText,setReviewText] = useState("");
  const [reviewReason,setReviewReason] = useState("");
  const [consent,setConsent] = useState(false);
  const [reviewBusy,setReviewBusy] = useState(false);
  async function decide(chatId,action){
    setReviewBusy(true);setError("");
    try {
      const response=await fetch("/api/recovery/decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId,action,messageText:reviewText,reason:reviewReason,consentConfirmed:consent})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Falha ao registrar decisão.");
      setReviewChat("");router.refresh();
    } catch(e){setError(e.message)}finally{setReviewBusy(false)}
  }
  const [historyChat,setHistoryChat]=useState("");
  const [historyData,setHistoryData]=useState(null);
  const [historyBusy,setHistoryBusy]=useState(false);
  async function loadHistory(chatId) {
    if(historyChat===chatId){setHistoryChat("");return;}
    setHistoryChat(chatId);setHistoryBusy(true);setHistoryData(null);
    try {
      const r=await fetch("/api/recovery/history?chatId="+encodeURIComponent(chatId),{cache:"no-store"});
      const d=await r.json();setHistoryData(r.ok?d:{error:d.error||"Não foi possível consultar histórico."});
    }catch(e){setHistoryData({error:e.message});}finally{setHistoryBusy(false)}
  }
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const chats = useMemo(() => inbox.chats.filter(chat => {
    if (mode === "matched" && !chat.leadId) return false;
    if (mode === "unmatched" && chat.leadId) return false;
    return [chat.name, chat.id, chat.leadName].some(value => String(value || "").toLowerCase().includes(query.toLowerCase()));
  }), [inbox.chats, mode, query]);
  const matched = inbox.chats.filter(chat => chat.leadId).length;
  return <main className={s.main}>
    <a href="/recuperacao" className={s.back}>← Voltar para Recuperação</a>
    <div className={s.heading}><div><span className={s.kicker}>LEADFLOW · OPENWA</span><h1>Prospecção de Clientes</h1><p>Exibe somente conversas com a etiqueta Prospecção de Clientes. Vínculos são feitos apenas por telefone já registrado no LeadFlow.</p></div><a href="/recuperacao/conversas" className={s.refresh}>Atualizar lista</a></div>
    {!inbox.ready && <div className={s.warning} role="status">{inbox.message}</div>}
    {inbox.ready && inbox.resolutionAttempted > 0 && <p className={s.note}>Mapeamento seguro de identidades: {inbox.resolved} vínculo(s) identificado(s) em {inbox.resolutionAttempted} consulta(s) @lid. Contatos sem mapeamento permanecem separados do CRM.</p>}
    <section className={s.stats}><div><span>Conversas da etiqueta</span><strong>{inbox.chats.length}</strong></div><div><span>Vinculadas a leads</span><strong>{matched}</strong></div><div><span>Ainda não vinculadas</span><strong>{inbox.chats.length-matched}</strong></div></section>
    <div className={s.controls}><input type="search" placeholder="Buscar nome ou telefone" aria-label="Buscar conversas" value={query} onChange={e=>setQuery(e.target.value)}/><select value={mode} onChange={e=>setMode(e.target.value)} aria-label="Filtrar conversas"><option value="all">Todas as conversas</option><option value="matched">Vinculadas</option><option value="unmatched">Sem vínculo</option></select></div>
    <div className={s.list}>{error && <p role="alert" className={s.warning}>{error}</p>}{chats.length===0?<p>Nenhuma conversa para este filtro.</p>:chats.map(chat=><article key={chat.id} className={s.chat}><div><strong>{chat.leadName || chat.name}</strong><small>{chat.id}</small></div><div className={s.side}>{chat.leadId?<span className={s.linked}>Lead vinculado · {chat.leadStage || "novo"}</span>:<span className={s.pending}>Ainda não vinculado</span>}{chat.unreadCount>0&&<small>{chat.unreadCount} não lida(s)</small>}<button type="button" className={s.refresh} onClick={() => { setSelectedChat(chat.id); setSelectedLead(""); setLeadSearch(""); setError(""); }}> {chat.manuallyLinked ? "Alterar vínculo" : "Vincular manualmente"} </button></div>
    {selectedChat === chat.id && <div className={s.linkForm}>
      <label>Buscar lead existente<input type="search" value={leadSearch} onChange={e=>setLeadSearch(e.target.value)} placeholder="Nome, cidade ou telefone" /></label>
      <label>Selecionar lead<select value={selectedLead} onChange={e=>setSelectedLead(e.target.value)}><option value="">Escolha um lead</option>{availableLeads.map(lead=><option key={lead.id} value={lead.id}>{lead.name} — {lead.phone || lead.city || "Sem telefone"}</option>)}</select></label>
      <div className={s.linkActions}><button type="button" disabled={!selectedLead || saving} onClick={()=>linkConversation(chat.id, selectedLead)}>Salvar vínculo</button>
      {chat.manuallyLinked && <button type="button" disabled={saving} onClick={()=>linkConversation(chat.id, "__remove__")}>Desvincular</button>}
      <button type="button" disabled={saving} onClick={()=>setSelectedChat("")}>Cancelar</button></div>
    </div>}
    {chat.leadId && <section className={s.recoveryControls}>
      <button type="button" onClick={()=>loadHistory(chat.id)}>{historyChat===chat.id?"Ocultar histórico":"Auditar mensagens anteriores"}</button>
      {historyChat===chat.id&&<div className={s.historyPanel}>
        {historyBusy?<p>Consultando mensagens no OpenWA...</p>:historyData?.error?<p role="alert">{historyData.error}</p>:historyData&&<>
          <p><strong>Diagnóstico informativo:</strong> {historyData.analysis.rationale}</p>
          <p>Enviadas: {historyData.analysis.outgoingCount} · Recebidas: {historyData.analysis.incomingCount} · Registros: {historyData.analysis.examinedCount}/{historyData.analysis.total}</p>
          {historyData.analysis.historyIncomplete&&<p>Histórico parcial: não classifique como silêncio definitivo sem revisar outras mensagens.</p>}
          <div className={s.historyMessages}>{historyData.messages.slice().sort((a,b)=>(a.timestamp||0)-(b.timestamp||0)).map((m,i)=><div key={m.id||i} className={s.historyMessage}><strong>{m.direction==="outgoing"?"Você enviou":"Contato respondeu"}</strong><span>{m.timestamp?new Date(m.timestamp*1000).toLocaleString("pt-BR"):"Data indisponível"}</span><p>{m.body||"(mensagem sem texto — "+m.type+")"}</p></div>)}</div>
          <p>O diagnóstico NÃO aprova nem rejeita o lead. Use os botões de revisão para registrar sua decisão.</p>
        </>}
      </div>}

      <strong>Recuperação: {({pending:"Pendente de decisão",eligible:"Elegível aprovado",ineligible:"Não elegível aprovado",message_approved:"Mensagem aprovada, não enviada",message_rejected:"Mensagem rejeitada",sent:"Enviada",close_approved:"Encerramento aprovado",close_rejected:"Encerramento rejeitado"})[chat.recovery?.status||"pending"]}</strong>
      <button type="button" onClick={()=>{setReviewChat(chat.id);setReviewText(chat.recovery?.messageText||"");setReviewReason(chat.recovery?.reason||"");setConsent(false);}}>Revisar recuperação</button>
      {reviewChat===chat.id&&<div className={s.reviewForm}>
        <p>Sua decisão prevalece. Nenhum envio é realizado nesta tela.</p>
        <label>Motivo<input value={reviewReason} onChange={e=>setReviewReason(e.target.value)}/></label>
        <label>Mensagem para revisão<textarea rows={4} value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="Mensagem contextualizada para esta conversa"/></label>
        <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Confirmo permissão adequada para mensagens comerciais</label>
        <div className={s.reviewActions}>
        {["pending","ineligible","message_rejected","message_approved","close_approved"].includes(chat.recovery?.status||"pending")&&<button disabled={reviewBusy} onClick={()=>decide(chat.id,"eligible")}>Aprovar elegível</button>}
        {["pending","eligible","message_rejected"].includes(chat.recovery?.status||"pending")&&<button disabled={reviewBusy} onClick={()=>decide(chat.id,"ineligible")}>Aprovar não elegível</button>}
        {["eligible","message_rejected"].includes(chat.recovery?.status)&&<button disabled={reviewBusy||!consent||!reviewText.trim()} onClick={()=>decide(chat.id,"message_approved")}>Aprovar mensagem</button>}
        {chat.recovery?.status==="message_approved"&&<button disabled={reviewBusy} onClick={()=>decide(chat.id,"message_rejected")}>Rejeitar mensagem</button>}
        {chat.recovery?.status==="sent"&&<><button disabled={reviewBusy} onClick={()=>decide(chat.id,"close_approved")}>Aprovar encerramento</button><button disabled={reviewBusy} onClick={()=>decide(chat.id,"close_rejected")}>Rejeitar encerramento</button></>}
        <button disabled={reviewBusy} onClick={()=>setReviewChat("")}>Cancelar</button>
        </div>
      </div>}
    </section>}</article>)}</div>
    <p className={s.note}>Esta consulta utiliza a etiqueta Prospecção de Clientes. Chats com ID @lid não são vinculados automaticamente por telefone. Nenhuma mensagem é enviada, nenhum histórico é importado e nenhum lead é alterado nesta etapa.</p>
  </main>;
}
