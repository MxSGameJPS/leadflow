"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES, STAGE_IDS } from "../../services/leads/stages.js";
import {
  createLeadAction,
  deleteLeadAction,
  deleteLeadsAction,
  moveStageAction,
  recordContactAction,
} from "../../app/actions/leads.js";
import s from "./CRMBoard.module.css";

const STAGE_COLOR = {
  novo: "#8b949e",
  contatado: "#1473e6",
  sem_resposta: "#f59e0b",
  com_resposta: "#0ea5a5",
  proposta: "#6d5ce7",
  proposta_rejeitada: "#ef4444",
  negociacao: "#f2760c",
  ganho: "#22c55e",
  perdido: "#ef4444",
};

const GRADE_LABEL = { A: "Quente", B: "Morno", C: "Em análise", D: "Frio" };
const CLOSED_STAGES = new Set(["ganho", "perdido"]);

function csvValue(value) {
  const text = String(value ?? "");
  return /[;\n\r\"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeFilterValue(value) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function cityLabel(lead) {
  return String(lead?.city || "").trim() || "Sem cidade";
}

function cityKey(lead) {
  return normalizeFilterValue(cityLabel(lead)) || "__sem_cidade";
}

function isPossibleMobile(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return /^\d{2}9\d{8}$/.test(local);
}

function whatsappUrl(lead) {
  const raw = lead.whatsapp || (isPossibleMobile(lead.phone) ? lead.phone : "");
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}

function contactAgeDays(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const contactDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.floor((today - contactDay) / 86_400_000));
}

function lastContactLabel(lead) {
  const days = contactAgeDays(lead.lastContactAt);
  if (days == null) return "Nunca contatado";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days <= 15) return `Há ${days} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(lead.lastContactAt));
}

function matchesContactFilter(lead, filter) {
  if (filter === "all") return true;
  const days = contactAgeDays(lead.lastContactAt);
  if (filter === "never") return days == null;
  if (days == null) return false;
  if (filter === "today") return days === 0;
  if (filter === "1-3") return days >= 1 && days <= 3;
  if (filter === "4-7") return days >= 4 && days <= 7;
  if (filter === "8-15") return days >= 8 && days <= 15;
  if (filter === "16+") return days >= 16;
  return true;
}

function stageMeta(stageId) {
  return STAGES.find(stage => stage.id === stageId) || { id: stageId, label: stageId || "Etapa", sub: "" };
}

function todayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function priorityReason(lead) {
  const today = todayKey();
  const age = contactAgeDays(lead.lastContactAt);

  if (lead.followUpAt && lead.followUpAt <= today && !CLOSED_STAGES.has(lead.stage)) {
    return { rank: 0, label: lead.followUpAt < today ? "Follow-up atrasado" : "Follow-up para hoje", kind: "danger" };
  }
  if (lead.stage === "com_resposta") {
    return { rank: 1, label: "Cliente respondeu — avançar", kind: "hot" };
  }
  if (lead.stage === "negociacao" || lead.stage === "proposta") {
    return { rank: 2, label: lead.stage === "negociacao" ? "Negociação ativa" : "Proposta em aberto", kind: "money" };
  }
  if (lead.landingStatus === "done" && lead.stage === "novo") {
    return { rank: 3, label: "Prévia pronta — ainda não enviada", kind: "preview" };
  }
  if (lead.grade === "A" && age == null && lead.stage === "novo") {
    return { rank: 4, label: "Lead quente sem primeiro contato", kind: "hot" };
  }
  if (lead.stage === "sem_resposta" && (age == null || age >= 2)) {
    return { rank: 5, label: age == null ? "Sem resposta registrada" : `Sem resposta há ${age} dias`, kind: "wait" };
  }
  return null;
}

export default function CRMBoard({ initialLeads = [] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [view, setView] = useState("list");
  const [cityFolder, setCityFolder] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [activeLeadId, setActiveLeadId] = useState("");
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [quick, setQuick] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [sort, setSort] = useState("score");
  const [dragOver, setDragOver] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("error");
  const [boardScrollWidth, setBoardScrollWidth] = useState(0);
  const boardRef = useRef(null);
  const topScrollRef = useRef(null);
  const [form, setForm] = useState({ name: "", segment: "", city: "", location: "", phone: "" });

  useEffect(() => {
    setLeads(initialLeads);
    const availableIds = new Set(initialLeads.map(lead => lead.id));
    setSelectedIds(current => new Set([...current].filter(id => availableIds.has(id))));
    setActiveLeadId(current => current && availableIds.has(current) ? current : "");
  }, [initialLeads]);

  useEffect(() => {
    const savedCity = window.localStorage.getItem("leadflow_crm_city_folder");
    const savedView = window.localStorage.getItem("leadflow_crm_view");
    if (savedCity) setCityFolder(savedCity);
    if (["list", "today", "pipeline"].includes(savedView)) setView(savedView);
  }, []);

  const cityFolders = useMemo(() => {
    const grouped = new Map();
    for (const lead of leads) {
      const key = cityKey(lead);
      const label = cityLabel(lead);
      const current = grouped.get(key);
      if (current) {
        current.count += 1;
        if (lead.grade === "A") current.hot += 1;
        if (["proposta", "negociacao"].includes(lead.stage)) current.pipeline += 1;
      } else {
        grouped.set(key, {
          key,
          label,
          count: 1,
          hot: lead.grade === "A" ? 1 : 0,
          pipeline: ["proposta", "negociacao"].includes(lead.stage) ? 1 : 0,
        });
      }
    }
    return [...grouped.values()].sort((a, b) => {
      if (a.label === "Sem cidade") return 1;
      if (b.label === "Sem cidade") return -1;
      return a.label.localeCompare(b.label, "pt-BR");
    });
  }, [leads]);

  useEffect(() => {
    if (cityFolder === "all") return;
    if (!cityFolders.some(folder => folder.key === cityFolder)) setCityFolder("all");
  }, [cityFolder, cityFolders]);

  function selectCityFolder(value) {
    setCityFolder(value);
    window.localStorage.setItem("leadflow_crm_city_folder", value);
    setSelectedIds(new Set());
    setActiveLeadId("");
  }

  function changeView(next) {
    setView(next);
    window.localStorage.setItem("leadflow_crm_view", next);
  }

  const nicheOptions = useMemo(() => {
    const grouped = new Map();
    for (const lead of leads) {
      const label = String(lead.segment || "").trim();
      if (!label) continue;
      const value = normalizeFilterValue(label);
      const current = grouped.get(value);
      if (current) current.count++;
      else grouped.set(value, { value, label, count: 1 });
    }
    return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [leads]);

  const cityLeads = useMemo(
    () => leads.filter(lead => cityFolder === "all" || cityKey(lead) === cityFolder),
    [leads, cityFolder],
  );

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGE_IDS.map(id => [id, 0]));
    for (const lead of cityLeads) {
      if (counts[lead.stage] != null) counts[lead.stage]++;
    }
    return counts;
  }, [cityLeads]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const filtered = cityLeads.filter(lead => {
      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (query) {
        const haystack = [lead.name, lead.segment, lead.city, lead.location, lead.phone, lead.whatsapp, lead.email]
          .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
        if (!haystack.includes(query)) return false;
      }
      if (nicheFilter !== "all" && normalizeFilterValue(lead.segment) !== nicheFilter) return false;
      if (gradeFilter !== "all" && lead.grade !== gradeFilter) return false;
      if (quick === "no-site" && lead.site && !lead.weakSite) return false;
      if (quick === "score" && Number(lead.score || 0) < 50) return false;
      if (quick === "phone" && !lead.phone && !lead.whatsapp) return false;
      if (quick === "whatsapp" && !lead.whatsapp && !isPossibleMobile(lead.phone)) return false;
      if (!matchesContactFilter(lead, contactFilter)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "score") return Number(b.score || 0) - Number(a.score || 0);
      if (sort === "name") return String(a.name).localeCompare(String(b.name), "pt-BR");
      if (sort === "contact-oldest") {
        if (!a.lastContactAt && !b.lastContactAt) return Number(b.score || 0) - Number(a.score || 0);
        if (!a.lastContactAt) return -1;
        if (!b.lastContactAt) return 1;
        return new Date(a.lastContactAt) - new Date(b.lastContactAt);
      }
      if (sort === "contact-newest") {
        if (!a.lastContactAt && !b.lastContactAt) return 0;
        if (!a.lastContactAt) return 1;
        if (!b.lastContactAt) return -1;
        return new Date(b.lastContactAt) - new Date(a.lastContactAt);
      }
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
  }, [cityLeads, stageFilter, nicheFilter, gradeFilter, quick, contactFilter, search, sort]);

  const todayItems = useMemo(() => {
    return cityLeads
      .map(lead => ({ lead, reason: priorityReason(lead) }))
      .filter(item => item.reason)
      .sort((a, b) => a.reason.rank - b.reason.rank || Number(b.lead.score || 0) - Number(a.lead.score || 0));
  }, [cityLeads]);

  const todayStats = useMemo(() => ({
    followups: todayItems.filter(item => item.reason.rank === 0).length,
    replies: cityLeads.filter(lead => lead.stage === "com_resposta").length,
    hot: cityLeads.filter(lead => lead.grade === "A" && lead.stage === "novo").length,
    negotiations: cityLeads.filter(lead => ["proposta", "negociacao"].includes(lead.stage)).length,
  }), [todayItems, cityLeads]);

  const byStage = useMemo(() => {
    const grouped = Object.fromEntries(STAGE_IDS.map(id => [id, []]));
    for (const lead of visible) {
      if (grouped[lead.stage]) grouped[lead.stage].push(lead);
    }
    return grouped;
  }, [visible]);

  useEffect(() => {
    if (view !== "pipeline") return;
    const board = boardRef.current;
    if (!board) return;
    const updateWidth = () => setBoardScrollWidth(board.scrollWidth);
    updateWidth();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateWidth) : null;
    observer?.observe(board);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [visible.length, cityFolder, view]);

  function syncFromTop(event) {
    if (boardRef.current) boardRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  function syncFromBoard(event) {
    if (topScrollRef.current && topScrollRef.current.scrollLeft !== event.currentTarget.scrollLeft) {
      topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  }

  const activeLead = useMemo(
    () => leads.find(lead => lead.id === activeLeadId) || null,
    [leads, activeLeadId],
  );

  const selectedCount = selectedIds.size;
  const allVisibleSelected = visible.length > 0 && visible.every(lead => selectedIds.has(lead.id));
  const activeFilterCount = [
    Boolean(search.trim()),
    stageFilter !== "all",
    nicheFilter !== "all",
    gradeFilter !== "all",
    quick !== "all",
    contactFilter !== "all",
  ].filter(Boolean).length;

  function showNotice(message, kind = "error") {
    setNoticeKind(kind);
    setNotice(message);
  }

  function clearFilters() {
    setSearch("");
    setStageFilter("all");
    setNicheFilter("all");
    setGradeFilter("all");
    setQuick("all");
    setContactFilter("all");
  }

  function toggleLeadSelection(leadId) {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds(current => {
      const next = new Set(current);
      if (allVisibleSelected) for (const lead of visible) next.delete(lead.id);
      else for (const lead of visible) next.add(lead.id);
      return next;
    });
  }

  async function trackContact(lead, kind) {
    const previous = leads;
    const optimistic = {
      lastContactAt: new Date().toISOString(),
      lastContactKind: kind,
      contactCount: Number(lead.contactCount || 0) + 1,
    };
    setLeads(current => current.map(item => item.id === lead.id ? { ...item, ...optimistic } : item));
    try {
      const saved = await recordContactAction(lead.id, kind);
      setLeads(current => current.map(item => item.id === lead.id ? { ...item, ...saved } : item));
      router.refresh();
    } catch (error) {
      setLeads(previous);
      showNotice(`Não foi possível registrar o contato: ${error.message}`);
    }
  }

  async function moveLead(leadId, stage) {
    const previous = leads;
    setLeads(current => current.map(lead => lead.id === leadId ? { ...lead, stage } : lead));
    try {
      await moveStageAction(leadId, stage);
      router.refresh();
    } catch (error) {
      setLeads(previous);
      showNotice(`Erro ao mover lead: ${error.message}`);
    }
  }

  async function createLead(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      const created = await createLeadAction({
        ...form,
        source: "Manual",
        stage: "novo",
        score: 10,
        grade: "D",
        weakSite: true,
      });
      setLeads(current => [created, ...current]);
      setForm({ name: "", segment: "", city: "", location: "", phone: "" });
      setCreating(false);
      setActiveLeadId(created.id);
      router.refresh();
    } catch (error) {
      showNotice(`Erro ao criar lead: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeLead(lead) {
    const confirmed = window.confirm(`Excluir o lead "${lead.name}" do CRM? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    setDeleting(true);
    setNotice("");
    try {
      await deleteLeadAction(lead.id);
      setLeads(current => current.filter(item => item.id !== lead.id));
      setSelectedIds(current => {
        const next = new Set(current);
        next.delete(lead.id);
        return next;
      });
      setActiveLeadId(current => current === lead.id ? "" : current);
      showNotice(`Lead "${lead.name}" excluído com sucesso.`, "success");
      router.refresh();
    } catch (error) {
      showNotice(`Erro ao excluir lead: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  }

  async function removeSelectedLeads() {
    const ids = [...selectedIds].filter(id => leads.some(lead => lead.id === id));
    if (!ids.length) return;
    const label = ids.length === 1 ? "1 lead selecionado" : `${ids.length} leads selecionados`;
    if (!window.confirm(`Excluir ${label} do CRM? Esta ação não pode ser desfeita.`)) return;

    setDeleting(true);
    setNotice("");
    try {
      const result = await deleteLeadsAction(ids);
      const removedIds = new Set(ids);
      setLeads(current => current.filter(lead => !removedIds.has(lead.id)));
      setSelectedIds(new Set());
      setActiveLeadId(current => removedIds.has(current) ? "" : current);
      const removed = Number(result?.count ?? ids.length);
      showNotice(`${removed} lead${removed === 1 ? "" : "s"} excluído${removed === 1 ? "" : "s"} com sucesso.`, "success");
      router.refresh();
    } catch (error) {
      showNotice(`Erro ao excluir leads: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const source = visible.length ? visible : cityLeads;
    const header = ["Nome", "Categoria", "Cidade", "Estado", "Telefone", "WhatsApp", "Site", "Score", "Nota", "Etapa", "Último contato", "Quantidade de contatos"];
    const rows = source.map(lead => [lead.name, lead.segment, lead.city, lead.location, lead.phone, lead.whatsapp, lead.site, lead.score, lead.grade, lead.stage, lead.lastContactAt || "", lead.contactCount || 0]);
    const content = [header, ...rows].map(row => row.map(csvValue).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leadflow-crm-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function renderList() {
    return <section className={s.listPanel}>
      <div className={s.listHead}>
        <div className={s.listHeadLead}>Lead</div>
        <div>Etapa</div>
        <div>Presença</div>
        <div>Último contato</div>
        <div>Próxima ação</div>
      </div>

      {visible.length === 0 ? <div className={s.emptyState}><strong>Nenhum lead encontrado</strong><p>Ajuste os filtros ou selecione outra cidade.</p></div>
        : visible.map(lead => {
          const selected = selectedIds.has(lead.id);
          const stage = stageMeta(lead.stage);
          return <article
            key={lead.id}
            className={`${s.leadRow} ${activeLeadId === lead.id ? s.leadRowActive : ""} ${selected ? s.leadRowSelected : ""}`}
            onClick={() => setActiveLeadId(lead.id)}
          >
            <div className={s.leadIdentity}>
              <input type="checkbox" checked={selected} aria-label={`Selecionar ${lead.name}`} onClick={event => event.stopPropagation()} onChange={() => toggleLeadSelection(lead.id)} />
              <span className={`${s.scoreBadge} ${s["grade" + lead.grade]}`}>{lead.score}</span>
              <div><strong>{lead.name}</strong><small>{lead.segment || "Sem categoria"} · {cityLabel(lead)}</small></div>
            </div>
            <div><span className={s.stageBadge}><i style={{ background: STAGE_COLOR[lead.stage] || "#94a3b8" }} />{stage.label}</span></div>
            <div className={s.presence}>
              <span className={lead.whatsapp || isPossibleMobile(lead.phone) ? s.presenceYes : ""}>WA</span>
              <span className={lead.instagram ? s.presenceYes : ""}>IG</span>
              <span className={lead.site && !lead.weakSite ? s.presenceYes : ""}>Site</span>
              <span className={["done", "sent"].includes(lead.landingStatus) ? s.presenceYes : ""}>Prévia</span>
            </div>
            <div className={s.rowMuted}>{lastContactLabel(lead)}{lead.contactCount ? <small>{lead.contactCount} contato{lead.contactCount === 1 ? "" : "s"}</small> : null}</div>
            <div className={s.nextActionCell}>{lead.nextAction || lead.followUpAt || priorityReason(lead)?.label || "Definir próximo passo"}</div>
          </article>;
        })}
    </section>;
  }

  function renderToday() {
    return <section className={s.todayPanel}>
      <div className={s.todayStats}>
        <article><span>Follow-ups</span><strong>{todayStats.followups}</strong><small>vencidos ou para hoje</small></article>
        <article><span>Respostas</span><strong>{todayStats.replies}</strong><small>leads para avançar</small></article>
        <article><span>Quentes</span><strong>{todayStats.hot}</strong><small>novos com prioridade</small></article>
        <article><span>Pipeline</span><strong>{todayStats.negotiations}</strong><small>propostas / negociação</small></article>
      </div>
      <div className={s.todayQueue}>
        <div className={s.queueHeading}><div><h2>Prioridades de hoje</h2><p>O que merece sua atenção primeiro nesta cidade.</p></div><span>{todayItems.length}</span></div>
        {todayItems.length === 0 ? <div className={s.emptyState}><strong>Nada urgente por aqui</strong><p>Esta cidade não possui ações prioritárias detectadas agora.</p></div>
          : todayItems.map(({ lead, reason }) => <button key={lead.id} className={s.priorityItem} onClick={() => setActiveLeadId(lead.id)}>
            <span className={`${s.priorityMark} ${s["priority_" + reason.kind]}`} />
            <span className={`${s.scoreBadge} ${s["grade" + lead.grade]}`}>{lead.score}</span>
            <span className={s.priorityText}><strong>{lead.name}</strong><small>{reason.label} · {lead.segment || "Sem categoria"}</small></span>
            <span className={s.priorityStage}>{stageMeta(lead.stage).label}</span>
            <span className={s.priorityArrow}>›</span>
          </button>)}
      </div>
    </section>;
  }

  function renderPipeline() {
    return <section className={s.pipelinePanel}>
      <div className={s.topScrollbar} ref={topScrollRef} onScroll={syncFromTop} aria-label="Rolagem horizontal do pipeline">
        <div style={{ width: Math.max(boardScrollWidth, 1) }} />
      </div>
      <div className={s.board} ref={boardRef} onScroll={syncFromBoard}>
        {STAGES.map(stage => <div
          key={stage.id}
          className={`${s.column} ${dragOver === stage.id ? s.dragOver : ""}`}
          onDragOver={event => { event.preventDefault(); setDragOver(stage.id); }}
          onDragLeave={() => setDragOver(current => current === stage.id ? "" : current)}
          onDrop={event => {
            event.preventDefault();
            setDragOver("");
            const id = event.dataTransfer.getData("text/plain");
            if (id) moveLead(id, stage.id);
          }}
        >
          <div className={s.columnHeader}>
            <span className={s.stageDot} style={{ background: STAGE_COLOR[stage.id] }} />
            <strong>{stage.label}</strong>
            <span>{byStage[stage.id]?.length || 0}</span>
          </div>
          <small className={s.columnSub}>{stage.sub}</small>
          <div className={s.columnBody}>
            {(byStage[stage.id] || []).length === 0 ? <div className={s.pipelineEmpty}>Sem leads</div>
              : byStage[stage.id].map(lead => <article
                key={lead.id}
                className={`${s.pipelineCard} ${activeLeadId === lead.id ? s.pipelineCardActive : ""}`}
                draggable={!deleting}
                onDragStart={event => event.dataTransfer.setData("text/plain", lead.id)}
                onClick={() => setActiveLeadId(lead.id)}
              >
                <div><span className={`${s.scoreBadge} ${s["grade" + lead.grade]}`}>{lead.score}</span><span className={s.tempLabel}>{GRADE_LABEL[lead.grade] || lead.grade}</span></div>
                <h3>{lead.name}</h3>
                <p>{lead.segment || "Sem categoria"} · {cityLabel(lead)}</p>
                <small>{lastContactLabel(lead)}</small>
              </article>)}
          </div>
        </div>)}
      </div>
    </section>;
  }

  function renderQuickPanel() {
    if (!activeLead) return <aside className={s.quickPanel}>
      <div className={s.quickEmpty}><span>◎</span><strong>Selecione um lead</strong><p>Clique em qualquer item para ver os dados e ações rápidas sem sair do CRM.</p></div>
    </aside>;

    const wa = whatsappUrl(activeLead);
    const stage = stageMeta(activeLead.stage);
    const priority = priorityReason(activeLead);

    return <aside className={s.quickPanel}>
      <div className={s.quickTop}>
        <button className={s.closeQuick} onClick={() => setActiveLeadId("")}>×</button>
        <div className={s.quickScoreLine}>
          <span className={`${s.scoreBig} ${s["grade" + activeLead.grade]}`}>{activeLead.score}</span>
          <span className={`${s.tempBig} ${s["grade" + activeLead.grade]}`}>{GRADE_LABEL[activeLead.grade] || activeLead.grade}</span>
        </div>
        <h2>{activeLead.name}</h2>
        <p>{activeLead.segment || "Sem categoria"} · {cityLabel(activeLead)}</p>
      </div>

      {priority && <div className={s.quickPriority}><span>Próxima prioridade</span><strong>{priority.label}</strong></div>}

      <div className={s.quickSection}>
        <span className={s.quickLabel}>Etapa</span>
        <select value={activeLead.stage} onChange={event => moveLead(activeLead.id, event.target.value)}>
          {STAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <small>{stage.sub}</small>
      </div>

      <div className={s.quickFacts}>
        {activeLead.googleRating && <div><span>Google</span><strong>★ {activeLead.googleRating}</strong><small>{activeLead.googleReviews || 0} avaliações</small></div>}
        <div><span>Último contato</span><strong>{lastContactLabel(activeLead)}</strong><small>{activeLead.contactCount || 0} contato{Number(activeLead.contactCount || 0) === 1 ? "" : "s"}</small></div>
        <div><span>Prévia</span><strong>{activeLead.landingStatus === "sent" ? "Enviada" : activeLead.landingStatus === "done" ? "Pronta" : activeLead.landingStatus === "todo" ? "A fazer" : "Não iniciada"}</strong><small>{activeLead.previewUrl ? "Link publicado" : "Sem link público"}</small></div>
        <div><span>Proposta</span><strong>{activeLead.proposalValue ? `R$ ${Number(activeLead.proposalValue).toLocaleString("pt-BR")}` : "Não definida"}</strong><small>{stage.label}</small></div>
      </div>

      <div className={s.quickContacts}>
        {wa ? <a className={s.whatsappAction} href={wa} target="_blank" rel="noopener noreferrer" onClick={() => trackContact(activeLead, "whatsapp")}>WhatsApp</a> : <span>Sem WhatsApp</span>}
        {activeLead.phone ? <a href={`tel:${activeLead.phone}`} onClick={() => trackContact(activeLead, "call")}>Ligar</a> : <span>Sem telefone</span>}
      </div>

      <div className={s.quickLinks}>
        {activeLead.previewUrl && <a href={activeLead.previewUrl} target="_blank" rel="noopener noreferrer">Abrir prévia ↗</a>}
        {activeLead.instagram && <a href={activeLead.instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
        {activeLead.site && <a href={activeLead.site} target="_blank" rel="noopener noreferrer">Site atual ↗</a>}
        {activeLead.mapsLink && <a href={activeLead.mapsLink} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>}
      </div>

      {(activeLead.problem || activeLead.nextAction || activeLead.notes) && <div className={s.quickContext}>
        {activeLead.problem && <div><span>Problema identificado</span><p>{activeLead.problem}</p></div>}
        {activeLead.nextAction && <div><span>Próxima ação</span><p>{activeLead.nextAction}</p></div>}
        {activeLead.notes && <div><span>Anotações</span><p>{activeLead.notes}</p></div>}
      </div>}

      <div className={s.quickFooter}>
        <button className={s.openLead} onClick={() => router.push(`/crm/${activeLead.id}`)}>Abrir lead completo →</button>
        <button className={s.deleteLead} disabled={deleting} onClick={() => removeLead(activeLead)}>Excluir</button>
      </div>
    </aside>;
  }

  return <main className={s.page}>
    <header className={s.header}>
      <div><span className={s.eyebrow}>Command Center</span><h1>CRM</h1><p>Encontre a próxima ação sem precisar caçar cards pelo quadro.</p></div>
      <div className={s.headerActions}>
        <button className={s.primary} onClick={() => setCreating(true)}>+ Criar lead</button>
        <button onClick={exportCsv}>Exportar</button>
      </div>
    </header>

    <div className={s.viewTabs}>
      <button className={view === "list" ? s.viewActive : ""} onClick={() => changeView("list")}>Leads</button>
      <button className={view === "today" ? s.viewActive : ""} onClick={() => changeView("today")}>Hoje <span>{todayItems.length}</span></button>
      <button className={view === "pipeline" ? s.viewActive : ""} onClick={() => changeView("pipeline")}>Pipeline</button>
    </div>

    <section className={s.filterShell}>
      <div className={s.searchWrap}><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa, nicho, telefone..." /></div>
      <select value={nicheFilter} onChange={event => setNicheFilter(event.target.value)}><option value="all">Todos os nichos</option>{nicheOptions.map(option => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}</select>
      <select value={gradeFilter} onChange={event => setGradeFilter(event.target.value)}><option value="all">Todas as notas</option><option value="A">Quentes</option><option value="B">Mornos</option><option value="C">Em análise</option><option value="D">Frios</option></select>
      <select value={quick} onChange={event => setQuick(event.target.value)}><option value="all">Todas as oportunidades</option><option value="no-site">Sem site próprio</option><option value="score">Score 50+</option><option value="phone">Com telefone</option><option value="whatsapp">WhatsApp testável</option></select>
      <select value={contactFilter} onChange={event => setContactFilter(event.target.value)}><option value="all">Qualquer contato</option><option value="never">Nunca contatados</option><option value="today">Contato hoje</option><option value="1-3">Há 1–3 dias</option><option value="4-7">Há 4–7 dias</option><option value="8-15">Há 8–15 dias</option><option value="16+">Há mais de 15 dias</option></select>
      <select value={sort} onChange={event => setSort(event.target.value)}><option value="score">Maior score</option><option value="recent">Mais recentes</option><option value="contact-oldest">Contato mais antigo</option><option value="contact-newest">Contato mais recente</option><option value="name">Nome</option></select>
      {activeFilterCount > 0 && <button className={s.clearFilters} onClick={clearFilters}>Limpar {activeFilterCount}</button>}
    </section>

    <div className={s.stageStrip}>
      <button className={stageFilter === "all" ? s.stageActive : ""} onClick={() => setStageFilter("all")}><span>Todos</span><b>{cityLeads.length}</b></button>
      {STAGES.map(stage => <button key={stage.id} className={stageFilter === stage.id ? s.stageActive : ""} onClick={() => setStageFilter(stageFilter === stage.id ? "all" : stage.id)}><i style={{ background: STAGE_COLOR[stage.id] }} /><span>{stage.label}</span><b>{stageCounts[stage.id] || 0}</b></button>)}
    </div>

    {notice && <div className={`${s.notice} ${noticeKind === "success" ? s.noticeSuccess : ""}`}>{notice}</div>}

    <div className={s.commandLayout}>
      <aside className={s.citySidebar}>
        <div className={s.cityHeading}><span>Cidades</span><small>{cityFolders.length}</small></div>
        <button className={cityFolder === "all" ? s.cityActive : ""} onClick={() => selectCityFolder("all")}><span className={s.cityIcon}>▰</span><span><strong>Todas</strong><small>{leads.length} leads</small></span></button>
        <div className={s.cityList}>{cityFolders.map(folder => <button key={folder.key} className={cityFolder === folder.key ? s.cityActive : ""} onClick={() => selectCityFolder(folder.key)}><span className={s.cityIcon}>▰</span><span className={s.cityText}><strong>{folder.label}</strong><small>{folder.count} leads · {folder.hot} quentes{folder.pipeline ? ` · ${folder.pipeline} pipeline` : ""}</small></span><b>{folder.count}</b></button>)}</div>
      </aside>

      <section className={s.center}>
        <div className={s.centerToolbar}>
          <div><strong>{cityFolder === "all" ? "Todos os leads" : cityFolders.find(folder => folder.key === cityFolder)?.label || "Cidade"}</strong><span>{view === "today" ? `${todayItems.length} prioridades` : `${visible.length} de ${cityLeads.length} leads`}</span></div>
          {view !== "today" && <div className={s.bulkActions}>
            <button onClick={toggleVisibleSelection} disabled={!visible.length || deleting}>{allVisibleSelected ? "Desmarcar" : "Selecionar exibidos"}</button>
            {selectedCount > 0 && <button className={s.bulkDelete} onClick={removeSelectedLeads} disabled={deleting}>Excluir {selectedCount}</button>}
          </div>}
        </div>
        {view === "today" ? renderToday() : view === "pipeline" ? renderPipeline() : renderList()}
      </section>

      {renderQuickPanel()}
    </div>

    {creating && <div className={s.modalBackdrop} onMouseDown={() => !saving && setCreating(false)}>
      <form className={s.modal} onSubmit={createLead} onMouseDown={event => event.stopPropagation()}>
        <div className={s.modalHead}><div><h2>Criar lead</h2><p>Cadastre manualmente uma oportunidade no CRM.</p></div><button type="button" onClick={() => setCreating(false)}>×</button></div>
        <label><span>Nome da empresa</span><input autoFocus required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
        <div className={s.formGrid}>
          <label><span>Categoria</span><input value={form.segment} onChange={event => setForm(current => ({ ...current, segment: event.target.value }))} /></label>
          <label><span>Telefone</span><input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} /></label>
          <label><span>Cidade</span><input value={form.city} onChange={event => setForm(current => ({ ...current, city: event.target.value }))} /></label>
          <label><span>Estado</span><input maxLength={40} value={form.location} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} /></label>
        </div>
        <div className={s.modalActions}><button type="button" onClick={() => setCreating(false)}>Cancelar</button><button className={s.primary} disabled={saving}>{saving ? "Salvando..." : "Criar lead"}</button></div>
      </form>
    </div>}
  </main>;
}
