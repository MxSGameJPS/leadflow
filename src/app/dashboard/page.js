import { prisma } from "@/lib/prisma";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let total = 0, byGrade = {}, withWa = 0, err = null;
  try {
    total = await prisma.lead.count();
    const leads = await prisma.lead.findMany({ select: { grade: true, whatsapp: true } });
    for (const l of leads) {
      byGrade[l.grade] = (byGrade[l.grade] || 0) + 1;
      if (l.whatsapp) withWa++;
    }
  } catch (e) {
    err = e.message;
  }

  const kpis = [
    { label: "Leads", value: total },
    { label: "Nota A", value: byGrade.A || 0 },
    { label: "Nota B", value: byGrade.B || 0 },
    { label: "Nota C", value: byGrade.C || 0 },
    { label: "Nota D", value: byGrade.D || 0 },
    { label: "C/ WhatsApp", value: withWa },
  ];

  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.mark} aria-hidden="true" />
        <div>
          <h1 className={styles.title}>LeadFlow</h1>
          <div className={styles.sub}>Dashboard — Fase 1 (scaffold)</div>
        </div>
      </header>

      {err ? (
        <div className={styles.err}>Erro ao ler o banco: {err}<br/>Rode as migrations (prisma migrate dev).</div>
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
            Banco SQLite ativo e vazio (base em branco). Importe leads via CSV/JSON na Fase 5.
          </p>
          <p className={styles.note}>
            Proximas fases: services (logica portada do HTML), Kanban 9 colunas, drawer completo, import/export.
          </p>
        </>
      )}
    </main>
  );
}
