import { stats as getStats } from "../../repositories/leadRepository.js";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let s = null, err = null;
  try { s = await getStats(); } catch (e) { err = e.message; }
  const kpis = s ? [
    { label: "Leads", value: s.total },
    { label: "Nota A", value: s.byGrade.A || 0 },
    { label: "C/ WhatsApp", value: s.withWhatsapp },
    { label: "Landings a fazer", value: s.landingTodo },
    { label: "Retomar hoje", value: s.followupDue },
    { label: "Em aberto", value: s.active },
    { label: "Ganhos", value: s.won },
  ] : [];

  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.mark} aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <h1 className={styles.title}>LeadFlow</h1>
          <div className={styles.sub}>Dashboard</div>
        </div>
        <a className={styles.cta} href="/leads">Abrir Pipeline &rarr;</a>
      </header>
      {err ? (
        <div className={styles.err}>Erro ao ler o banco: {err}</div>
      ) : (
        <>
          <section className={styles.kpis}>
            {kpis.map(k => (
              <div key={k.label} className={styles.kpi}>
                <span className={styles.v}>{k.value}</span>
                <span className={styles.l}>{k.label}</span>
              </div>
            ))}
          </section>
          <p className={styles.note}>
            {s && s.total === 0 ? "Banco vazio. Abra o Pipeline e importe seus leads (CSV/JSON)." : "Acompanhe o funil no Pipeline."}
          </p>
        </>
      )}
    </main>
  );
}
