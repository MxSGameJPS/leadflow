import { listLeads, stats as getStats } from "../../repositories/leadRepository.js";
import { prisma } from "../../lib/prisma.js";
import { BRL } from "../../services/leads/format.js";
import { isPossibleWhatsApp } from "../../services/places/googlePlaces.js";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

const pct = (value, base) => base > 0 ? Math.round((value / base) * 100) : 0;

function hasWhatsappAvailable(lead) {
  return Boolean(lead.whatsapp || isPossibleWhatsApp(lead.phone, "BR"));
}

export default async function DashboardPage() {
  let s = null, leads = [], err = null, operations = null;
  try {
    const sessionId=process.env.OPENWA_SESSION_ID?.trim()||"";
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    const dayKey=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
    [s,leads,operations]=await Promise.all([
      getStats(),listLeads(),
      (async()=>{
        const where={sessionId};
        const [captureSent,captureToday,capturePending,captureBlocked,recoverySent,recoveryToday,recoveryPending,recoveryBlocked]=await Promise.all([
          prisma.captureApproval.count({where:{...where,status:"sent"}}),
          prisma.captureApproval.count({where:{...where,status:"sent",sentAt:{gte:today,lt:tomorrow}}}),
          prisma.captureApproval.count({where:{...where,status:"approved"}}),
          prisma.captureApproval.count({where:{...where,status:{in:["sending","uncertain"]}}}),
          prisma.recoveryDispatch.count({where:{...where,status:"sent"}}),
          prisma.recoveryDispatch.count({where:{...where,status:"sent",dayKey}}),
          prisma.recoveryDispatch.count({where:{...where,status:"reserved"}}),
          prisma.recoveryDispatch.count({where:{...where,status:{in:["sending","uncertain"]}}})
        ]);
        return {captureSent,captureToday,capturePending,captureBlocked,recoverySent,recoveryToday,recoveryPending,recoveryBlocked,dayKey};
      })()
    ]);
  } catch (e) {
    err = e.message;
  }

  if (err) return <main className={styles.page}><div className={styles.err}>Erro ao ler o banco: {err}</div></main>;

  const total = s.total;
  const whatsappAvailable = leads.filter(hasWhatsappAvailable).length;
  const newLeads = s.byStage.novo || 0;
  const approached = Math.max(0, total - newLeads);
  const scheduled = 0;
  const followups = s.followupTotal;
  const lost = s.lost;
  const converted = s.won;

  const funnel = [
    { key: "total", label: "Total", value: total, rate: "Base completa", tone: styles.gray },
    { key: "approached", label: "Abordados", value: approached, rate: `${pct(approached, total)}% do total`, tone: styles.blue },
    { key: "scheduled", label: "Agendados", value: scheduled, rate: `${pct(scheduled, approached)}% dos abordados`, tone: styles.green },
    { key: "followup", label: "Follow Up", value: followups, rate: `${pct(followups, approached)}% dos abordados`, tone: styles.orange },
    { key: "lost", label: "Perdidos", value: lost, rate: `${pct(lost, approached)}% dos abordados`, tone: styles.red },
    { key: "converted", label: "Convertidos", value: converted, rate: `${pct(converted, Math.max(1, scheduled || approached))}% da operação`, tone: styles.purple },
  ];

  const recommendations = [];
  if (total === 0) recommendations.push({ level: "info", title: "Importe sua primeira base", text: "Abra Leads e envie um CSV ou JSON para começar a operação." });
  if (total > 0 && whatsappAvailable === 0) recommendations.push({ level: "danger", title: "Nenhum WhatsApp disponível", text: `Os ${total} leads atuais não possuem WhatsApp confirmado nem celular compatível para teste.` });
  else if (s.withoutContact > 0) recommendations.push({ level: "warn", title: "Base com contatos incompletos", text: `${s.withoutContact} leads não possuem WhatsApp, telefone, e-mail ou Instagram.` });
  if (s.followupDue > 0) recommendations.push({ level: "warn", title: "Follow-ups vencidos", text: `${s.followupDue} leads precisam ser retomados hoje.` });
  if (s.active > 0 && converted === 0) recommendations.push({ level: "info", title: "Pipeline em andamento", text: `${s.active} leads estão sendo trabalhados. Registre propostas e próximos passos no CRM.` });
  if (!recommendations.length) recommendations.push({ level: "ok", title: "Operação saudável", text: "Sem ações urgentes no momento." });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><h1>Dashboard</h1><p>Visão geral da sua operação</p></div>
        <div className={styles.headerActions}><a href="/inteligencia-comercial">Inteligência Comercial</a><a href="/leads">Importar leads</a><a className={styles.primary} href="/crm">Abrir CRM</a></div>
      </header>

      <section className={styles.agentSection} aria-label="Operação dos agentes">
        <div className={styles.sectionHead}><div><h2>Mensagens dos agentes</h2><p>Envios confirmados pelo LeadFlow · {operations.dayKey.split("-").reverse().join("/")}</p></div><span className={styles.agentHint}>Cotas independentes de 10/dia</span></div>
        <div className={styles.agentGrid}>
          <article className={styles.agentCard}>
            <div className={styles.agentCardTop}><div><span>01 · Novos contatos</span><h3>Agente de Captação</h3></div><a href="/captacao">Acompanhar →</a></div>
            <div className={styles.agentMainNumbers}><div><small>Enviadas hoje</small><strong>{operations.captureToday}<em>/10</em></strong></div><div><small>Total confirmado</small><strong>{operations.captureSent}</strong></div></div>
            <progress className={styles.captureProgress} max={10} value={operations.captureToday} aria-label="Cota diária da Captação" />
            <div className={styles.agentFoot}><span><b>{operations.capturePending}</b> aguardando</span><span><b>{operations.captureBlocked}</b> em envio/incertas</span></div>
          </article>
          <article className={styles.agentCard}>
            <div className={styles.agentCardTop}><div><span>02 · Contatos antigos</span><h3>Agente de Recuperação</h3></div><a href="/recuperacao/central">Acompanhar →</a></div>
            <div className={styles.agentMainNumbers}><div><small>Enviadas hoje</small><strong>{operations.recoveryToday}<em>/10</em></strong></div><div><small>Total confirmado</small><strong>{operations.recoverySent}</strong></div></div>
            <progress className={styles.recoveryProgress} max={10} value={operations.recoveryToday} aria-label="Cota diária da Recuperação" />
            <div className={styles.agentFoot}><span><b>{operations.recoveryPending}</b> reservadas</span><span><b>{operations.recoveryBlocked}</b> em envio/incertas</span></div>
          </article>
        </div>
        <div className={styles.agentSummary}><div><span>Mensagens confirmadas hoje</span><strong>{operations.captureToday+operations.recoveryToday}</strong></div><div><span>Mensagens confirmadas no histórico</span><strong>{operations.captureSent+operations.recoverySent}</strong></div><p>Não inclui tentativas incertas, envios externos nem confirmações de leitura. Os horários e bloqueios de segurança continuam sob controle do worker.</p></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>Funil de conversão</div>
        <div className={styles.funnel}>
          {funnel.map((item, index) => <div key={item.key} className={styles.stepWrap}>
            <div className={`${styles.step} ${item.tone}`} style={{ "--step": index }}><strong>{item.value}</strong></div>
            <div className={styles.stepLabel}><span>{item.label}</span><small>{item.rate}</small></div>
          </div>)}
        </div>

        <div className={styles.legendAndTotal}>
          <div className={styles.legend}>
            <p><b className={styles.purpleText}>Taxa de conversão</b> (Convertidos / Total) — principal indicador de fechamento.</p>
            <p><b className={styles.blueText}>Taxa de abordagem</b> (Abordados / Total) — mostra quanto da base já está sendo trabalhada.</p>
            <p><b className={styles.greenText}>Taxa de agendamento</b> — será ativada junto ao calendário de agendamentos.</p>
            <p><b className={styles.orangeText}>Taxa de follow-up</b> — muitos leads aqui podem indicar pipeline parado.</p>
            <p><b className={styles.redText}>Taxa de perdidos</b> — ajuda a revisar script, oferta e qualidade da base.</p>
          </div>
          <div className={styles.totalBox}><span>Total de leads</span><div className={styles.donut} style={{ "--fill": `${pct(whatsappAvailable, Math.max(total, 1)) * 3.6}deg` }}><strong>{total}</strong></div><small>{whatsappAvailable} com WhatsApp ou celular testável</small></div>
        </div>
      </section>

      <div className={styles.bottomGrid}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>Funil de leads</div>
          <div className={styles.bars}>{funnel.map(item => <div key={item.key} className={styles.barRow}><span>{item.label}</span><div><i className={item.tone} style={{ width: `${pct(item.value, Math.max(total, 1))}%` }} /></div><b>{item.value}</b></div>)}</div>
          <a className={styles.link} href="/crm">Ver CRM →</a>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>Recomendações</div>
          <div className={styles.recommendations}>{recommendations.map((item, index) => <div key={index} className={`${styles.recommendation} ${styles[item.level]}`}><strong>{item.title}</strong><p>{item.text}</p></div>)}</div>
        </section>
      </div>

      <section className={styles.kpis}>
        <div><span>Com WhatsApp</span><strong>{whatsappAvailable}</strong></div>
        <div><span>Sem contato</span><strong>{s.withoutContact}</strong></div>
        <div><span>Em aberto</span><strong>{s.active}</strong></div>
        <div><span>Pipeline</span><strong>{BRL(s.pipeline)}</strong></div>
        <div><span>Fechado</span><strong>{BRL(s.closed)}</strong></div>
      </section>
    </main>
  );
}
