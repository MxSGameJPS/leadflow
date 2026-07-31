"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { moveConsultingStageAction } from "../../app/actions/consulting.js";
import { CONSULTING_STAGES, CONSULTING_STAGE_IDS } from "../../services/consulting/stages.js";
import s from "./ConsultingBoard.module.css";

const STAGE_COLOR = {
  novo: "#8b949e",
  analise: "#1473e6",
  relatorio_pronto: "#6d5ce7",
  abordagem: "#f59e0b",
  interessado: "#0ea5a5",
  pagamento: "#f2760c",
  vendido: "#22c55e",
  entregue: "#16a34a",
  perdido: "#ef4444",
};

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function possibleMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return /^\d{2}9\d{8}$/.test(local);
}

function whatsappUrl(lead) {
  const raw = lead.whatsapp || (possibleMobile(lead.phone) ? lead.phone : "");
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  const message = String(lead.consulting?.whatsappMessage || "").trim();
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

function presenceLabel(lead) {
  const hasSite = Boolean(lead.consulting?.websiteUrl || lead.site);
  const hasInstagram = Boolean(lead.consulting?.instagramUrl || lead.instagram);
  if (hasSite && hasInstagram) return "Site + Instagram";
  if (hasSite) return "Site";
  if (hasInstagram) return "Instagram";
  return "Sem canal informado";
}

export default function ConsultingBoard({ initialLeads = [] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("all");
  const [presence, setPresence] = useState("all");
  const [sort, setSort] = useState("recent");
  const [dragOver, setDragOver] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setLeads(initialLeads), [initialLeads]);

  const visible = useMemo(() => {
    const query = normalize(search);
    const filtered = leads.filter(lead => {
      const consulting = lead.consulting || {};
      if (query) {
        const haystack = normalize([lead.name, lead.segment, lead.city, lead.location, lead.phone, lead.whatsapp, lead.site, lead.instagram].filter(Boolean).join(" "));
        if (!haystack.includes(query)) return false;
      }
      if (grade !== "all" && lead.grade !== grade) return false;
      const hasSite = Boolean(consulting.websiteUrl || lead.site);
      const hasInstagram = Boolean(consulting.instagramUrl || lead.instagram);
      if (presence === "site" && !hasSite) return false;
      if (presence === "instagram" && !hasInstagram) return false;
      if (presence === "none" && (hasSite || hasInstagram)) return false;
      if (presence === "ready" && !consulting.report) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "score") return Number(b.consulting?.overallScore || 0) - Number(a.consulting?.overallScore || 0);
      if (sort === "name") return String(a.name).localeCompare(String(b.name), "pt-BR");
      return new Date(b.consulting?.lastAnalyzedAt || b.updatedAt || b.createdAt || 0) - new Date(a.consulting?.lastAnalyzedAt || a.updatedAt || a.createdAt || 0);
    });
  }, [leads, grade, presence, search, sort]);

  const byStage = useMemo(() => {
    const grouped = Object.fromEntries(CONSULTING_STAGE_IDS.map(id => [id, []]));
    for (const lead of visible) {
      const stage = CONSULTING_STAGE_IDS.includes(lead.consulting?.stage) ? lead.consulting.stage : "novo";
      grouped[stage].push(lead);
    }
    return grouped;
  }, [visible]);

  const totals = useMemo(() => ({
    reports: leads.filter(lead => lead.consulting?.report).length,
    sold: leads.filter(lead => ["vendido", "entregue"].includes(lead.consulting?.stage)).length,
    potential: leads.reduce((sum, lead) => sum + (["vendido", "entregue"].includes(lead.consulting?.stage) ? 0 : Number(lead.consulting?.priceCents || 5000)), 0),
  }), [leads]);

  async function moveLead(leadId, stage) {
    const previous = leads;
    setLeads(current => current.map(lead => lead.id === leadId ? { ...lead, consulting: { ...lead.consulting, stage } } : lead));
    setNotice("");
    try {
      const saved = await moveConsultingStageAction(leadId, stage);
      setLeads(current => current.map(lead => lead.id === leadId ? { ...lead, consulting: saved } : lead));
      router.refresh();
    } catch (error) {
      setLeads(previous);
      setNotice(`Erro ao mover consultoria: ${error.message}`);
    }
  }

  return <main className={s.page}>
    <header className={s.header}>
      <div>
        <span className={s.eyebrow}>Monetização de leads C e D</span>
        <h1>Consultorias</h1>
        <p>Analise a presença digital existente, venda o relatório e transforme diagnósticos em novos projetos.</p>
      </div>
      <div className={s.summaryCards}>
        <div><strong>{leads.length}</strong><span>leads</span></div>
        <div><strong>{totals.reports}</strong><span>relatórios</span></div>
        <div><strong>{totals.sold}</strong><span>vendidas</span></div>
        <div><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totals.potential / 100)}</strong><span>potencial</span></div>
      </div>
    </header>

    <section className={s.toolbar}>
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa, nicho, cidade ou contato..." />
      <select value={grade} onChange={event => setGrade(event.target.value)}>
        <option value="all">Notas C e D</option>
        <option value="C">Somente nota C</option>
        <option value="D">Somente nota D</option>
      </select>
      <select value={presence} onChange={event => setPresence(event.target.value)}>
        <option value="all">Toda presença digital</option>
        <option value="site">Com site</option>
        <option value="instagram">Com Instagram</option>
        <option value="ready">Com relatório pronto</option>
        <option value="none">Sem canal informado</option>
      </select>
      <select value={sort} onChange={event => setSort(event.target.value)}>
        <option value="recent">Mais recentes</option>
        <option value="score">Maior score do diagnóstico</option>
        <option value="name">Nome da empresa</option>
      </select>
    </section>

    {notice && <div className={s.notice}>{notice}</div>}
    <div className={s.counter}>{visible.length} de {leads.length} leads exibidos</div>

    <section className={s.board}>
      {CONSULTING_STAGES.map(stage => <div
        key={stage.id}
        className={`${s.column} ${dragOver === stage.id ? s.dragOver : ""}`}
        onDragOver={event => { event.preventDefault(); setDragOver(stage.id); }}
        onDragLeave={() => setDragOver(current => current === stage.id ? "" : current)}
        onDrop={event => {
          event.preventDefault();
          setDragOver("");
          const leadId = event.dataTransfer.getData("text/plain");
          if (leadId) moveLead(leadId, stage.id);
        }}
      >
        <div className={s.columnHeader}>
          <span style={{ background: STAGE_COLOR[stage.id] }} />
          <strong>{stage.label}</strong>
          <em>{byStage[stage.id].length}</em>
        </div>
        <small>{stage.sub}</small>
        <div className={s.columnBody}>
          {!byStage[stage.id].length
            ? <div className={s.empty}>Sem consultorias</div>
            : byStage[stage.id].map(lead => {
              const consulting = lead.consulting || {};
              const wa = whatsappUrl(lead);
              const score = Number(consulting.overallScore || 0);
              return <article
                key={lead.id}
                className={s.card}
                draggable
                onDragStart={event => event.dataTransfer.setData("text/plain", lead.id)}
                onClick={() => router.push(`/consultoria/${lead.id}`)}
              >
                <div className={s.cardTop}>
                  <span className={`${s.grade} ${s[`grade${lead.grade}`]}`}>Nota {lead.grade}</span>
                  <span className={score ? s.auditScore : s.pendingScore}>{score ? `${score}/100` : "Não analisado"}</span>
                  <button type="button" onClick={event => { event.stopPropagation(); router.push(`/consultoria/${lead.id}`); }}>›</button>
                </div>
                <h2>{lead.name}</h2>
                <p>{lead.segment || "Sem categoria"} · {[lead.city, lead.location].filter(Boolean).join(", ") || "Local não informado"}</p>
                <div className={s.presence}>{presenceLabel(lead)}</div>
                {consulting.executiveSummary && <blockquote>{consulting.executiveSummary}</blockquote>}
                <div className={s.cardActions}>
                  <button type="button" onClick={event => { event.stopPropagation(); router.push(`/consultoria/${lead.id}`); }}>Abrir análise</button>
                  {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>WhatsApp</a> : <span>Sem WhatsApp</span>}
                </div>
              </article>;
            })}
        </div>
      </div>)}
    </section>
  </main>;
}
