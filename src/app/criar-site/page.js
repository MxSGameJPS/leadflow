import ModulePlaceholder from "../../components/ModulePlaceholder/ModulePlaceholder.jsx";

export default function CreateSitePage() {
  return <ModulePlaceholder
    title="Criar site"
    icon="✦"
    description="O gerador usará o provedor de IA configurado, como o OmniRoute, para produzir uma primeira versão baseada nos dados reais do lead."
    items={["Escolha do lead e segmento", "Conteúdo gerado pelo OmniRoute", "Editor manual e por conversa", "Prévia local e exportação"]}
    actionHref="/configuracoes/ia"
    actionLabel="Configurar IA"
  />;
}
