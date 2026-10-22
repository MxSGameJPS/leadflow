"use client";
import { useMemo, useState } from "react";
import s from "./RecoveryPanel.module.css";

const captions = { review: "Para revisar", active: "Em andamento", excluded: "Excluídos", incomplete: "Sem telefone", low_priority: "Baixa prioridade" };
const stages = ["review", "active", "excluded", "incomplete", "low_priority"];
export default function RecoveryPanel({ groups, connection }) {
  const [filter, setFilter] = useState("review");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const items = useMemo(() => (groups[filter] || []).filter(lead => [lead.name, lead.phone, lead.whatsapp, lead.segment, lead.city].some(value => String(value || "").toLowerCase().includes(search.toLowerCase()))), [groups, filter, search]);
  const count = Object.values(groups).reduce((sum, rows) => sum + rows.length, 0);
  return <main className={s.main}>
    <header className={s.header}><div><span className={s.eyebrow}>LeadFlow · Motor comercial</span><h1>Recuperação de leads</h1><p>Organize sua carteira antiga, revise conversas e prepare acompanhamentos. Nenhuma mensagem é enviada automaticamente.</p></div><span className={s.status}>{connection.connected ? "OpenWA conectado" : connection.configured ? "OpenWA desconectado" : "OpenWA não configurado"}</span></header>
    <section className={s.metrics} aria-label="Resumo">{[{label:"Leads cadastrados",number:count},...stages.map(key=>({label:captions[key],number:groups[key].length}))].map(item=><div className={s.metric} key={item.label}><span>{item.label}</span><strong>{item.number}</strong></div>)}</section>
    <section className={s.content}><div className={s.queue}><div className={s.toolbar}><h2>Fila de triagem</h2><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar por nome, cidade ou telefone" aria-label="Buscar leads"/></div><div className={s.filters}>{stages.map(key=><button type="button" className={filter===key?s.active:""} key={key} onClick={()=>{setFilter(key);setSelected(null)}}>{captions[key]} ({groups[key].length})</button>)}</div>
    <div className={s.list}>{items.length===0?<p className={s.empty}>Nenhum lead nesta categoria.</p>:items.slice(0,200).map(lead=><button type="button" key={lead.id} onClick={()=>setSelected(lead)} className={s.lead}><strong>{lead.name}</strong><span>{[lead.segment,lead.city].filter(Boolean).join(" · ") || "Sem segmento ou cidade"}</span><small>{lead.recoveryReason}</small></button>)}</div></div>
    <aside className={s.detail}>{selected?<><h2>{selected.name}</h2><p>{selected.recoveryReason}</p><dl><dt>WhatsApp</dt><dd>{selected.whatsapp || selected.phone || "Não informado"}</dd><dt>Etapa</dt><dd>{selected.stage || "novo"}</dd><dt>Site</dt><dd>{selected.site || "Não informado"}</dd><dt>Observações</dt><dd>{selected.notes || "Sem histórico registrado"}</dd></dl><div className={s.notice}><strong>Antes de fazer follow-up</strong><p>Verifique o histórico completo da conversa, a existência de consentimento e eventuais pedidos de não contato. Ausência de resposta não é autorização para mensagens automáticas.</p></div><a href="/leads">Abrir gestão de leads →</a></>:<div className={s.placeholder}><h2>Selecione um lead</h2><p>Veja dados, observações e motivo da classificação. A conexão com OpenWA é somente consulta de status nesta etapa.</p>{connection.message&&<p>{connection.message}</p>}</div>}</aside></section>
  </main>;
}
