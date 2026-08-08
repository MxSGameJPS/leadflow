function firstName(lead) {
  return String(lead?.name || "").split(/\s|–|-/)[0];
}

function signature(profile = {}) {
  return [profile.name, profile.profession].filter(Boolean).join(" · ");
}

function introduction(profile = {}) {
  const name = profile.name ? `Meu nome é ${profile.name}` : "Trabalho com criação de sites";
  const profession = profile.profession ? ` e sou ${profile.profession}` : "";
  const brand = profile.brandName ? ` na ${profile.brandName}` : "";
  return `${name}${profession}${brand}.`;
}

function observedContext(lead) {
  if (lead.googleRating) {
    return `Encontrei o perfil de vocês no Google e vi a avaliação ${lead.googleRating}/5${lead.googleReviews ? ` com ${lead.googleReviews} avaliações` : ""}. Isso mostra uma reputação muito positiva.`;
  }
  if (lead.instagram) return "Encontrei o negócio e também vi que vocês possuem presença no Instagram.";
  return "Conheci o negócio pelo perfil do Google e achei interessante o trabalho de vocês.";
}

function previewOffer(lead) {
  const niche = lead.segment ? ` para ${String(lead.segment).toLowerCase()}` : "";
  return `uma prévia de site profissional pensada${niche}`;
}

export function buildProfileMessages(lead, profile = {}, previewUrl = "") {
  const business = lead.name || "seu negócio";
  const first = firstName(lead);
  const sign = signature(profile);
  const ending = sign ? `\n\n${sign}` : "";

  const initial = `Oi! Falo com a pessoa responsável pela ${business}? 👋\n\n${introduction(profile)} ${observedContext(lead)} Preparei a ideia de ${previewOffer(lead)} para mostrar como a presença digital da ${business} poderia ficar. Posso te enviar a prévia sem compromisso?${ending}`;

  const followup = previewUrl
    ? `Oi${first ? `, ${first}` : ""}! Passando para compartilhar a prévia que preparei para a ${business}:\n${previewUrl}\n\nEla é uma proposta visual inicial, sem compromisso. Quando puder olhar, me diga o que achou.${ending}`
    : `Oi${first ? `, ${first}` : ""}! Passando novamente por aqui. Posso preparar e te enviar uma prévia visual para a ${business}, sem compromisso, para você avaliar com calma?${ending}`;

  const last_attempt = previewUrl
    ? `Oi${first ? `, ${first}` : ""}! Essa é minha última mensagem para não ficar insistindo. A prévia da ${business} continua disponível aqui:\n${previewUrl}\n\nSe isso não for prioridade agora, sem problema — encerro o contato por aqui. Se fizer sentido conversar mais adiante, posso deixar a porta aberta?${ending}`
    : `Oi${first ? `, ${first}` : ""}! Essa é minha última mensagem para não ficar insistindo. Entrei em contato porque acredito que uma presença digital própria pode fazer sentido para a ${business}, mas entendo se não for prioridade agora.\n\nVou encerrar o contato por aqui. Posso deixar a porta aberta para conversarmos no futuro?${ending}`;

  const recovery = previewUrl
    ? `Oi${first ? `, ${first}` : ""}! Retomei nossa conversa porque a prévia da ${business} continua disponível aqui:\n${previewUrl}\n\nPosso ajustar a ideia com base no que vocês realmente precisam. O que você mudaria primeiro?${ending}`
    : `Oi${first ? `, ${first}` : ""}! Posso preparar uma versão visual mais enxuta, focada apenas no essencial para a ${business}. Posso te mostrar essa ideia sem compromisso?${ending}`;

  return { initial, followup, last_attempt, recovery };
}
