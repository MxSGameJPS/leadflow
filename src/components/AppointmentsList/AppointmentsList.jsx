import s from "./AppointmentsList.module.css";

function dateLabel(value) {
  if (!value) return "Sem data";
  const [year, month, day] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function AppointmentsList({ appointments = [] }) {
  return <main className={s.page}>
    <header className={s.header}><div><h1>Agendamentos</h1><p>Reuniões, ligações e retornos vinculados aos leads do CRM.</p></div><a href="/crm">Abrir CRM</a></header>

    {appointments.length === 0 ? <section className={s.empty}><span>□</span><h2>Nenhum compromisso agendado</h2><p>Abra um lead no CRM e use a aba Agendar.</p><a href="/crm">Ir para o CRM</a></section>
      : <section className={s.list}>{appointments.map(item => <article key={item.lead.id} className={s.card}>
        <div className={s.date}><strong>{item.lead.followUpAt?.slice(8, 10)}</strong><span>{dateLabel(item.lead.followUpAt)}</span></div>
        <div className={s.details}><div><b>{item.workspace.appointment?.type || "Compromisso"}</b><span>{item.workspace.appointment?.time || "09:00"}</span></div><h2>{item.lead.name}</h2><p>{[item.lead.segment, item.lead.city, item.lead.location].filter(Boolean).join(" · ")}</p>{item.workspace.appointment?.notes && <small>{item.workspace.appointment.notes}</small>}</div>
        <a href={`/crm/${item.lead.id}`}>Abrir lead</a>
      </article>)}</section>}
  </main>;
}
