"use client";
import { useMemo, useState } from "react";
import s from "./WhatsAppInbox.module.css";

export default function WhatsAppInbox({ inbox }) {
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
    <div className={s.heading}><div><span className={s.kicker}>LEADFLOW · OPENWA</span><h1>Conversas do WhatsApp</h1><p>Consulta em modo leitura. Correspondências encontradas exclusivamente pelo telefone já registrado no LeadFlow.</p></div><a href="/recuperacao/conversas" className={s.refresh}>Atualizar lista</a></div>
    {!inbox.ready && <div className={s.warning} role="status">{inbox.message}</div>}
    <section className={s.stats}><div><span>Conversas retornadas</span><strong>{inbox.chats.length}</strong></div><div><span>Vinculadas a leads</span><strong>{matched}</strong></div><div><span>Ainda não vinculadas</span><strong>{inbox.chats.length-matched}</strong></div></section>
    <div className={s.controls}><input type="search" placeholder="Buscar nome ou telefone" aria-label="Buscar conversas" value={query} onChange={e=>setQuery(e.target.value)}/><select value={mode} onChange={e=>setMode(e.target.value)} aria-label="Filtrar conversas"><option value="all">Todas as conversas</option><option value="matched">Vinculadas</option><option value="unmatched">Sem vínculo</option></select></div>
    <div className={s.list}>{chats.length===0?<p>Nenhuma conversa para este filtro.</p>:chats.map(chat=><article key={chat.id} className={s.chat}><div><strong>{chat.leadName || chat.name}</strong><small>{chat.id}</small></div><div className={s.side}>{chat.leadId?<span className={s.linked}>Lead vinculado · {chat.leadStage || "novo"}</span>:<span className={s.pending}>Ainda não vinculado</span>}{chat.unreadCount>0&&<small>{chat.unreadCount} não lida(s)</small>}</div></article>)}</div>
    <p className={s.note}>A lista do WhatsApp Business pode não corresponder ao conjunto completo de conversas retornado pelo OpenWA. Não enviamos mensagens, importamos históricos ou alteramos leads nesta etapa.</p>
  </main>;
}
