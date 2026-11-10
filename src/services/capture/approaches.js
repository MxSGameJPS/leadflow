const text=(value,max=130)=>String(value||"").trim().slice(0,max);
const variants=[
 {id:"diagnostico",label:"Diagnóstico consultivo"},
 {id:"oportunidade",label:"Oportunidade de contato"},
 {id:"autoridade",label:"Autoridade e exemplos"}
];
export const CAPTURE_APPROACHES=variants;

const segmentIdeas=[
 {terms:["padaria","confeitaria","restaurante","lanchonete","pizzaria","delivery","alimento"],benefit:"facilitar o acesso ao cardápio, aos horários e ao WhatsApp para pedidos"},
 {terms:["oficina","mecanica","auto center","automotivo","carro"],benefit:"apresentar os serviços e facilitar pedidos de orçamento e agendamento"},
 {terms:["advogado","advocacia","juridico","escritorio de advocacia"],benefit:"organizar informações institucionais e facilitar o primeiro contato, respeitando as regras de publicidade profissional"},
 {terms:["clinica","consultorio","dentista","estetica","saude"],benefit:"apresentar serviços e organizar solicitações de agendamento, sem promessas de resultados"},
 {terms:["pet","veterinaria","banho e tosa"],benefit:"apresentar serviços, localização e formas de agendamento"},
 {terms:["loja","comercio","varejo","moda"],benefit:"organizar produtos, informações comerciais e canais de atendimento"}
];
export function captureSegmentBenefit(lead){
 const segment=String(lead.segment||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return segmentIdeas.find(group=>group.terms.some(term=>segment.includes(term)))?.benefit||"facilitar o acesso aos serviços e o contato pelo WhatsApp";
}

export function captureApproachForLead(lead){
 const seed=String(lead.id||lead.name||"").split("").reduce((acc,ch)=>(acc*31+ch.charCodeAt(0))>>>0,7);
 return variants[seed%variants.length].id;
}
export function buildCaptureMessage(lead,variant=captureApproachForLead(lead)){
 const name=text(lead.name,90)||"seu negócio";
 const segment=text(lead.segment,75);
 const city=text(lead.city,70);
 const context=segment?` do setor de ${segment}`:city?` de ${city}`:"";
 const benefit=captureSegmentBenefit(lead);
 const page="https://www.saulopavanello.com.br/previas";
 if(variant==="diagnostico")return `Olá! Tudo bem? Sou Saulo Pavanello, desenvolvedor de sites e sistemas. Estou entrando em contato com ${name}${context} e queria fazer uma pergunta: como vocês organizam hoje as informações sobre os serviços e o primeiro contato com clientes? Uma página própria pode ${benefit}. Se fizer sentido, posso explicar por aqui. Alguns exemplos do meu trabalho: ${page}`;
 if(variant==="oportunidade")return `Olá, tudo bem? Meu nome é Saulo Pavanello. Estou entrando em contato porque trabalho com páginas que ajudam negócios como ${name} a ${benefit}. Posso te mostrar uma possibilidade simples para o negócio, sem compromisso? Aqui estão algumas prévias do que desenvolvo: ${page}`;
 return `Olá! Sou Saulo Pavanello, trabalho com desenvolvimento de sites e sistemas. Estou apresentando meu trabalho para negócios${context}, como ${name}. Um site próprio pode ${benefit}. Posso te contar uma ideia para vocês? Se quiser conhecer meu estilo de trabalho: ${page}`;
}
