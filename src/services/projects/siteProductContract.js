function clean(value,max=500){return String(value??"").trim().slice(0,max)}
const DELIVERY_WORDS=["delivery","entrega","pedido","pedidos"];
function isDelivery(template,instruction=""){const text=(clean(template,120)+" "+clean(instruction,1200)).toLowerCase();return DELIVERY_WORDS.some(word=>text.includes(word))}

export function buildProductContract({template="landing",instruction=""}={}){
  const delivery=isDelivery(template,instruction);
  return{
    type:delivery?"delivery":clean(template,80)||"landing",
    hardRequirement:false,
    mode:"commercial-preview",
    job:delivery?"Criar a melhor experiência demonstrativa possível de descoberta e pedido para este negócio.":"Criar a melhor experiência comercial demonstrativa possível para este negócio.",
    creativeFreedom:"TOTAL. Dados reais são contexto e ponto de partida, não limite. Você pode criar conteúdo, produtos, preços, avaliações, promoções, benefícios, páginas, fluxos, microcopy, imagens sugeridas, estados e dados mock/demonstrativos quando isso elevar a proposta.",
    productFreedom:"Decida autonomamente a arquitetura, quantidade de páginas, seções, componentes, interações e funcionalidades adequadas ao segmento. Não espere que o briefing detalhe cada componente.",
    previewPolicy:"Esta é uma PRÉVIA comercial. Conteúdo criado pela IA pode ser demonstrativo e será validado com o cliente antes de produção.",
    requiredExperiences:delivery?["experiência de descoberta de produtos convincente","jornada de pedido perceptível","interações reais de interface quando agregarem valor","excelente experiência desktop e mobile"]:["experiência específica ao segmento","identidade visual autoral","hierarquia e conversão claras","excelente experiência desktop e mobile"],
    forbidden:["entregar template genérico ou intercambiável","reduzir o produto por falta de dados reais","usar ausência de dados como justificativa para uma experiência vazia"],
    qa:["parece um produto comercial completo antes de ler os textos","a solução tem personalidade própria","funciona em desktop e mobile","as funcionalidades prometidas pela interface são coerentes"]
  };
}
export function productContractPrompt(contract={}){return "DIREÇÃO DE PRODUTO PARA PRÉVIA: "+JSON.stringify(contract)}
