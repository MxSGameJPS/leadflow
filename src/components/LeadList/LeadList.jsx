"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeSmart } from "../../services/imports/parseLeads.js";
import { importTextAction } from "../../app/actions/leads.js";
import s from "./LeadList.module.css";

const STAGE_LABEL = {
  novo: "Base",
  contatado: "Contatado",
  sem_resposta: "Sem resposta",
  com_resposta: "Com resposta",
  proposta: "Proposta",
  proposta_rejeitada: "Proposta rejeitada",
  negociacao: "Negociação",
  ganho: "Convertido",
  perdido: "Perdido",
};

export default function LeadList({ initialLeads = [] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [contact, setContact] = useState("all");
  const [grade, setGrade] = useState("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => setLeads(initialLeads), [initialLeads]);

  const counts = useMemo(() => ({
    total: leads.length,
    whatsapp: leads.filter(item => item.whatsapp).length,
    phone: leads.filter(item => item.phone).length,
    noContact: leads.filter(item => !item.whatsapp && !item.phone && !item.email && !item.instagram).length,
    noSite: leads.filter(item => !item.site).length,
  }), [leads]);

  const visible = useMemo(() => leads.filter(item => {
    if (grade !== "all" && item.grade !== grade) return false;
    if (contact === "whatsapp" && !item.whatsapp) return false;
    if (contact === "no-contact" && (item.whatsapp || item.phone || item.email || item.instagram)) return false;
    if (contact === "no-site" && item.site) return false;
    if (search) {
      const q = search.toLocaleLowerCase("pt-BR");
      const text = [item.name, item.segment, item.city, item.location, item.phone, item.whatsapp, item.site].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      if (!text.includes(q)) return false;
    }
    return true;
  }), [leads, search, contact, grade]);

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const text = decodeSmart(await file.arrayBuffer());
      const result = await importTextAction(text, file.name);
      const coverage = result.coverage;
      setNotice(`${result.recognized} reconhecidos · ${result.added} novos · ${result.updated} atualizados · ${coverage.withWhatsapp} com WhatsApp · ${coverage.withoutContact} sem contato.`);
      router.refresh();
    } catch (error) {
      setNotice("Erro na importação: " + error.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return <main className={s.page}>
    <header className={s.header}>
      <div><h1>Leads</h1><p>Importe, confira e qualifique sua base antes de enviar ao CRM.</p></div>
      <div className={s.actions}>
        <a href="/crm">Abrir CRM</a>
        <label className={s.primary}>{busy ? "Importando…" : "Importar CSV/JSON"}<input type="file" accept=".csv,.json" hidden disabled={busy} onChange={importFile} /></label>
      </div>
    </header>

    {notice && <div className={notice.startsWith("Erro") ? s.error : s.notice}>{notice}</div>}
    {counts.total > 0 && counts.whatsapp === 0 && <div className={s.warning}><strong>Esta base não possui WhatsApp.</strong><span>Os registros foram importados, mas o arquivo de origem não trouxe telefone, WhatsApp, e-mail ou Instagram. A importação não tem como criar contatos que não existem no CSV.</span></div>}

    <section className={s.stats}>
      <div><span>Total</span><strong>{counts.total}</strong></div>
      <div><span>Com WhatsApp</span><strong>{counts.whatsapp}</strong></div>
      <div><span>Com telefone</span><strong>{counts.phone}</strong></div>
      <div><span>Sem contato</span><strong>{counts.noContact}</strong></div>
      <div><span>Sem site</span><strong>{counts.noSite}</strong></div>
    </section>

    <section className={s.panel}>
      <div className={s.filters}>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa, segmento, cidade…" />
        <select value={contact} onChange={event => setContact(event.target.value)}><option value="all">Todos os contatos</option><option value="whatsapp">Com WhatsApp</option><option value="no-contact">Sem contato</option><option value="no-site">Sem site</option></select>
        <select value={grade} onChange={event => setGrade(event.target.value)}><option value="all">Todas as notas</option>{["A", "B", "C", "D"].map(item => <option key={item} value={item}>Nota {item}</option>)}</select>
        <span>{visible.length} exibidos</span>
      </div>

      <div className={s.tableWrap}>
        <table>
          <thead><tr><th>Empresa</th><th>Local / segmento</th><th>Qualificação</th><th>Contato</th><th>Presença digital</th><th>Etapa</th><th /></tr></thead>
          <tbody>{visible.map(lead => <tr key={lead.id}>
            <td><strong>{lead.name}</strong><small>{lead.source || "Importação"}</small></td>
            <td><span>{lead.city || lead.location || "Não informado"}</span><small>{lead.segment || "Sem segmento"}</small></td>
            <td><span className={`${s.grade} ${s["grade" + lead.grade]}`}>{lead.grade}</span><b className={s.score}>{lead.score}</b></td>
            <td>{lead.whatsapp ? <><b>{lead.whatsapp}</b><small>WhatsApp</small></> : lead.phone ? <><b>{lead.phone}</b><small>Telefone</small></> : <span className={s.missing}>Não encontrado</span>}</td>
            <td>{lead.site ? <a href={/^https?:/.test(lead.site) ? lead.site : "http://" + lead.site} target="_blank" rel="noopener">Abrir site</a> : lead.instagram ? <a href={lead.instagram} target="_blank" rel="noopener">Instagram</a> : <span className={s.missing}>Sem site/rede</span>}</td>
            <td><span className={s.stage}>{STAGE_LABEL[lead.stage] || lead.stage}</span></td>
            <td><div className={s.rowActions}>{lead.mapsLink && <a href={lead.mapsLink} target="_blank" rel="noopener">Maps</a>}<a href="/crm">CRM</a></div></td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <div className={s.empty}>{counts.total ? "Nenhum lead corresponde aos filtros." : "Importe um CSV ou JSON para começar."}</div>}
      </div>
    </section>
  </main>;
}
