"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSiteProjectAction } from "../../app/actions/projects.js";
import s from "./SiteCreatorStart.module.css";

export default function SiteCreatorStart({ leads = [], initialLeadId = "" }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialLeadId ? "lead" : "describe");
  const [leadId, setLeadId] = useState(initialLeadId || leads[0]?.id || "");
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [city, setCity] = useState("");
  const [source, setSource] = useState("");
  const [template, setTemplate] = useState("institutional");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedLead = useMemo(() => leads.find(lead => lead.id === leadId) || null, [leadId, leads]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await createSiteProjectAction({ mode, leadId, name, segment, city, source, template });
      router.push("/projetos");
      router.refresh();
    } catch (error) {
      setNotice(`Erro: ${error.message}`);
      setBusy(false);
    }
  }

  return <main className={s.page}>
    <div className={s.hero}>
      <div className={s.spark}>✦</div>
      <h1>Site para um negócio fora da busca</h1>
      <p>Descreva o negócio, cole um link do Google ou escolha um lead já salvo no CRM.</p>
    </div>

    <form className={s.creator} onSubmit={submit}>
      <div className={s.tabs}>
        <button type="button" className={mode === "describe" ? s.active : ""} onClick={() => setMode("describe")}>Descrever</button>
        <button type="button" className={mode === "google" ? s.active : ""} onClick={() => setMode("google")}>Link do Google</button>
        <button type="button" className={mode === "lead" ? s.active : ""} onClick={() => setMode("lead")}>Lead existente</button>
      </div>

      <div className={s.body}>
        {mode === "lead" && <>
          <label className={s.leadSelect}><span>Escolha o lead</span><select required value={leadId} onChange={event => setLeadId(event.target.value)}><option value="">Selecione...</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name} · {lead.city || lead.location || "Local não informado"}</option>)}</select></label>
          {selectedLead && <div className={s.selectedLead}><span>{selectedLead.name.slice(0, 1).toUpperCase()}</span><div><strong>{selectedLead.name}</strong><small>{selectedLead.segment || "Sem categoria"} · {selectedLead.city || selectedLead.location || "Local não informado"}</small></div><a href={`/crm/${selectedLead.id}`}>Abrir CRM</a></div>}
        </>}

        {mode === "describe" && <div className={s.formGrid}>
          <label><span>Nome do negócio</span><input required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Pizzaria da Serra" /></label>
          <label><span>Categoria</span><input value={segment} onChange={event => setSegment(event.target.value)} placeholder="Ex.: Pizzaria" /></label>
          <label><span>Cidade</span><input value={city} onChange={event => setCity(event.target.value)} placeholder="Ex.: Dois Irmãos" /></label>
          <label className={s.full}><span>Descrição do negócio</span><textarea required value={source} onChange={event => setSource(event.target.value)} placeholder="Descreva serviços, diferenciais, público e objetivo do site..." /></label>
        </div>}

        {mode === "google" && <div className={s.formGrid}>
          <label><span>Nome do negócio</span><input required value={name} onChange={event => setName(event.target.value)} /></label>
          <label><span>Categoria</span><input value={segment} onChange={event => setSegment(event.target.value)} /></label>
          <label className={s.full}><span>Link do Google Maps</span><input required type="url" value={source} onChange={event => setSource(event.target.value)} placeholder="https://maps.google.com/..." /></label>
        </div>}

        <div className={s.footer}>
          <select value={template} onChange={event => setTemplate(event.target.value)}>
            <option value="institutional">Site institucional</option>
            <option value="landing">Landing page</option>
            <option value="menu">Cardápio / delivery</option>
            <option value="booking">Serviços / agendamento</option>
          </select>
          <span>O rascunho será salvo localmente em Meus projetos.</span>
          <button disabled={busy || (mode === "lead" && !leadId)}>{busy ? "Preparando..." : "Preparar projeto"} ↑</button>
        </div>
      </div>
    </form>

    {notice && <div className={s.notice}>{notice}</div>}
  </main>;
}
