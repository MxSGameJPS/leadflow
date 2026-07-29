import ModulePlaceholder from "../../components/ModulePlaceholder/ModulePlaceholder.jsx";

export default function AppointmentsPage() {
  return <ModulePlaceholder
    title="Agendamentos"
    icon="□"
    description="O calendário será conectado aos leads do CRM para registrar reuniões, retornos e lembretes sem depender de serviços externos."
    items={["Calendário mensal, semanal e diário", "Vínculo direto com o lead", "Pendências e compromissos de hoje", "Lembretes armazenados no SQLite"]}
    actionHref="/crm"
    actionLabel="Abrir CRM"
  />;
}
