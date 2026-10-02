const profiles = {
  delivery: ["catalog", "categories", "product-details", "quantity-options-notes", "persistent-cart", "cart-edit-remove-subtotal", "checkout", "customer-contact", "delivery-pickup-address", "payment-change", "order-validation", "whatsapp-order-summary"],
  ecommerce: ["catalog", "search-filters", "product-details", "persistent-cart", "checkout", "order-summary", "honest-payment-status"],
  realestate: ["property-list", "filters", "property-details", "photo-gallery", "location-features", "inquiry"],
  clinic: ["specialties", "professionals", "service-selection", "appointment-request", "form-validation", "contact"],
  hotel: ["rooms", "gallery", "amenities", "dates-guests", "availability-request", "form-validation", "contact"],
  restaurant: ["menu", "categories", "hours-location", "reservation-request", "contact"],
  portfolio: ["selected-work", "project-detail", "expertise", "contact"],
  services: ["services", "service-details", "quote-request", "form-validation", "contact"],
  institutional: ["clear-value-proposition", "offer-details", "business-evidence", "contact", "navigation"],
};
export function buildProductContract({template="landing",instruction="",segment=""}={}) {
  const text=`${template} ${instruction}`.toLowerCase();
  const inferred=`${text} ${segment}`.toLowerCase();
  const type=/delivery|entrega|pedidos?\b/.test(text)||/hamburguer|hambúrguer|lanchonete|pizzaria|açaí|acai/.test(segment.toLowerCase())?"delivery"
    : /ecommerce|e-commerce|loja virtual/.test(text)?"ecommerce"
    : /imobili|imóveis|imoveis/.test(inferred)?"realestate"
    : /clínica|clinica|consultório|consultorio|odont/.test(inferred)?"clinic"
    : /hotel|pousada|hospedagem/.test(inferred)?"hotel"
    : /restaurante|restaurant/.test(inferred)?"restaurant"
    : /portf[oó]lio/.test(text)?"portfolio"
    : /servi[cç]os|oficina|advoca/.test(inferred)?"services":"institutional";
  return {
    type,version:2,hardRequirement:true,mode:"commercial-preview",
    job:`Entregar um produto ${type} utilizável, específico ao lead, com jornada completa.`,
    creativeFreedom:"Layout, identidade, tipografia, composição, navegação, páginas e componentes são decisões livres do diretor. Nenhuma sequência de seções é obrigatória.",
    productFreedom:"Organize as capacidades numa experiência coerente. Controles devem funcionar, não apenas parecer clicáveis.",
    previewPolicy:"Produtos e preços de demonstração são permitidos quando faltarem dados, identificados visivelmente como demonstração. Preserve fatos reais. Não invente avaliações, credenciais, disponibilidade, prazos ou pagamentos confirmados. Não envie pedidos nem cobre automaticamente.",
    requiredExperiences:profiles[type],
    forbidden:["substituir uma jornada de pedido por links individuais de WhatsApp", "controles sem ação", "usar uma landing genérica no lugar do produto", "declarar aprovação sem testar"],
    qa:["jornada principal completa no navegador", "sem erros de runtime", "desktop e mobile 320px/390px", "nenhuma imagem quebrada", "identidade específica ao lead", "estados vazio, erro e sucesso coerentes"],
    acceptance: type==="delivery" ? {
      journey:"Filtrar categoria → abrir produto → configurar quantidade/adicionais/observação → adicionar → editar/remover itens → recarregar e preservar carrinho → checkout → validar → entrega/retirada → pagamento/troco → resumo → link WhatsApp contendo pedido completo.",
      testing:"Use data-testid nos controles reais, sem alterar o design. product-card abre detalhes; category-filter filtra; product-quantity é input number; product-note é textarea; product-addon é checkbox quando houver; add-to-cart adiciona; cart-open abre carrinho; cart-count mostra quantidade total; cart-item contém item; cart-increase/cart-decrease/cart-remove agem no item; cart-subtotal mostra subtotal; checkout-open abre checkout; checkout-submit valida; checkout-errors mostra erros; order-summary mostra resumo; whatsapp-order é anchor com URL pronta APENAS após validação. Campos name: customerName, phone, fulfillment (select delivery/pickup), address, payment (select pix/card/cash), changeFor. Nunca abrir WhatsApp automaticamente.",
      validation:"Carrinho não vazio; nome; telefone válido; endereço obrigatório apenas na entrega; dinheiro exige informar troco (0 = sem troco) e se positivo deve cobrir subtotal. Quantidades inteiras positivas; adicionais entram no subtotal. Impedir finalização inválida. Sem número comercial verificado, exibir pedido copiável (botão data-testid=order-copy) e contato pendente, nunca inventar destino."
    } : {journey:"Executar a ação central até o resumo/solicitação validada. Não simular backend, disponibilidade ou cobrança como confirmados."}
  };
}
export function productContractPrompt(contract={}) {return "CONTRATO FUNCIONAL OBRIGATÓRIO (define comportamentos, nunca layout): "+JSON.stringify(contract);}
