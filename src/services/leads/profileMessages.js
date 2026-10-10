function signature(profile = {}) {
  return [profile.name, profile.profession].filter(Boolean).join(" · ");
}
function introduction(profile = {}) {
  const who = profile.name ? `Sou ${profile.name}` : "Trabalho com desenvolvimento de sites";
  return profile.profession ? `${who}, ${profile.profession}.` : `${who}.`;
}
function context(lead = {}) {
  if (lead.googleRating) return `Vi o perfil da empresa no Google, com avaliação ${lead.googleRating}/5${lead.googleReviews ? ` em ${lead.googleReviews} avaliações` : ""}.`;
  if (lead.instagram) return "Conheci o perfil da empresa no Instagram.";
  return "Conheci o trabalho de vocês e pensei em uma oportunidade digital.";
}
export function buildProfileMessages(lead = {}, profile = {}, previewUrl = "") {
  const business = lead.name || "empresa";
  const sign = signature(profile);
  const ending = sign ? `\n\n${sign}` : "";
  const initial = `Olá! Falo com quem cuida da ${business}? ${introduction(profile)} ${context(lead)} Tenho uma ideia de como um site próprio poderia apresentar melhor o negócio e facilitar o contato de novos clientes. Posso explicar a ideia por aqui?${ending}`;
  const preview = `Conforme conversamos, esta é uma prévia inicial do que poderíamos desenvolver para a ${business}.${previewUrl ? `\n\n${previewUrl}` : " Assim que o link estiver disponível, posso encaminhá-lo."}\n\nÉ apenas uma ideia visual: podemos ajustar todo o layout, textos, estrutura e funcionalidades ao jeito de vocês. Um site próprio ajuda a reunir informações em um endereço da empresa, facilita sua descoberta nas buscas e complementa o Instagram e o WhatsApp. O que você gostaria de adaptar primeiro?${ending}`;
  const followup = `Oi! Retomando brevemente: minha ideia é ajudar a ${business} a apresentar seus serviços em um espaço próprio na internet, complementar às redes sociais. Faz sentido eu te explicar como seria? Se não for o momento, sem problema.${ending}`;
  const last_attempt = `Oi! Esta é minha última mensagem para não ficar insistindo. Entendo se uma solução digital não for prioridade agora; vou encerrar o contato por aqui. Se no futuro fizer sentido conversar, fico à disposição.${ending}`;
  const recovery = `Entendi, agradeço seu retorno! Respeito sua decisão e fico à disposição caso precisem de alguma solução digital mais adiante.${ending}`;
  return { initial, preview, followup, last_attempt, recovery };
}
