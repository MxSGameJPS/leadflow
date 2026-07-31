"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateConsultingAuditAction,
  moveConsultingStageAction,
  promoteConsultingLeadAction,
  saveConsultingWorkspaceAction,
} from "../../app/actions/consulting.js";
import { CONSULTING_STAGES } from "../../services/consulting/stages.js";
import s from "./ConsultingWorkspace.module.css";

function parseAudit(value) {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function money(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100);
}

function dateTime(value) {
  if (!value) return "Ainda não realizado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ainda não realizado";
  return date.toLocaleString("pt-BR");
}

function whatsappLink(lead, message) {
  let digits = String(lead.whatsapp || lead.phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export default function ConsultingWorkspace({ initialLead, initialWorkspace, initialProfile = {} }) {
  const router = useRouter();
  const initial = initialWorkspace.consulting || {};
  const [consulting, setConsulting] = useState(initial);
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl || initialLead.site || "");
  const [instagramUrl, setInstagramUrl] = useState(initial.instagramUrl || initialLead.instagram || "");
  const [instagramNotes, setInstagramNotes] = useState(initial.instagramNotes || "");
  const [report, setReport] = useState(initial.report || "");
  const [whatsappMessage, setWhatsappMessage] = useState(initial.whatsappMessage || "");
  const [priceCents, setPriceCents] = useState(Number(initial.priceCents || 5000));
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("success");

  const audit = useMemo(() => parseAudit(consulting.auditSnapshot), [consulting.auditSnapshot]);
  const wa = useMemo(() => whatsappLink(initialLead, whatsappMessage), [initialLead, whatsappMessage]);

  function showNotice(message, kind = "success") {
    setNoticeKind(kind);
    setNotice(message);
  }

  async function savePatch(patch, success = "Alterações salvas.") {
    const before = consulting;
    setConsulting(current => ({ ...current, ...patch }));
    try {
      const saved = await saveConsultingWorkspaceAction(initialLead.id, patch);
      setConsulting(saved);
      showNotice(success);
      router.refresh();
      return saved;
    } catch (error) {
      setConsulting(before);
      showNotice(`Erro: ${error.message}`, "error");
      return null;
    }
  }

  async function saveSources() {
    setBusy("sources");
    setNotice("");
    await savePatch({ websiteUrl, instagramUrl, instagramNotes, priceCents }, "Dados da análise salvos.");
    setBusy("");
  }

  async function generateAudit() {
    if (!websiteUrl.trim() && !instagramUrl.trim() && !instagramNotes.trim()) {
      showNotice("Informe o site, o Instagram ou observações antes de analisar.", "error");
      return;
    }

    setBusy("audit");
    setNotice("");
    try {
      await moveConsultingStageAction(initialLead.id, "analise");
      const result = await generateConsultingAuditAction({
        leadId: initialLead.id,
        websiteUrl,
        instagramUrl,
        instagramNotes,
        priceCents,
      });
      const patch = {
        stage: "relatorio_pronto",
        status: "ready",
        websiteUrl,
        instagramUrl,
        instagramNotes,
        auditSnapshot: JSON.stringify(result.websiteAudit || null),
        overallScore: Number(result.overallScore || 0),
        executiveSummary: result.executiveSummary || "",
        report: result.report || "",
        whatsappMessage: result.whatsappMessage || "",
        priceCents,
        lastAnalyzedAt: new Date().toISOString(),
        providerId: result.providerId || "",
        providerName: result.providerName || "",
        model: result.model || "",
        warning: result.warning || "",
      };
      const saved = await saveConsultingWorkspaceAction(initialLead.id, patch);
      setConsulting(saved);
      setReport(saved.report || "");
      setWhatsappMessage(saved.whatsappMessage || "");
      showNotice(result.aiUsed ? "Análise e relatório gerados com IA." : "Diagnóstico técnico gerado. Revise o aviso sobre a IA.");
      router.refresh();
    } catch (error) {
      showNotice(`Erro ao gerar análise: ${error.message}`, "error");
    } finally {
      setBusy("");
    }
  }

  async function saveContent() {
    setBusy("content");
    await savePatch({ report, whatsappMessage, status: "reviewed", priceCents }, "Relatório e mensagem revisados.");
    setBusy("");
  }

  async function changeStage(stage) {
    setBusy("stage");
    setNotice("");
    try {
      const saved = await moveConsultingStageAction(initialLead.id, stage);
      setConsulting(saved);
      showNotice("Etapa atualizada.");
      router.refresh();
    } catch (error) {
      showNotice(`Erro: ${error.message}`, "error");
    } finally {
      setBusy("");
    }
  }

  async function markPaid() {
    setBusy("payment");
    const saved = await savePatch({
      paymentStatus: "paid",
      status: "sold",
      stage: "vendido",
      soldAt: consulting.soldAt || new Date().toISOString(),
      priceCents,
    }, "Pagamento confirmado e consultoria marcada como vendida.");
    if (saved) setConsulting(saved);
    setBusy("");
  }

  async function markDelivered() {
    setBusy("delivery");
    const saved = await savePatch({
      status: "delivered",
      stage: "entregue",
      deliveredAt: new Date().toISOString(),
    }, "Consultoria marcada como entregue.");
    if (saved) setConsulting(saved);
    setBusy("");
  }

  async function promoteToProject() {
    const confirmed = window.confirm("Mover este cliente para o CRM principal como lead nota B? Ele deixará o funil de consultorias.");
    if (!confirmed) return;
    setBusy("promote");
    setNotice("");
    try {
      await promoteConsultingLeadAction(initialLead.id);
      router.push(`/crm/${initialLead.id}`);
      router.refresh();
    } catch (error) {
      showNotice(`Erro ao converter oportunidade: ${error.message}`, "error");
      setBusy("");
    }
  }

  async function copy(value, message) {
    try {
      await navigator.clipboard.writeText(value || "");
      showNotice(message);
    } catch {
      showNotice("Não foi possível copiar automaticamente.", "error");
    }
  }

  return <main className={s.page}>
    <header className={`${s.header} ${s.noPrint}`}>
      <div>
        <a href="/consultoria">← Voltar para consultorias</a>
        <span>Consultoria Express</span>
        <h1>{initialLead.name}</h1>
        <p>{initialLead.segment || "Sem categoria"} · {[initialLead.city, initialLead.location].filter(Boolean).join(", ") || "Local não informado"}</p>
      </div>
      <div className={s.headerScore}>
        <strong>{consulting.overallScore || "—"}</strong>
        <span>score digital</span>
      </div>
    </header>

    {notice && <div className={`${s.notice} ${noticeKind === "error" ? s.noticeError : ""} ${s.noPrint}`}>{notice}</div>}
    {consulting.warning && <div className={`${s.warning} ${s.noPrint}`}>{consulting.warning}</div>}

    <section className={`${s.stageBar} ${s.noPrint}`}>
      {CONSULTING_STAGES.map(stage => <button
        key={stage.id}
        type="button"
        className={consulting.stage === stage.id ? s.stageActive : ""}
        disabled={busy === "stage"}
        onClick={() => changeStage(stage.id)}
      >{stage.label}</button>)}
    </section>

    <section className={`${s.grid} ${s.noPrint}`}>
      <div className={s.card}>
        <div className={s.cardHead}>
          <div><span>Etapa 1</span><h2>Fontes da análise</h2></div>
          <button type="button" disabled={busy === "sources"} onClick={saveSources}>{busy === "sources" ? "Salvando..." : "Salvar dados"}</button>
        </div>
        <label><span>Site existente</span><input value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} placeholder="https://empresa.com.br" /></label>
        <label><span>Instagram</span><input value={instagramUrl} onChange={event => setInstagramUrl(event.target.value)} placeholder="https://instagram.com/empresa" /></label>
        <label><span>Observações ou dados do Instagram</span><textarea value={instagramNotes} onChange={event => setInstagramNotes(event.target.value)} placeholder="Cole a bio, descreva destaques, publicações, frequência, identidade visual ou informações observadas manualmente." /></label>
        <label><span>Preço da Consultoria Express</span><input type="number" min="0" step="1" value={(priceCents / 100).toFixed(2)} onChange={event => setPriceCents(Math.max(0, Math.round(Number(event.target.value || 0) * 100)))} /></label>
        <button className={s.primary} type="button" disabled={busy === "audit"} onClick={generateAudit}>{busy === "audit" ? "Analisando presença digital..." : "Analisar presença digital com IA"}</button>
        <small>A análise do site utiliza somente dados públicos e bloqueia endereços internos. O Instagram só será avaliado com base nas informações fornecidas.</small>
      </div>

      <div className={s.card}>
        <div className={s.cardHead}><div><span>Diagnóstico</span><h2>Dados técnicos encontrados</h2></div></div>
        {audit?.error
          ? <div className={s.auditError}>{audit.error}</div>
          : audit
            ? <>
              <div className={s.metrics}>
                <div><strong>{audit.score ?? "—"}</strong><span>site</span></div>
                <div><strong>{audit.responseTimeMs ? `${audit.responseTimeMs}ms` : "—"}</strong><span>resposta</span></div>
                <div><strong>{audit.h1Count ?? "—"}</strong><span>H1</span></div>
                <div><strong>{audit.formCount ?? "—"}</strong><span>formulários</span></div>
              </div>
              <div className={s.factList}>
                <p><strong>Título:</strong> {audit.title || "Não encontrado"}</p>
                <p><strong>Descrição:</strong> {audit.metaDescription || "Não encontrada"}</p>
                <p><strong>WhatsApp:</strong> {audit.hasWhatsapp ? "Encontrado" : "Não encontrado"}</p>
                <p><strong>Mobile:</strong> {audit.hasViewport ? "Viewport configurada" : "Viewport não encontrada"}</p>
                <p><strong>Dados estruturados:</strong> {audit.hasStructuredData ? "Encontrados" : "Não encontrados"}</p>
              </div>
              <div className={s.findings}>
                <div><h3>Pontos positivos</h3>{(audit.positives || []).map(item => <p key={item}>✓ {item}</p>)}</div>
                <div><h3>Oportunidades</h3>{(audit.issues || []).map(item => <p key={item}>• {item}</p>)}</div>
              </div>
            </>
            : <div className={s.empty}>A análise técnica aparecerá aqui.</div>}
        <dl className={s.meta}>
          <div><dt>Última análise</dt><dd>{dateTime(consulting.lastAnalyzedAt)}</dd></div>
          <div><dt>Provedor</dt><dd>{consulting.providerName || "Não utilizado"}</dd></div>
          <div><dt>Modelo</dt><dd>{consulting.model || "—"}</dd></div>
        </dl>
      </div>
    </section>

    <section className={`${s.editorGrid} ${s.noPrint}`}>
      <div className={s.card}>
        <div className={s.cardHead}><div><span>Etapa 2</span><h2>Relatório completo</h2></div><button type="button" onClick={() => copy(report, "Relatório copiado.")}>Copiar</button></div>
        <textarea className={s.reportEditor} value={report} onChange={event => setReport(event.target.value)} placeholder="O relatório completo será gerado aqui." />
      </div>
      <div className={s.card}>
        <div className={s.cardHead}><div><span>Etapa 3</span><h2>Abordagem por WhatsApp</h2></div><button type="button" onClick={() => copy(whatsappMessage, "Mensagem copiada.")}>Copiar</button></div>
        <textarea className={s.messageEditor} value={whatsappMessage} onChange={event => setWhatsappMessage(event.target.value)} placeholder="A mensagem de abordagem será gerada aqui." />
        <div className={s.actions}>
          <button type="button" disabled={busy === "content"} onClick={saveContent}>{busy === "content" ? "Salvando..." : "Salvar revisão"}</button>
          {wa ? <a className={s.whatsapp} href={wa} target="_blank" rel="noopener noreferrer" onClick={() => changeStage("abordagem")}>Abrir WhatsApp</a> : <span>Lead sem WhatsApp válido</span>}
        </div>
      </div>
    </section>

    <section className={`${s.commercial} ${s.noPrint}`}>
      <div><span>Oferta atual</span><strong>{money(priceCents)}</strong><small>Consultoria Express</small></div>
      <div><span>Pagamento</span><strong>{consulting.paymentStatus === "paid" ? "Pago" : "Pendente"}</strong><small>Venda: {dateTime(consulting.soldAt)}</small></div>
      <div><span>Entrega</span><strong>{consulting.status === "delivered" ? "Entregue" : "Pendente"}</strong><small>{dateTime(consulting.deliveredAt)}</small></div>
      <div className={s.commercialActions}>
        <button type="button" disabled={busy === "payment"} onClick={markPaid}>Confirmar pagamento</button>
        <button type="button" disabled={!report || busy === "delivery"} onClick={markDelivered}>Marcar como entregue</button>
        <button type="button" disabled={!report} onClick={() => window.print()}>Imprimir / salvar PDF</button>
        <button className={s.promote} type="button" disabled={busy === "promote"} onClick={promoteToProject}>{busy === "promote" ? "Convertendo..." : "Converter em projeto"}</button>
      </div>
    </section>

    <article className={s.printReport}>
      <header>
        <span>CONSULTORIA EXPRESS DE PRESENÇA DIGITAL</span>
        <h1>{initialLead.name}</h1>
        <p>{initialLead.segment || "Empresa"} · {[initialLead.city, initialLead.location].filter(Boolean).join(", ")}</p>
      </header>
      <div className={s.printScore}><strong>{consulting.overallScore || "—"}</strong><span>Diagnóstico geral</span></div>
      <pre>{report || "O relatório ainda não foi gerado."}</pre>
      <footer>
        <strong>{initialProfile.name || initialProfile.brandName || "LeadFlow"}</strong>
        <span>{initialProfile.profession || "Consultoria de presença digital"}</span>
      </footer>
    </article>
  </main>;
}
