import ModulePlaceholder from "../../components/ModulePlaceholder/ModulePlaceholder.jsx";

export default function ProjectsPage() {
  return <ModulePlaceholder
    title="Meus projetos"
    icon="◇"
    description="Aqui ficarão os sites criados para demonstração, suas versões, arquivos locais e situação de envio para cada lead."
    items={["Projetos vinculados aos leads", "Histórico de versões", "Prévia local", "Exportação HTML, ZIP ou Next.js"]}
    actionHref="/criar-site"
    actionLabel="Ir para Criar site"
  />;
}
