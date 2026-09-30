"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES } from "../../services/leads/stages.js";
import { buildProfileMessages } from "../../services/leads/profileMessages.js";
import { calculateSalesQualification } from "../../services/leads/salesQualification.js";
import * as LeadActions from "../../app/actions/leads.js";
import * as AIActions from "../../app/actions/ai.js";
import { saveLeadWorkspaceAction } from "../../app/actions/workspaces.js";
import LeadStrategyMap from "../LeadStrategyMap/LeadStrategyMap.jsx";
import s from "./LeadWorkspace.module.css";

const TABS = [
  ["info", "Informações"],
  ["strategy", "Estratégia"],
  ["qualification", "Qualificação"],
  ["scripts", "Roteiros"],
  ["objections", "Objeções"],
  ["site", "Site"],
  ["sale", "Venda"],
  ["schedule", "Agendar"],
  ["arena", "Prompt Arena"],
];

const UNIVERSAL_OBJECTIONS = [
  ["Não tenho dinheiro / está caro", "Entendo. Antes de falar em valor, posso te perguntar o que precisaria acontecer para esse investimento fazer sentido? A ideia é começar pelo que resolve o problema principal, sem incluir coisa desnecessária."],
  ["Estou ocupado / não tenho tempo", "Sem problema. Eu já deixei uma prévia pronta para você olhar quando puder. Posso te mandar o link por aqui e você vê no horário que for mais tranquilo."],
  ["Manda por WhatsApp / e-mail", "Claro. Eu já preparei uma prévia específica para o negócio. Vou te enviar o link junto com uma explicação curta para você avaliar quando puder."],
  ["Vou pensar / depois retorno", "Perfeito. O que você precisa avaliar para decidir: investimento, prazo, confiança na solução ou conversar com outra pessoa? Assim eu envio exatamente o que ajuda nessa decisão."],
  ["Já tenho quem cuida disso", "Ótimo, isso mostra que vocês valorizam o digital. Minha proposta não é substituir alguém sem necessidade; posso fazer uma análise objetiva e mostrar oportunidades que talvez ainda não estejam sendo trabalhadas."],
];

const SITE_OBJECTIONS = [
  ["Já tenho um site", "Perfeito. Então o ponto não é simplesmente ter outro site, e sim avaliar se o atual está rápido, atualizado, fácil de usar no celular e conduzindo o visitante para contato ou compra."],
  ["Não preciso de site, uso Instagram e WhatsApp", "Instagram e WhatsApp ajudam muito, mas são canais de terceiros. Um site próprio organiza as informações, aparece melhor nas buscas e leva o cliente para o contato sem depender do alcance da rede social."],
  ["Site não traz cliente para mim", "Um site isolado realmente pode não trazer resultado. Ele precisa estar alinhado à busca local, ter uma oferta clara e facilitar o próximo passo. Posso mostrar como isso funcionaria no seu caso."],
  ["Já tentei site antes e não funcionou", "Faz sentido ter cautela. O importante é entender por que não funcionou: falta de divulgação, lentidão, texto genérico, ausência de chamada para ação ou dificuldade de atualização."],
  ["Meu negócio é pequeno, não precisa", "Justamente por ser pequeno, o site pode ser simples e focado. Não precisa de um projeto enorme; basta apresentar bem o negócio, gerar confiança e facilitar o contato."],
];

const SALE_STEPS = [
  ["Quebra-gelo e rapport", "Comece perguntando sobre o negócio, tempo de mercado e rotina. O objetivo é criar conexão antes de apresentar qualquer solução."],
  ["Diagnóstico", "Pergunte como os clientes encontram a empresa hoje, quais canais funcionam e onde existe dificuldade."],
  ["Apresentação da solução", "Conecte cada parte da proposta a algo que o cliente relatou. Evite apresentar recursos sem contexto."],
  ["Demonstração", "Mostre a prévia devagar e explique o caminho que o cliente final faria até entrar em contato ou comprar."],
  ["Pergunta de interesse", "Pergunte o que ele achou e escute sem interromper. A resposta indica se existe interesse ou objeção."],
  ["Oferta", "Apresente escopo, valor, forma de pagamento e prazo somente com dados que você realmente poderá cumprir."],
];

function isMobilePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return /^\d{2}9\d{8}$/.test(local);
}

function waLink(lead, message = "") {
  const raw = lead.whatsapp || (isMobilePhone(lead.phone) ? lead.phone : "");
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

function formatLastContact(value, count = 0) {
  if (!value) return "Nunca contatado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca contatado";
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const total = Number(count || 0);
  return total > 0 ? `${formatted} · ${total} contato${total === 1 ? "" : "s"}` : formatted;
}

function activityWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function defaultCallScript(lead, profile) {
  const location = [lead.city, lead.location].filter(Boolean).join(" / ");
  const intro = [profile?.name, profile?.profession].filter(Boolean).join(", ") || "trabalho com desenvolvimento de sites";
  return [
    `ABERTURA\nOlá, falo com a pessoa responsável pela ${lead.name}? Aqui é ${intro}.`,
    `\nCONTEXTO\nEncontrei o perfil da empresa no Google${location ? ` em ${location}` : ""}${lead.googleRating ? ` e vi a avaliação ${lead.googleRating}/5` : ""}.`,
    `\nDIAGNÓSTICO\nHoje vocês usam qual canal como principal para apresentar o negócio e receber novos contatos?`,
    `\nCONEXÃO\n${lead.problem || `Percebi uma oportunidade de criar uma presença digital mais clara para o nicho de ${lead.segment || "vocês"}.`}`,
    lead.previewUrl ? `\nPRÓXIMO PASSO\nEu já preparei uma prévia visual para vocês e deixei publicada aqui: ${lead.previewUrl}\nQueria te mostrar rapidamente a lógica da página e ouvir o que você achou.` : `\nPRÓXIMO PASSO\nEu já estou trabalhando em uma prévia visual específica para vocês. Assim que publicar, envio o link para você avaliar.`,
  ].join("\n");
}

export default function LeadWorkspace({ initialLead, initialWorkspace, initialProfile = {} }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [tab, setTab] = useState("info");
  const [kind, setKind] = useState("initial");
  const initialMessages = buildProfileMessages(initialLead, initialProfile, initialWorkspace.previewUrl);
  const [callScript, setCallScript] = useState(initialWorkspace.callScript || defaultCallScript({ ...initialLead, previewUrl: initialWorkspace.previewUrl }, initialProfile));
  const [whatsappMessage, setWhatsappMessage] = useState(initialWorkspace.whatsappMessage || initialMessages.initial);
  const [outreach, setOutreach] = useState(initialWorkspace.outreach || {});
  const [qualification, setQualification] = useState(initialWorkspace.qualification || {});
  const [salesIntel, setSalesIntel] = useState(initialWorkspace.salesIntel || {});
  const [qualificationCopilot,setQualificationCopilot]=useState(initialWorkspace.qualificationCopilot||{});
  const [instagram, setInstagram] = useState(initialLead.instagram || "");
  const [previewUrl, setPreviewUrl] = useState(initialWorkspace.previewUrl || "");
  const [proposalValue, setProposalValue] = useState(String(initialLead.proposalValue || ""));
  const [notes, setNotes] = useState(initialLead.notes || "");
  const [appointment, setAppointment] = useState({
    date: initialLead.followUpAt || "",
    type: initialWorkspace.appointment?.type || "Reunião",
    time: initialWorkspace.appointment?.time || "09:00",
    notes: initialWorkspace.appointment?.notes || "",
  });
  const [sale, setSale] = useState(initialWorkspace.sale || { paymentTerms: "", meetingNotes: "", outcome: "open" });
  const [expanded, setExpanded] = useState("");
  const [objectionConversation, setObjectionConversation] = useState(initialWorkspace.objectionAssistant?.conversation || "");
  const [objectionTone, setObjectionTone] = useState(initialWorkspace.objectionAssistant?.tone || "natural");
  const [objectionObjective, setObjectionObjective] = useState(initialWorkspace.objectionAssistant?.objective || "understand");
  const [objectionAnalysis, setObjectionAnalysis] = useState(initialWorkspace.objectionAssistant || {});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [arenaType, setArenaType] = useState("landing");

  useEffect(() => {
    setWorkspace(initialWorkspace);
    setQualification(initialWorkspace.qualification || {});
    setSalesIntel(initialWorkspace.salesIntel || {});
    setQualificationCopilot(initialWorkspace.qualificationCopilot||{});
  }, [initialWorkspace]);

  const qualificationResult = useMemo(() => calculateSalesQualification(lead, qualification), [lead, qualification]);
  const currentStage = useMemo(() => STAGES.find(item => item.id === lead.stage), [lead.stage]);
  const status = lead.stage === "ganho" ? "won" : lead.stage === "perdido" ? "lost" : "open";
  const whatsapp = kind === "initial" && !previewUrl ? null : waLink(lead, whatsappMessage);

  async function mutateLead(action, patch, success) {
    const before = lead;
    setLead(current => ({ ...current, ...patch }));
    setNotice("");
    try {
      await action();
      router.refresh();
      if (success) setNotice(success);
      return true;
    } catch (error) {
      setLead(before);
      setNotice(`Erro: ${error.message}`);
      return false;
    }
  }

  async function persistWorkspace(patch, success) {
    const before = workspace;
    const next = {
      ...workspace,
      ...patch,
      qualification: { ...workspace.qualification, ...(patch.qualification || {}) },
      salesIntel: { ...workspace.salesIntel, ...(patch.salesIntel || {}) },
      appointment: { ...workspace.appointment, ...(patch.appointment || {}) },
      sale: { ...workspace.sale, ...(patch.sale || {}) },
    };
    setWorkspace(next);
    try {
      const saved = await saveLeadWorkspaceAction(lead.id, patch);
      setWorkspace(saved);
      if (success) setNotice(success);
      return saved;
    } catch (error) {
      setWorkspace(before);
      setNotice(`Erro: ${error.message}`);
      return null;
    }
  }

  async function saveDigitalData() {
    setBusy("digital");
    setNotice("");
    try {
      const normalizedInstagram = instagram.trim() || null;
      const updatedLead = await LeadActions.updateLeadAction(lead.id, { instagram: normalizedInstagram });
      const leadForScripts = { ...lead, instagram: updatedLead?.instagram ?? normalizedInstagram, previewUrl };
      const refreshedMessages = buildProfileMessages(leadForScripts, initialProfile, previewUrl);
      const refreshedCallScript = defaultCallScript(leadForScripts, initialProfile);
      const savedWorkspace = await persistWorkspace({
        previewUrl,
        whatsappMessage: refreshedMessages.initial,
        callScript: refreshedCallScript,
      }, "Instagram, link da prévia e roteiros atualizados.");
      setLead(current => ({ ...current, instagram: updatedLead?.instagram ?? normalizedInstagram }));
      if (savedWorkspace) {
        setPreviewUrl(savedWorkspace.previewUrl || "");
        setKind("initial");
        setWhatsappMessage(savedWorkspace.whatsappMessage || refreshedMessages.initial);
        setCallScript(savedWorkspace.callScript || refreshedCallScript);
      }
      router.refresh();
    } catch (error) {
      setNotice(`Erro: ${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function generateAI(target) {
    setBusy(target);
    setNotice("");
    try {
      const result = await AIActions.generateLeadMessageAction({
        lead: { ...lead, instagram, previewUrl },
        kind: target === "call" ? "call" : kind,
        currentMessage: target === "call" ? callScript : whatsappMessage,
      });
      if (target === "call") {
        setCallScript(result.text);
        await persistWorkspace({ callScript: result.text });
      } else {
        setWhatsappMessage(result.text);
        await persistWorkspace({ whatsappMessage: result.text });
      }
      setNotice(`Conteúdo gerado por ${result.providerName}${result.model ? ` · ${result.model}` : ""}. Revise antes de usar.`);
    } catch (error) {
      setNotice(`IA: ${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function generateOutreachPack() {
    setBusy("outreach-pack");
    setNotice("");
    try {
      const result = await AIActions.generateLeadOutreachPackAction({ leadId: lead.id });
      const nextOutreach = {
        emailSubject: result.emailSubject || "",
        emailBody: result.emailBody || "",
        instagram: result.instagram || "",
        linkedin: result.linkedin || "",
        coldCall: result.coldCall || "",
        generatedAt: result.generatedAt || new Date().toISOString(),
        providerName: result.providerName || "",
        model: result.model || "",
      };
      setOutreach(nextOutreach);
      if (result.whatsapp) setWhatsappMessage(result.whatsapp);
      if (result.coldCall) setCallScript(result.coldCall);
      await persistWorkspace({
        outreach: nextOutreach,
        ...(result.whatsapp ? { whatsappMessage: result.whatsapp } : {}),
        ...(result.coldCall ? { callScript: result.coldCall } : {}),
      });
      setNotice(`Pacote multicanal gerado por ${result.providerName || "IA"}${result.model ? ` · ${result.model}` : ""}. Revise antes de usar.`);
    } catch (error) {
      setNotice(`IA: ${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function saveQualification() {
    setBusy("qualification");
    setNotice("");
    try {
      const next = { ...qualification, updatedAt: new Date().toISOString() };
      const saved = await persistWorkspace({ qualification: next }, "Qualificação comercial salva.");
      if (saved) {
        setQualification(saved.qualification);
        await LeadActions.recordLeadActivityAction(lead.id, {
          type: "qualification",
          title: "Qualificação comercial atualizada",
          detail: `BANT ${qualificationResult.score}/100 · MEDDIC ${qualificationResult.meddic.overall}%`,
        }).catch(() => null);
        router.refresh();
      }
    } finally {
      setBusy("");
    }
  }

  async function generateQualificationHelp(){
    setBusy("qualification-ai");setNotice("");
    try{
      const result=await AIActions.generateQualificationCopilotAction({leadId:lead.id});
      setQualificationCopilot(result.qualificationCopilot||result);
      setWorkspace(current=>({...current,qualificationCopilot:result.qualificationCopilot||result}));
      setNotice(`Plano de descoberta gerado por ${result.providerName||"IA"}${result.model?` · ${result.model}`:""}. Nenhum campo BANT/MEDDIC foi preenchido automaticamente.`);
    }catch(error){setNotice(`IA: ${error.message}`)}finally{setBusy("")}
  }

  async function generateSalesDocument(kind) {
    setBusy(kind);
    setNotice("");
    try {
      const result = await AIActions.generateSalesIntelDocumentAction({ leadId: lead.id, kind });
      if (result.salesIntel) setSalesIntel(result.salesIntel);
      setWorkspace(current => ({ ...current, salesIntel: result.salesIntel || current.salesIntel }));
      setNotice(`${kind === "proposal" ? "Proposta" : "Briefing"} gerado por ${result.providerName || "IA"}${result.model ? ` · ${result.model}` : ""}. Revise antes de usar.`);
      router.refresh();
    } catch (error) {
      setNotice(`IA: ${error.message}`);
    } finally {
      setBusy("");
    }
  }

  function downloadMarkdown(text, name) {
    const blob = new Blob([String(text || "")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy(text, message = "Copiado.") {
    await navigator.clipboard.writeText(text);
    setNotice(message);
  }

  async function trackContact(contactKind) {
    const optimistic = {
      lastContactAt: new Date().toISOString(),
      lastContactKind: contactKind,
      contactCount: Number(lead.contactCount || 0) + 1,
    };
    setLead(current => ({ ...current, ...optimistic }));
    try {
      const saved = await LeadActions.recordContactAction(lead.id, contactKind);
      setLead(current => ({ ...current, ...saved }));
      router.refresh();
    } catch (error) {
      setNotice(`Erro ao registrar contato: ${error.message}`);
    }
  }

  async function saveAppointment(event) {
    event.preventDefault();
    setBusy("appointment");
    setNotice("");
    try {
      await LeadActions.setFollowUpAction(lead.id, appointment.date);
      const saved = await saveLeadWorkspaceAction(lead.id, { appointment: { type: appointment.type, time: appointment.time, notes: appointment.notes } });
      setLead(current => ({ ...current, followUpAt: appointment.date || null }));
      setWorkspace(saved);
      router.refresh();
      setNotice("Agendamento salvo.");
    } catch (error) {
      setNotice(`Erro ao agendar: ${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function saveSale() {
    setBusy("sale");
    setNotice("");
    try {
      await LeadActions.setProposalValueAction(lead.id, proposalValue || 0);
      await LeadActions.setNotesAction(lead.id, notes);
      const saved = await saveLeadWorkspaceAction(lead.id, { sale });
      setLead(current => ({ ...current, proposalValue: Number.parseInt(proposalValue || "0", 10) || 0, notes }));
      setWorkspace(saved);
      router.refresh();
      setNotice("Informações da venda salvas.");
    } catch (error) {
      setNotice(`Erro ao salvar venda: ${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function analyzeObjection(alternative = false) {
    if (objectionConversation.trim().length < 8) {
      setNotice("Cole as mensagens trocadas com o cliente antes de analisar.");
      return;
    }
    setBusy("objection-ai");
    setNotice("");
    try {
      const result = await AIActions.analyzeLeadConversationAction({
        leadId: lead.id,
        conversation: objectionConversation,
        tone: objectionTone,
        objective: objectionObjective,
        previousResponse: alternative ? objectionAnalysis.response || "" : "",
      });
      const objectionAssistant = {
        conversation: objectionConversation,
        tone: objectionTone,
        objective: objectionObjective,
        objectionType: result.objectionType,
        interestLevel: result.interestLevel,
        interpretation: result.interpretation,
        response: result.response,
        nextStep: result.nextStep,
        lastAnalyzedAt: new Date().toISOString(),
        providerName: result.providerName || "",
        model: result.model || "",
      };
      setObjectionAnalysis(objectionAssistant);
      await persistWorkspace({ objectionAssistant });
      setNotice(`Conversa analisada por ${result.providerName || "IA"}${result.model ? ` · ${result.model}` : ""}.`);
    } catch (error) {
      setNotice(`IA: ${error.message}`);
    } finally {
      setBusy("");
    }
  }

  function selectMessageKind(value) {
    setKind(value);
    setWhatsappMessage(buildProfileMessages({ ...lead, instagram }, initialProfile, previewUrl)[value]);
  }

  function renderInformation() {
    return <section className={s.section}>
      <h3>Informações</h3>
      <div className={s.infoCard}>
        {[
          ["Categoria", lead.segment || "Não informada"],
          ["Cidade", [lead.city, lead.location].filter(Boolean).join(", ") || "Não informada"],
          ["Telefone", lead.phone || lead.whatsapp || "Não encontrado"],
          ["Endereço", lead.address || "Não informado"],
          ["Avaliação", lead.googleRating ? `${lead.googleRating}/5 · ${lead.googleReviews || 0} avaliações` : "Sem avaliação"],
          ["Fonte", lead.source || "Não informada"],
          ["Último contato", formatLastContact(lead.lastContactAt, lead.contactCount)],
        ].map(([label, value]) => <div className={s.infoRow} key={label}><span>{label}</span><strong>{value}</strong></div>)}

        <div className={s.infoRow}><span>Etapa</span><div className={s.stageButtons}>{STAGES.map(stage => <button key={stage.id} className={lead.stage === stage.id ? s.activePill : ""} onClick={() => mutateLead(() => LeadActions.moveStageAction(lead.id, stage.id), { stage: stage.id }, `Etapa alterada para ${stage.label}.`)}>{stage.label}</button>)}</div></div>
        <div className={s.infoRow}><span>Site atual</span><div className={s.inlineActions}>{lead.site ? <a href={lead.site} target="_blank" rel="noopener noreferrer">Visitar presença ↗</a> : <em>Não encontrado</em>}{lead.mapsLink && <a href={lead.mapsLink} target="_blank" rel="noopener noreferrer">Ver no Google ↗</a>}</div></div>
        <div className={s.infoRow}><span>Status</span><div className={s.statusButtons}><button className={status === "open" ? s.activePill : ""} onClick={() => mutateLead(() => LeadActions.moveStageAction(lead.id, "negociacao"), { stage: "negociacao" })}>Em aberto</button><button className={status === "won" ? s.won : ""} onClick={() => mutateLead(() => LeadActions.moveStageAction(lead.id, "ganho"), { stage: "ganho" }, "Venda marcada como ganha.")}>Ganho</button><button className={status === "lost" ? s.lost : ""} onClick={() => mutateLead(() => LeadActions.moveStageAction(lead.id, "perdido"), { stage: "perdido" }, "Lead marcado como perdido.")}>Perdido</button></div></div>
      </div>

      <div className={s.digitalCard}>
        <div><h3>Presença digital do cliente</h3><p>Esses dados também serão utilizados pela IA nas mensagens e na criação da prévia.</p></div>
        <label><span>Instagram do cliente</span><input value={instagram} onChange={event => setInstagram(event.target.value)} placeholder="https://instagram.com/perfil" /></label>
        <label><span>Link da prévia após o deploy</span><input value={previewUrl} onChange={event => setPreviewUrl(event.target.value)} placeholder="https://previa-cliente.vercel.app" /></label>
        <div className={s.buttonRow}><button className={s.primary} disabled={busy === "digital"} onClick={saveDigitalData}>{busy === "digital" ? "Salvando..." : "Salvar dados digitais"}</button>{previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer">Abrir prévia ↗</a>}</div>
      </div>

      <div className={s.activityPanel}>
        <div className={s.activityHeading}><div><h3>Histórico comercial</h3><p>Contatos, mudanças de etapa, follow-ups, proposta, site e ações de IA.</p></div><span>{workspace.activities?.length || 0} registros</span></div>
        <div className={s.activityList}>
          {(workspace.activities || []).slice(0, 20).map(item => <article key={item.id} className={s.activityItem}>
            <span className={s["activity_" + item.type]} aria-hidden="true" />
            <div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}</div>
            <time>{activityWhen(item.createdAt)}</time>
          </article>)}
          {!workspace.activities?.length && <div className={s.activityEmpty}>O histórico será criado automaticamente conforme a prospecção avançar.</div>}
        </div>
      </div>
    </section>;
  }

  function renderStrategy() {
    return <section className={s.section}>
      <div className={s.strategyIntro}>
        <div><h3>Mapa estratégico do lead</h3><p>Monte o caminho específico desta prospecção. Arraste as fases, conecte os blocos e registre o que aconteceu em cada etapa.</p></div>
      </div>
      <LeadStrategyMap
        leadId={lead.id}
        leadName={lead.name}
        initialMap={workspace.strategyMap}
        onSaved={strategyMap => setWorkspace(current => ({ ...current, strategyMap }))}
      />
    </section>;
  }

  function renderQualification() {
    const statusOptions = [["unknown", "Não confirmado"], ["low", "Baixo"], ["medium", "Moderado"], ["high", "Forte"]];
    const dim = qualificationResult.breakdown;
    const meddic = qualificationResult.meddic;
    const slugName = String(lead.name || "lead").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lead";
    const qField = (field, value) => setQualification(current => ({ ...current, [field]: value }));
    return <section className={s.section}>
      <div className={s.qualSummary}>
        <article><span>BANT</span><strong>{qualificationResult.score}</strong><small>nota {qualificationResult.grade}</small></article>
        <article><span>MEDDIC</span><strong>{meddic.overall}%</strong><small>completude</small></article>
        <article><span>Confiança</span><strong>{qualificationResult.confidence.level}</strong><small>{qualificationResult.confidence.score}% dos sinais</small></article>
        <article className={s.qualNext}><span>Próximo passo</span><p>{qualificationResult.nextStep}</p></article>
      </div>

      <div className={s.qualCopilot}>
        <div className={s.qualCopilotHead}><div><span className={s.aiBadge}>✦ IA · COPILOTO DE DESCOBERTA</span><h3>Como conseguir as informações que faltam</h3><p>A IA usa os dados, histórico e evidências deste lead para sugerir o que perguntar. Ela não preenche BANT/MEDDIC sem confirmação.</p></div><button className={s.primary} disabled={busy==="qualification-ai"} onClick={generateQualificationHelp}>{busy==="qualification-ai"?"Analisando...":qualificationCopilot.generatedAt?"Atualizar plano":"Me ajude a qualificar este lead"}</button></div>
        {qualificationCopilot.nextBestQuestion&&<div className={s.nextQuestion}><span>PRÓXIMA PERGUNTA RECOMENDADA</span><strong>{qualificationCopilot.nextBestQuestion}</strong><p>{qualificationCopilot.nextBestReason}</p><button onClick={()=>copy(qualificationCopilot.nextBestQuestion,"Pergunta copiada.")}>Copiar pergunta</button></div>}
        {qualificationCopilot.summary&&<p className={s.qualAiSummary}>{qualificationCopilot.summary}</p>}
        {qualificationCopilot.items?.length>0&&<div className={s.discoveryGrid}>{qualificationCopilot.items.map(item=><article key={item.field}><div className={s.discoveryTop}><strong>{item.label}</strong><span className={s["evidence_"+item.state]}>{item.state==="confirmed"?"Confirmado":item.state==="evidence"?"Evidência":item.state==="hypothesis"?"Hipótese":"Desconhecido"}</span></div>{item.known&&<p><b>O que sabemos:</b> {item.known}</p>}<p><b>Por que descobrir:</b> {item.why}</p><div className={s.discoveryQuestion}><small>{item.channel} · prioridade {item.priority}</small><strong>{item.question}</strong><button onClick={()=>copy(item.question,"Pergunta copiada.")}>Copiar</button></div></article>)}</div>}
      </div>

      <div className={s.bantGrid}>
        {[
          ["budget", "Orçamento", dim.budget, "budgetStatus", "budgetEvidence", "O cliente confirmou faixa de investimento, verba disponível ou restrição real?"],
          ["authority", "Autoridade", dim.authority, "authorityStatus", "authorityEvidence", "Quem decide? Quem aprova? Quem influencia a compra?"],
          ["need", "Necessidade", dim.need, "needStatus", "needEvidence", "Qual problema concreto o cliente reconheceu e qual o impacto dele?"],
          ["timeline", "Prazo", dim.timeline, "timelineStatus", "timelineEvidence", "Existe data, urgência, evento ou janela para decidir?"],
        ].map(([key, title, item, statusField, evidenceField, placeholder]) => <article className={s.bantCard} key={key}>
          <div className={s.bantHead}><div><span>{title}</span><strong>{item.score}/25</strong></div><select value={qualification[statusField] || "unknown"} onChange={event => qField(statusField, event.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          {key === "authority" && <div className={s.qualInline}><input value={qualification.authorityContact || ""} onChange={event => qField("authorityContact", event.target.value)} placeholder="Nome do contato/decisor" /><input value={qualification.authorityRole || ""} onChange={event => qField("authorityRole", event.target.value)} placeholder="Cargo / papel" /><label className={s.checkLabel}><input type="checkbox" checked={Boolean(qualification.decisionMaker)} onChange={event => qField("decisionMaker", event.target.checked)} />Decisor econômico confirmado</label></div>}
          {key === "timeline" && <label className={s.qualDate}><span>Data-alvo</span><input type="date" value={qualification.targetDate || ""} onChange={event => qField("targetDate", event.target.value)} /></label>}
          <textarea value={qualification[evidenceField] || ""} onChange={event => qField(evidenceField, event.target.value)} placeholder={placeholder} />
          {key === "need" && (lead.problem || !lead.site || lead.weakSite !== false) && <small className={s.autoSignal}>Sinal automático: {lead.problem || (!lead.site ? "não há site próprio encontrado" : "presença digital classificada como fraca/de terceiros")}.</small>}
        </article>)}
      </div>

      <div className={s.meddicPanel}>
        <div className={s.meddicHeader}><div><h3>MEDDIC · mapa da decisão</h3><p>Não é uma segunda nota de lead: mede o quanto você realmente conhece do processo de compra.</p></div><strong>{meddic.overall}%</strong></div>
        <div className={s.meddicMeters}>
          {[["Métricas", meddic.metrics], ["Comprador econômico", meddic.economicBuyer], ["Critérios", meddic.decisionCriteria], ["Processo", meddic.decisionProcess], ["Dor", meddic.identifyPain], ["Champion", meddic.champion]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}%</b><i><em style={{ width: `${value}%` }} /></i></div>)}
        </div>
        <div className={s.qualFields}>
          <label><span>Métricas de sucesso</span><textarea value={qualification.metrics || ""} onChange={event => qField("metrics", event.target.value)} placeholder="Ex.: mais pedidos diretos, mais contatos pelo Google, reduzir dependência de plataforma. Registre apenas o que o cliente confirmou." /></label>
          <label><span>Critérios de decisão</span><textarea value={qualification.decisionCriteria || ""} onChange={event => qField("decisionCriteria", event.target.value)} placeholder="O que fará o cliente dizer sim ou não?" /></label>
          <label><span>Processo de decisão</span><textarea value={qualification.decisionProcess || ""} onChange={event => qField("decisionProcess", event.target.value)} placeholder="Quem participa, quais aprovações existem e qual é o próximo passo formal?" /></label>
          <label><span>Champion / defensor interno</span><div className={s.qualChampion}><select value={qualification.championStatus || "unknown"} onChange={event => qField("championStatus", event.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input value={qualification.championContact || ""} onChange={event => qField("championContact", event.target.value)} placeholder="Nome" /></div><textarea value={qualification.championEvidence || ""} onChange={event => qField("championEvidence", event.target.value)} placeholder="Por que essa pessoa defenderia o projeto internamente?" /></label>
        </div>
        {qualificationResult.gaps.length > 0 && <div className={s.qualGaps}><strong>Lacunas antes de considerar a oportunidade bem qualificada</strong><div>{qualificationResult.gaps.map(gap => <span key={gap}>{gap}</span>)}</div></div>}
        <div className={s.buttonRow}><button className={s.primary} disabled={busy === "qualification"} onClick={saveQualification}>{busy === "qualification" ? "Salvando..." : "Salvar qualificação"}</button></div>
      </div>

      <div className={s.salesIntelPanel}>
        <div className={s.salesIntelHeader}><div><span className={s.aiBadge}>✦ IA</span><h3>Assistente de reunião e proposta</h3><p>Usa os fatos do lead, BANT, MEDDIC, histórico, objeções e dados comerciais já registrados.</p></div></div>
        <div className={s.salesIntelGrid}>
          <article>
            <div className={s.salesIntelTitle}><strong>Briefing de reunião</strong><button className={s.primary} disabled={busy === "meeting_prep"} onClick={() => generateSalesDocument("meeting_prep")}>{busy === "meeting_prep" ? "Gerando..." : "Gerar briefing"}</button></div>
            <textarea value={salesIntel.meetingPrep || ""} onChange={event => setSalesIntel(current => ({ ...current, meetingPrep: event.target.value }))} placeholder="O briefing aparecerá aqui..." />
            <div className={s.buttonRow}><button onClick={() => persistWorkspace({ salesIntel }, "Documentos comerciais salvos.")}>Salvar</button><button onClick={() => copy(salesIntel.meetingPrep || "", "Briefing copiado.")}>Copiar</button><button onClick={() => downloadMarkdown(salesIntel.meetingPrep, `briefing-${slugName}.md`)} disabled={!salesIntel.meetingPrep}>Baixar .md</button></div>
          </article>
          <article>
            <div className={s.salesIntelTitle}><strong>Proposta comercial</strong><button className={s.primary} disabled={busy === "proposal"} onClick={() => generateSalesDocument("proposal")}>{busy === "proposal" ? "Gerando..." : "Gerar proposta"}</button></div>
            <textarea value={salesIntel.proposal || ""} onChange={event => setSalesIntel(current => ({ ...current, proposal: event.target.value }))} placeholder="A proposta aparecerá aqui..." />
            <div className={s.buttonRow}><button onClick={() => persistWorkspace({ salesIntel }, "Documentos comerciais salvos.")}>Salvar</button><button onClick={() => copy(salesIntel.proposal || "", "Proposta copiada.")}>Copiar</button><button onClick={() => downloadMarkdown(salesIntel.proposal, `proposta-${slugName}.md`)} disabled={!salesIntel.proposal}>Baixar .md</button></div>
          </article>
        </div>
      </div>
    </section>;
  }

  function renderScripts() {
    return <section className={s.section}>
      <div className={s.scriptCard}>
        <div className={s.cardHeading}><div><h3>Roteiro de ligação</h3><p>Use como guia; não precisa ler palavra por palavra.</p></div>{lead.phone && <a href={`tel:${lead.phone}`} onClick={() => trackContact("call")}>Ligar agora</a>}</div>
        <textarea value={callScript} onChange={event => setCallScript(event.target.value)} />
        <div className={s.buttonRow}><button className={s.primary} disabled={busy === "call"} onClick={() => generateAI("call")}>{busy === "call" ? "Gerando..." : "Gerar com IA"}</button><button onClick={() => persistWorkspace({ callScript }, "Roteiro salvo.")}>Salvar</button><button onClick={() => copy(callScript, "Roteiro copiado.")}>Copiar</button></div>
      </div>

      <div className={s.scriptCard}>
        <div className={s.cardHeading}><div><h3>Mensagem WhatsApp</h3><p>{previewUrl ? "Primeiro contato já envia a prévia publicada para o lead." : "Publique a prévia e salve o link na aba Informações antes do primeiro contato."}</p></div>{whatsapp && <a className={s.whatsapp} href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => trackContact(kind)}>Chamar no WhatsApp</a>}</div>
        <div className={s.messageTabs}>{[["initial", "Primeiro contato"], ["followup", "Follow-up"], ["last_attempt", "Última tentativa"], ["recovery", "Recuperar"]].map(([value, label]) => <button key={value} className={kind === value ? s.activePill : ""} onClick={() => selectMessageKind(value)}>{label}</button>)}</div>
        <textarea value={whatsappMessage} onChange={event => setWhatsappMessage(event.target.value)} />
        <div className={s.buttonRow}><button className={s.primary} disabled={busy === "whatsapp"} onClick={() => generateAI("whatsapp")}>{busy === "whatsapp" ? "Gerando..." : "Gerar com IA"}</button><button onClick={() => persistWorkspace({ whatsappMessage }, "Mensagem salva.")}>Salvar</button><button onClick={() => copy(whatsappMessage, "Mensagem copiada.")}>Copiar</button></div>
      </div>

      <div className={s.outreachPanel}>
        <div className={s.outreachHeader}><div><span className={s.aiBadge}>✦ IA</span><h3>Pacote multicanal</h3><p>Gera uma abordagem coerente para e-mail, WhatsApp, Instagram, LinkedIn e ligação usando o contexto deste lead.</p></div><button className={s.primary} disabled={busy === "outreach-pack"} onClick={generateOutreachPack}>{busy === "outreach-pack" ? "Gerando..." : "Gerar pacote completo"}</button></div>
        <div className={s.outreachGrid}>
          <article className={s.outreachCard}><div><strong>E-mail</strong><button onClick={() => copy([outreach.emailSubject, outreach.emailBody].filter(Boolean).join("\n\n"), "E-mail copiado.")}>Copiar</button></div><input value={outreach.emailSubject || ""} onChange={event => setOutreach(current => ({ ...current, emailSubject: event.target.value }))} placeholder="Assunto" /><textarea value={outreach.emailBody || ""} onChange={event => setOutreach(current => ({ ...current, emailBody: event.target.value }))} placeholder="Corpo do e-mail" /></article>
          <article className={s.outreachCard}><div><strong>Instagram DM</strong><button onClick={() => copy(outreach.instagram || "", "DM copiada.")}>Copiar</button></div><textarea value={outreach.instagram || ""} onChange={event => setOutreach(current => ({ ...current, instagram: event.target.value }))} placeholder="Mensagem para Instagram" /></article>
          <article className={s.outreachCard}><div><strong>LinkedIn</strong><button onClick={() => copy(outreach.linkedin || "", "Mensagem LinkedIn copiada.")}>Copiar</button></div><textarea value={outreach.linkedin || ""} onChange={event => setOutreach(current => ({ ...current, linkedin: event.target.value }))} placeholder="Nota de conexão / primeira mensagem" /></article>
          <article className={s.outreachCard}><div><strong>Abertura de ligação</strong><button onClick={() => copy(outreach.coldCall || "", "Abertura copiada.")}>Copiar</button></div><textarea value={outreach.coldCall || ""} onChange={event => setOutreach(current => ({ ...current, coldCall: event.target.value }))} placeholder="Abertura de ligação" /></article>
        </div>
        <div className={s.buttonRow}><button onClick={() => persistWorkspace({ outreach }, "Pacote multicanal salvo.")}>Salvar edições</button>{outreach.generatedAt && <span className={s.outreachMeta}>Gerado {new Date(outreach.generatedAt).toLocaleString("pt-BR")}{outreach.providerName ? ` · ${outreach.providerName}` : ""}{outreach.model ? ` · ${outreach.model}` : ""}</span>}</div>
      </div>
    </section>;
  }

  function renderObjections() {
    const groups = [["Objeções universais", UNIVERSAL_OBJECTIONS], ["Objeções de site", SITE_OBJECTIONS]];
    const interestLabel = { baixo: "Baixo", "médio": "Médio", alto: "Alto", incerto: "Incerto" };
    return <section className={s.section}>
      <div className={s.objectionAssistant}>
        <div className={s.assistantHeader}>
          <div><span className={s.aiBadge}>✦ IA</span><h3>Assistente de conversa</h3><p>Cole as mensagens trocadas com o cliente. A IA considera o contexto deste lead e sugere a resposta mais adequada para este momento.</p></div>
        </div>

        <label className={s.conversationField}>
          <span>Conversa com o cliente</span>
          <textarea value={objectionConversation} onChange={event => setObjectionConversation(event.target.value)} placeholder={"EU: Oi, preparei uma prévia para vocês...\n\nCLIENTE: Vi aqui. Ficou legal, mas agora não sei se preciso de um site..."} />
        </label>

        <div className={s.assistantControls}>
          <label><span>Tom da resposta</span><select value={objectionTone} onChange={event => setObjectionTone(event.target.value)}><option value="natural">Natural</option><option value="short">Curto</option><option value="consultative">Consultivo</option><option value="direct">Direto</option></select></label>
          <label><span>Objetivo</span><select value={objectionObjective} onChange={event => setObjectionObjective(event.target.value)}><option value="understand">Entender a objeção</option><option value="followup">Manter / fazer follow-up</option><option value="meeting">Levar para reunião</option><option value="defend">Defender a proposta</option><option value="negotiate">Negociar</option><option value="close">Encerrar educadamente</option></select></label>
          <button className={s.analyzeButton} disabled={busy === "objection-ai" || objectionConversation.trim().length < 8} onClick={() => analyzeObjection(false)}>{busy === "objection-ai" ? "Analisando..." : "✦ Analisar conversa"}</button>
        </div>

        {objectionAnalysis.response && <div className={s.analysisResult}>
          <div className={s.analysisSummary}>
            <div><span>Situação detectada</span><strong>{objectionAnalysis.objectionType || "Contexto comercial"}</strong></div>
            <div><span>Nível de interesse</span><strong className={s["interest_" + (objectionAnalysis.interestLevel || "incerto")]}>{interestLabel[objectionAnalysis.interestLevel] || "Incerto"}</strong></div>
            <div className={s.analysisWide}><span>Leitura da IA</span><p>{objectionAnalysis.interpretation}</p></div>
          </div>

          <div className={s.suggestedResponse}>
            <div className={s.responseHeading}><div><span>Resposta sugerida</span><small>{objectionAnalysis.providerName ? `${objectionAnalysis.providerName}${objectionAnalysis.model ? ` · ${objectionAnalysis.model}` : ""}` : "Revise antes de enviar"}</small></div><button onClick={() => copy(objectionAnalysis.response, "Resposta copiada.")}>Copiar resposta</button></div>
            <textarea value={objectionAnalysis.response} onChange={event => setObjectionAnalysis(current => ({ ...current, response: event.target.value }))} />
            <div className={s.nextStep}><span>Próximo passo sugerido</span><strong>{objectionAnalysis.nextStep || "Aguardar a reação do lead."}</strong></div>
            <div className={s.buttonRow}><button className={s.primary} onClick={() => copy(objectionAnalysis.response, "Resposta copiada.")}>Copiar mensagem</button><button disabled={busy === "objection-ai"} onClick={() => analyzeObjection(true)}>Gerar alternativa</button><button onClick={() => persistWorkspace({ objectionAssistant: { ...objectionAnalysis, conversation: objectionConversation, tone: objectionTone, objective: objectionObjective } }, "Análise salva.")}>Salvar edição</button></div>
          </div>
        </div>}
      </div>

      <div className={s.quickAnswersHeader}><div><h3>Respostas rápidas</h3><p>Biblioteca manual para quando você não precisar usar IA.</p></div></div>
      {groups.map(([title, items]) => <div key={title} className={s.objectionGroup}><h3>{title}</h3>{items.map(([question, answer]) => {
        const key = `${title}-${question}`;
        return <article className={s.objection} key={key}><button onClick={() => setExpanded(expanded === key ? "" : key)}><strong>“{question}”</strong><span>{expanded === key ? "−" : "+"}</span></button>{expanded === key && <div><p>{answer}</p><button onClick={() => copy(answer, "Resposta copiada.")}>Copiar resposta</button></div>}</article>;
      })}</div>)}
    </section>;
  }

  function renderSite() {
    return <section className={s.section}>
      <div className={s.sitePanel}>
        <div><span className={s.siteIcon}>✦</span><h3>{lead.landingStatus === "none" ? "Nenhum site criado ainda" : `Status do projeto: ${lead.landingStatus}`}</h3><p>O Instagram cadastrado será enviado como referência para o criador.</p></div>
        <a className={s.primaryLink} href={`/criar-site?lead=${lead.id}`}>{lead.landingStatus === "done" || lead.landingStatus === "sent" ? "Editar site com IA" : "Criar site com IA"}</a>
      </div>
      <div className={s.scriptCard}><h3>Status da prévia</h3><div className={s.stageButtons}>{[["none", "Não iniciado"], ["todo", "A fazer"], ["done", "Prévia pronta"], ["sent", "Enviada"]].map(([value, label]) => <button key={value} className={lead.landingStatus === value ? s.activePill : ""} onClick={() => mutateLead(() => LeadActions.setLandingAction(lead.id, value), { landingStatus: value }, `Site: ${label}.`)}>{label}</button>)}</div>{previewUrl && <div className={s.currentSite}><span>Prévia publicada</span><a href={previewUrl} target="_blank" rel="noopener noreferrer">{previewUrl}</a></div>}{lead.site && <div className={s.currentSite}><span>Presença atual</span><a href={lead.site} target="_blank" rel="noopener noreferrer">{lead.site}</a></div>}</div>
    </section>;
  }

  function renderSale() {
    return <section className={s.section}>
      <h3>Roteiro da reunião</h3>
      <div className={s.saleSteps}>{SALE_STEPS.map(([title, text], index) => <article key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></article>)}</div>
      <div className={s.saleForm}>
        <label><span>Valor da proposta</span><div className={s.moneyInput}><b>R$</b><input inputMode="numeric" value={proposalValue} onChange={event => setProposalValue(event.target.value.replace(/\D/g, ""))} /></div></label>
        <label><span>Condições de pagamento</span><input value={sale.paymentTerms || ""} onChange={event => setSale(current => ({ ...current, paymentTerms: event.target.value }))} placeholder="Ex.: entrada + 2 parcelas" /></label>
        <label className={s.full}><span>Anotações da reunião</span><textarea value={sale.meetingNotes || ""} onChange={event => setSale(current => ({ ...current, meetingNotes: event.target.value }))} /></label>
        <label className={s.full}><span>Anotações gerais do lead</span><textarea value={notes} onChange={event => setNotes(event.target.value)} /></label>
        <div className={`${s.buttonRow} ${s.full}`}><button className={s.primary} disabled={busy === "sale"} onClick={saveSale}>{busy === "sale" ? "Salvando..." : "Salvar venda"}</button><button className={s.wonButton} onClick={() => mutateLead(() => LeadActions.moveStageAction(lead.id, "ganho"), { stage: "ganho" }, "Venda concluída.")}>Marcar como ganho</button><button className={s.lostButton} onClick={() => mutateLead(() => LeadActions.moveStageAction(lead.id, "perdido"), { stage: "perdido" }, "Lead encerrado como perdido.")}>Marcar como perdido</button></div>
      </div>
    </section>;
  }

  function arenaPrompt() {
    const business = lead.name || "a marca";
    const segment = lead.segment || "seu segmento";
    const location = [lead.city, lead.location].filter(Boolean).join(", ");
    const audience = qualification.targetAudience || qualification.audience || (location ? `clientes de ${segment} em ${location}` : `clientes de ${segment}`);
    const goal = qualification.primaryGoal || qualification.goal || "gerar novos contatos e oportunidades comerciais";

    if (arenaType === "store") {
      return `Build a beautiful e-commerce storefront for ${business} selling products from the ${segment} business to ${audience}. Include a striking home page with featured collections, a product grid with filters and sorting, rich product detail pages with image galleries and reviews, a slide-out cart, and a streamlined checkout flow. Use elegant typography, premium product imagery, tasteful animations, and persistent cart state, and seed it with realistic demo products, prices, and reviews so the shop feels open for business — all fully responsive and production-ready.`;
    }

    return `Create a premium, modern, conversion-focused landing page for ${business} targeting ${audience}, with the goal of ${goal}. Design it with the polish of leading tech brands—clean typography, generous whitespace, refined gradients, subtle glassmorphism, premium visuals, and smooth, elegant animations including scroll reveals, staggered entrances, hover effects, ambient motion, and interactive microinteractions. Include a complete landing page structure (sticky navbar, hero, social proof, features, product showcase, benefits, testimonials, pricing, FAQ, CTA, and footer), ensuring it is fully responsive, accessible, mobile-first, visually stunning, and production-ready with compelling copy tailored to the brand.`;
  }

  function renderArena() {
    const prompt = arenaPrompt();
    return <section className={s.section}>
      <div className={s.arenaPanel}>
        <div className={s.arenaHead}><div><span className={s.aiBadge}>ARENA</span><h3>Gerador de prompt</h3><p>Gera o prompt no padrão Arena usando os dados já cadastrados neste lead. Revise antes de enviar, principalmente quando o modelo pedir produtos, preços, avaliações ou outras informações demonstrativas.</p></div></div>
        <div className={s.arenaType}>
          <button className={arenaType === "landing" ? s.activePill : ""} onClick={() => setArenaType("landing")}>Landing Page</button>
          <button className={arenaType === "store" ? s.activePill : ""} onClick={() => setArenaType("store")}>Loja online</button>
        </div>
        <div className={s.arenaFacts}>
          <div><span>Marca</span><strong>{business}</strong></div>
          <div><span>Segmento</span><strong>{segment}</strong></div>
          <div><span>Público usado</span><strong>{audience}</strong></div>
          {arenaType === "landing" && <div><span>Objetivo usado</span><strong>{goal}</strong></div>}
        </div>
        <label className={s.arenaOutput}><span>Prompt pronto para o Arena</span><textarea readOnly value={prompt} /></label>
        <div className={s.buttonRow}><button className={s.primary} onClick={() => copy(prompt, "Prompt do Arena copiado.")}>Copiar prompt</button></div>
      </div>
    </section>;
  }

  function renderSchedule() {
    return <section className={s.section}><h3>Novo agendamento</h3><form className={s.scheduleForm} onSubmit={saveAppointment}>
      <label><span>Tipo</span><select value={appointment.type} onChange={event => setAppointment(current => ({ ...current, type: event.target.value }))}><option>Ligação</option><option>Reunião</option><option>Apresentação</option><option>Follow-up</option><option>Envio de proposta</option></select></label>
      <label><span>Data</span><input required type="date" value={appointment.date} onChange={event => setAppointment(current => ({ ...current, date: event.target.value }))} /></label>
      <label><span>Hora</span><input required type="time" value={appointment.time} onChange={event => setAppointment(current => ({ ...current, time: event.target.value }))} /></label>
      <label className={s.full}><span>Observações</span><textarea value={appointment.notes} onChange={event => setAppointment(current => ({ ...current, notes: event.target.value }))} placeholder="Adicione uma observação..." /></label>
      <button className={`${s.primary} ${s.full}`} disabled={busy === "appointment"}>{busy === "appointment" ? "Salvando..." : "Confirmar agendamento"}</button>
    </form></section>;
  }

  const content = tab === "info" ? renderInformation()
    : tab === "strategy" ? renderStrategy()
      : tab === "qualification" ? renderQualification()
        : tab === "scripts" ? renderScripts()
      : tab === "objections" ? renderObjections()
        : tab === "site" ? renderSite()
          : tab === "sale" ? renderSale()
            : tab === "schedule" ? renderSchedule()
              : renderArena();

  return <main className={s.page}>
    <div className={s.breadcrumb}><a href="/crm">← CRM</a><span>/</span><strong>{lead.name}</strong></div>
    <section className={s.workspace}>
      <header className={s.workspaceHeader}>
        <div className={s.leadTitle}><span className={`${s.scoreBadge} ${s[`grade${lead.grade}`]}`}>{lead.score}</span><span className={`${s.gradeBadge} ${s[`grade${lead.grade}`]}`}>{lead.grade === "A" ? "Quente" : lead.grade === "B" ? "Morno" : `Nota ${lead.grade}`}</span><h1>{lead.name}</h1></div>
        <p>{currentStage?.label || lead.stage} · {[lead.segment, lead.city, lead.location].filter(Boolean).join(" · ")}</p>
      </header>
      <nav className={s.tabs}>{TABS.map(([value, label]) => <button key={value} className={tab === value ? s.tabActive : ""} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {notice && <div className={notice.startsWith("Erro") || notice.startsWith("IA:") ? s.error : s.notice}>{notice}</div>}
      <div className={s.content}>{content}</div>
    </section>
  </main>;
}
