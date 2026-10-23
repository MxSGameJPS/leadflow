export const DEFAULT_POLICY = {
  version: 1,
  entryPercent: 50,
  requiresMeetingBeforeClosing: true,
  services: [
    { id:"express", name:"Página Express", minimumPrice:450, minimumNegotiablePrice:400, supportDays:45, description:"Landing page simples promocional." },
    { id:"delivery", name:"Vitrine Delivery", minimumPrice:1200, maxDiscountPercent:15, supportDays:60, description:"Cardápio, carrinho, formulário com endereço, nome, telefone, forma de pagamento, registro do pedido, redirecionamento para WhatsApp e painel para pedidos em tempo real e relatórios; não inclui checkout online." },
    { id:"institutional", name:"Site Institucional", minimumPrice:1700, maxDiscountPercent:15, supportDays:90, description:"Site institucional; escopo e funcionalidades definidos em reunião." },
    { id:"ecommerce", name:"E-commerce", minimumPrice:3000, maxDiscountPercent:15, supportDays:90, description:"Loja virtual; escopo e integrações definidos em reunião." },
    { id:"websystem", name:"Sistema Web", minimumPrice:3500, maxDiscountPercent:15, supportDays:90, description:"Sistema web personalizado; escopo definido em reunião." },
    { id:"android", name:"Aplicativo Android", minimumPrice:2500, maxDiscountPercent:15, supportDays:90, description:"Aplicativo Android; escopo definido em reunião." },
    { id:"mobile", name:"Aplicativo Android + iOS", minimumPrice:5000, maxDiscountPercent:15, supportDays:90, description:"Aplicativo Android e iOS; escopo definido em reunião." },
  ],
  benefits: {
    hosting:"Hospedagem gratuita quando compatível com planos gratuitos de Vercel, Netlify ou similar, sujeita a limites e alterações do provedor.",
    seo:"SEO avançado, sem garantia de posições específicas em mecanismos de busca.",
    database:"Banco de dados gratuito quando aplicável, no plano gratuito do Supabase e sujeito a seus limites.",
    domain:"Domínio contratado e pago separadamente pelo cliente; orientação para compra e configuração incluída.",
    ownerManual:"Todo projeto inclui Manual do Proprietário com stack e acessos a GitHub, hospedagem e banco de dados quando aplicáveis.",
  },
};
export function validatePolicy(value) {
  if (!value || value.version !== 1 || value.entryPercent !== 50 || value.requiresMeetingBeforeClosing !== true) throw new Error("Entrada de 50% e reunião obrigatória não podem ser alteradas.");
  if (!Array.isArray(value.services) || value.services.length !== DEFAULT_POLICY.services.length) throw new Error("Catálogo comercial incompleto.");
  const services = DEFAULT_POLICY.services.map(base => {
    const service = value.services.find(item => item.id === base.id);
    if (!service || !Number.isSafeInteger(service.minimumPrice) || service.minimumPrice <= 0) throw new Error("Preço inválido: "+base.name);
    const floor = base.id === "express" ? service.minimumNegotiablePrice : Math.round(service.minimumPrice * 0.85 * 100)/100;
    if (base.id === "express" && (!Number.isSafeInteger(floor) || floor <= 0 || floor > service.minimumPrice)) throw new Error("Limite da Página Express inválido.");
    if (base.id !== "express" && service.maxDiscountPercent !== 15) throw new Error("Desconto máximo deve permanecer em 15%.");
    return { ...base, minimumPrice:service.minimumPrice, ...(base.id==="express"?{minimumNegotiablePrice:floor}:{maxDiscountPercent:15}) };
  });
  return { ...DEFAULT_POLICY, services };
}
export function validateProposal(policy, { serviceId, quotedPrice, meetingCompleted=false, close=false }) {
  const service = policy.services.find(item=>item.id===serviceId);
  if (!service) return { allowed:false, reason:"Serviço desconhecido." };
  if (!Number.isFinite(quotedPrice) || quotedPrice<=0) return { allowed:false, reason:"Preço inválido." };
  const floor = service.id==="express" ? service.minimumNegotiablePrice : Math.round(service.minimumPrice*(1-service.maxDiscountPercent/100)*100)/100;
  if (quotedPrice < floor) return { allowed:false, reason:"Valor abaixo do limite comercial autorizado." };
  if (close && !meetingCompleted) return { allowed:false, reason:"É obrigatória uma call ou reunião presencial antes de fechar o contrato." };
  return { allowed:true, minimumAllowedPrice:floor, entryAmount:Math.round(quotedPrice*policy.entryPercent)/100 };
}
export function createCommercialInstructions(policy) {
  return [
    "Você atende em nome de Saulo Pavanello, de forma natural, cordial e objetiva. Não se apresente espontaneamente como atendente virtual; jamais afirme ser o próprio Saulo. Se perguntarem, esclareça que o atendimento usa automação.",
    "Seu objetivo é atender, tirar dúvidas, compreender a intenção e agendar uma call ou visita presencial para Saulo finalizar pessoalmente. NUNCA feche um serviço, cobre entrada, gere contrato ou confirme contratação antes da reunião.",
    "Nunca invente valores, descontos, parcelas, prazos, vagas de agenda, funcionalidades ou garantias. Responda perguntas sobre preços com 'a partir de' e esclareça que depende do escopo.",
    ...policy.services.map(s=>`${s.name}: a partir de R$ ${s.minimumPrice.toFixed(2)}; suporte ${s.supportDays} dias; ${s.description}`),
    "Página Express: desconto jamais abaixo de R$ "+policy.services.find(s=>s.id==="express").minimumNegotiablePrice+". Demais serviços: desconto máximo 15% em relação ao valor de referência; não ofereça descontos espontaneamente nem prometa um orçamento definitivo.",
    "Entrada obrigatória de 50% do contrato, somente após reunião e fechamento realizado por Saulo. Saldo restante e parcelamento não estão definidos.",
    ...Object.values(policy.benefits),
    "Na Vitrine Delivery, explique o painel para acompanhar pedidos em tempo real e gerar relatórios; o pedido é salvo e encaminhado ao WhatsApp e não existe pagamento dentro do site.",
    "Nunca pressione quem recusou ou pediu para não receber mensagens. Interrompa o contato diante de opt-out.",
  ].join("\n");
}
