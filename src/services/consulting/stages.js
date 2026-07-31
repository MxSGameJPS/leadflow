export const CONSULTING_STAGES = Object.freeze([
  { id: "novo", label: "Novo", sub: "Aguardando diagnóstico" },
  { id: "analise", label: "Em análise", sub: "Presença digital sendo avaliada" },
  { id: "relatorio_pronto", label: "Relatório pronto", sub: "Revisar antes da abordagem" },
  { id: "abordagem", label: "Abordagem enviada", sub: "Contato inicial realizado" },
  { id: "interessado", label: "Interessado", sub: "Lead demonstrou interesse" },
  { id: "pagamento", label: "Pagamento", sub: "Aguardando confirmação" },
  { id: "vendido", label: "Vendido", sub: "Consultoria confirmada" },
  { id: "entregue", label: "Entregue", sub: "Relatório enviado ao cliente" },
  { id: "perdido", label: "Perdido", sub: "Sem continuidade" },
]);

export const CONSULTING_STAGE_IDS = Object.freeze(CONSULTING_STAGES.map(stage => stage.id));

export function validateConsultingStage(value) {
  const stage = String(value || "").trim();
  if (!CONSULTING_STAGE_IDS.includes(stage)) throw new Error("Etapa de consultoria inválida.");
  return stage;
}
