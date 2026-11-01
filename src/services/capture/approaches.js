const text=(value,max=130)=>String(value||"").trim().slice(0,max);
const variants=[
 {id:"diagnostico",label:"Diagnóstico consultivo"},
 {id:"oportunidade",label:"Oportunidade de contato"},
 {id:"autoridade",label:"Autoridade e exemplos"}
];
export const CAPTURE_APPROACHES=variants;
export function captureApproachForLead(lead){
 const seed=String(lead.id||lead.name||"").split("").reduce((acc,ch)=>(acc*31+ch.charCodeAt(0))>>>0,7);
 return variants[seed%variants.length].id;
}
export function buildCaptureMessage(lead,variant=captureApproachForLead(lead)){
 const name=text(lead.name,90)||"seu negócio";
 const segment=text(lead.segment,75);
 const city=text(lead.city,70);
 const context=segment?` do setor de ${segment}`:city?` de ${city}`:"";
 const page="https://www.saulopavanello.com.br/previas";
 if(variant==="diagnostico")return `Olá! Tudo bem? Sou Saulo Pavanello, desenvolvedor de sites e sistemas. Conheci ${name}${context} e queria fazer uma pergunta: hoje vocês conseguem transformar as visitas às redes sociais em novos contatos com facilidade? Tenho algumas ideias de como uma página própria pode ajudar. Se fizer sentido, posso explicar por aqui. Alguns exemplos do meu trabalho: ${page}`;
 if(variant==="oportunidade")return `Olá, tudo bem? Meu nome é Saulo Pavanello. Estou entrando em contato porque trabalho com páginas que ajudam negócios como ${name} a organizar seus serviços e facilitar o atendimento pelo WhatsApp. Posso te mostrar uma possibilidade simples para o negócio, sem compromisso? Aqui estão algumas prévias do que desenvolvo: ${page}`;
 return `Olá! Sou Saulo Pavanello, trabalho com desenvolvimento de sites e sistemas. Estou apresentando meu trabalho para negócios${context}, como ${name}. Um site próprio pode ajudar o cliente a encontrar informações e chegar ao WhatsApp com menos etapas. Posso te contar uma ideia para vocês? Se quiser conhecer meu estilo de trabalho: ${page}`;
}
