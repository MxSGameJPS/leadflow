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
    </div>}</article>)}</div>
    <p className={s.note}>Esta consulta utiliza a etiqueta Prospecção de Clientes. Chats com ID @lid não são vinculados automaticamente por telefone. Nenhuma mensagem é enviada, nenhum histórico é importado e nenhum lead é alterado nesta etapa.</p>
  </main>;
}
