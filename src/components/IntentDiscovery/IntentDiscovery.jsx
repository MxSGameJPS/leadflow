"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearDismissedIntentAction,
  dismissIntentSignalAction,
  refreshIntentHealthAction,
  listIntentSignalsAction,
  restoreIntentSignalAction,
  searchIntentAction,
  sendIntentToCrmAction,
} from "../../app/actions/intent.js";
import s from "./IntentDiscovery.module.css";

const SERVICE_LABELS = {
  website: "Site / landing page",
  system: "Sistema sob medida",
  app: "Aplicativo",
  ecommerce: "E-commerce",
  automation: "Automação",
  unknown: "Não classificado",
};

const SOURCE_LABELS = {
  web: "Web",
  freelance: "Freelance",
  "99freelas": "99Freelas",
  workana: "Workana",
  freelancer: "Freelancer",
  reddit: "Reddit",
  twitter: "X / Twitter",
  facebook: "Facebook",
};

function age(value) {
  if (!value) return "data não informada";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "data não informada";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h atrás`;
  return `${Math.round(hours / 24)} dias atrás`;
}

function healthTone(item) {
  if (item?.installed === true || item?.status === "ok") return s.ok;
  if (item?.status === "warn") return s.warn;
  return s.off;
}

function HealthCard({ title, item, detail }) {
  const active = item?.activeBackend || item?.version || "";
  return <div className={`${s.healthCard} ${healthTone(item)}`}>
    <div><strong>{title}</strong><span>{active || detail || "Não configurado"}</span></div>
    <i>{item?.installed === true || item?.status === "ok" ? "OK" : item?.status === "warn" ? "ATENÇÃO" : "OFF"}</i>
  </div>;
}

export default function IntentDiscovery({ initialSignals = [], initialStats = {}, initialHealth = {}, serviceOptions = [], sourceOptions = [] }) {
  const router = useRouter();
  const [signals, setSignals] = useState(initialSignals);
  const [health, setHealth] = useState(initialHealth);
  const [service, setService] = useState("all");
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState(() => new Set(["web", "freelance"]));
  const [minimumScore, setMinimumScore] = useState(45);
  const [status, setStatus] = useState("new");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState([]);

  const computedStats = useMemo(() => ({
    ...initialStats,
    total: signals.length,
    new: signals.filter(item => item.status === "new").length,
    hot: signals.filter(item => item.status === "new" && item.intentScore >= 85).length,
    saved: signals.filter(item => item.status === "saved").length,
  }), [signals, initialStats]);

  const visible = useMemo(() => signals.filter(item => {
    if (status !== "all" && item.status !== status) return false;
    if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
    if (serviceFilter !== "all" && item.matchedService !== serviceFilter) return false;
    return true;
  }).sort((a, b) => Number(b.intentScore || 0) - Number(a.intentScore || 0)), [signals, status, sourceFilter, serviceFilter]);

  function toggleSource(value) {
    setSources(current => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  async function runSearch(event) {
    event.preventDefault();
    if (!sources.size) { setNotice("Selecione ao menos uma fonte."); return; }
    setSearching(true);
    setNotice("");
    setWarnings([]);
    try {
      const result = await searchIntentAction({ service, query, sources: [...sources], minimumScore });
      setWarnings(result.warnings || []);
      setNotice(`Busca concluída: ${result.found} sinais coletados, ${result.qualified} oportunidades qualificadas, ${result.saved.added} novas e ${result.saved.updated} atualizadas.` + (result.enriched ? ` ${result.enriched} páginas foram enriquecidas pelo Scrapling.` : ""));
      setSignals(await listIntentSignalsAction({ limit: 250 }));
      router.refresh();
    } catch (error) {
      setNotice(error.message || "Não foi possível executar a busca de intenção.");
    } finally {
      setSearching(false);
    }
  }

  async function refreshHealth() {
    setChecking(true);
    try { setHealth(await refreshIntentHealthAction()); }
    catch (error) { setNotice(error.message || "Falha ao verificar conectores."); }
    finally { setChecking(false); }
  }

  async function withSignal(id, action, success) {
    setBusyIds(current => new Set(current).add(id));
    try {
      const result = await action(id);
      const updated = result?.signal || result || {};
      setSignals(current => current.map(item => item.id === id ? { ...item, ...updated, status: updated.status || success } : item));
      router.refresh();
    } catch (error) {
      setNotice(error.message || "Não foi possível atualizar a oportunidade.");
    } finally {
      setBusyIds(current => { const next = new Set(current); next.delete(id); return next; });
    }
  }

  async function clearDismissed() {
    try {
      await clearDismissedIntentAction();
      setSignals(current => current.filter(item => item.status !== "dismissed"));
      router.refresh();
    } catch (error) { setNotice(error.message || "Não foi possível limpar descartados."); }
  }

  return <main className={s.page}>
    <header className={s.header}>
      <div><span className={s.eyebrow}>LeadFlow Intent Engine</span><h1>Intenção de compra</h1><p>Encontre sinais públicos de pessoas e empresas que já estão procurando site, sistema, aplicativo, e-commerce ou automação.</p></div>
      <button type="button" onClick={refreshHealth} disabled={checking}>{checking ? "Verificando…" : "Verificar conectores"}</button>
    </header>

    <section className={s.healthGrid}>
      <HealthCard title="Agent-Reach" item={{ installed: health.agentReach?.installed }} detail={health.agentReach?.error || "Roteador de fontes"} />
      <HealthCard title="Web / Exa" item={health.agentReach?.web} detail="Pesquisa semântica" />
      <HealthCard title="Reddit" item={health.agentReach?.reddit} />
      <HealthCard title="X / Twitter" item={health.agentReach?.twitter} />
      <HealthCard title="Facebook" item={health.agentReach?.facebook} />
      <HealthCard title="Scrapling" item={{ installed: health.scrapling?.installed, version: health.scrapling?.version }} detail={health.scrapling?.error || "Enriquecimento web"} />
    </section>

    <section className={s.searchPanel}>
      <div className={s.searchIntro}><div><strong>Descobrir oportunidades agora</strong><span>O OmniRoute classifica os resultados; o score final é calculado pelo LeadFlow.</span></div></div>
      <form onSubmit={runSearch} className={s.form}>
        <label><span>Serviço</span><select value={service} onChange={event => setService(event.target.value)}>{serviceOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className={s.queryField}><span>Consulta opcional</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: preciso de sistema para restaurante" /></label>
        <label><span>Score mínimo</span><select value={minimumScore} onChange={event => setMinimumScore(Number(event.target.value))}><option value={45}>45 · explorar</option><option value={60}>60 · bom</option><option value={70}>70 · alta intenção</option><option value={85}>85 · quente</option></select></label>
        <div className={s.sourcePicker}><span>Fontes</span><div>{sourceOptions.map(item => <button type="button" key={item.value} className={sources.has(item.value) ? s.sourceActive : ""} onClick={() => toggleSource(item.value)}>{sources.has(item.value) ? "✓ " : ""}{item.label}</button>)}</div></div>
        <button className={s.searchButton} type="submit" disabled={searching}>{searching ? "Pesquisando intenção…" : "Buscar intenção"}</button>
      </form>
      {notice && <div className={s.notice}>{notice}</div>}
      {warnings.length > 0 && <div className={s.warnings}><strong>Avisos da coleta</strong>{warnings.slice(0, 8).map((item, index) => <p key={index}>{item}</p>)}</div>}
    </section>

    <section className={s.stats}>
      <div><span>Oportunidades salvas</span><strong>{computedStats.total}</strong></div>
      <div><span>Novas</span><strong>{computedStats.new}</strong></div>
      <div><span>Quentes · 85+</span><strong>{computedStats.hot}</strong></div>
      <div><span>Enviadas ao CRM</span><strong>{computedStats.saved}</strong></div>
    </section>

    <section className={s.resultsPanel}>
      <div className={s.resultsHeader}>
        <div><strong>Fila de intenção</strong><span>{visible.length} oportunidades exibidas</span></div>
        <div className={s.filters}>
          <select value={status} onChange={event => setStatus(event.target.value)}><option value="new">Novas</option><option value="saved">No CRM</option><option value="dismissed">Descartadas</option><option value="all">Todas</option></select>
          <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}><option value="all">Todas as fontes</option>{[...new Set(signals.map(item => item.source))].filter(Boolean).map(item => <option key={item} value={item}>{SOURCE_LABELS[item] || item}</option>)}</select>
          <select value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}><option value="all">Todos os serviços</option>{Object.entries(SERVICE_LABELS).filter(([key]) => key !== "unknown").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          {status === "dismissed" && <button type="button" onClick={clearDismissed}>Limpar descartadas</button>}
        </div>
      </div>

      <div className={s.cards}>
        {visible.map(item => {
          const busy = busyIds.has(item.id);
          return <article key={item.id} className={`${s.card} ${s[item.band] || ""}`}>
            <div className={s.cardTop}>
              <div className={s.score}><strong>{item.intentScore}</strong><span>INTENT</span></div>
              <div className={s.identity}>
                <div className={s.badges}><span>{SOURCE_LABELS[item.source] || item.source}</span><b>{SERVICE_LABELS[item.matchedService] || item.matchedService}</b>{item.explicitIntent && <em>pedido explícito</em>}</div>
                <h2>{item.title || item.author || "Oportunidade encontrada"}</h2>
                <small>{item.author ? `${item.author} · ` : ""}{age(item.publishedAt)}</small>
              </div>
            </div>
            <p className={s.content}>{item.content}</p>
            <div className={s.reason}><strong>Por que entrou na fila</strong><span>{item.reason || "Sinal compatível com intenção comercial."}</span></div>
            <div className={s.meta}><span>Estágio: <b>{item.buyerStage}</b></span><span>Urgência: <b>{item.urgencyScore}/100</b></span><span>Fit: <b>{item.fitScore}/100</b></span><span>Confiança: <b>{Math.round(Number(item.confidence || 0) * 100)}%</b></span></div>
            <div className={s.actions}>
              {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir fonte</a>}
              {item.status === "new" && <button type="button" className={s.primary} disabled={busy} onClick={() => withSignal(item.id, sendIntentToCrmAction, "saved")}>{busy ? "Enviando…" : "Enviar para CRM"}</button>}
              {item.status === "new" && <button type="button" disabled={busy} onClick={() => withSignal(item.id, dismissIntentSignalAction, "dismissed")}>Descartar</button>}
              {item.status === "dismissed" && <button type="button" disabled={busy} onClick={() => withSignal(item.id, restoreIntentSignalAction, "new")}>Restaurar</button>}
              {item.status === "saved" && item.leadId && <a href={`/crm/${item.leadId}`}>Abrir no CRM</a>}
            </div>
          </article>;
        })}
        {!visible.length && <div className={s.empty}>Nenhuma oportunidade nesta visão. Configure os conectores acima e execute uma busca de intenção.</div>}
      </div>
    </section>
  </main>;
}
