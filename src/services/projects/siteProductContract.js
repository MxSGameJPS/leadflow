function clean(value,max=500){return String(value??"").trim().slice(0,max)}
const DELIVERY_WORDS=["delivery","entrega","pedido","pedidos"];
function isDelivery(template,instruction=""){const text=(clean(template,120)+" "+clean(instruction,1200)).toLowerCase();return DELIVERY_WORDS.some(word=>text.includes(word))}
export function buildProductContract({template="landing",instruction="",hasWhatsapp=false,hasPhone=false,hasMenu=false}={}){
  if(isDelivery(template,instruction)){
    return{
      type:"delivery",
      hardRequirement:true,
      job:"Permitir que o visitante avance para um pedido, não apenas conhecer a empresa.",
      mustFeelLike:"produto digital de delivery vivo, apetitoso e orientado à ação; nunca landing institucional genérica",
      requiredExperiences:["entrada orientada a pedido","descoberta visual de produtos/categorias quando houver dados","estado de pedido/carrinho quando houver itens verificáveis","resumo e ação de concluir pedido","informações de entrega/retirada somente quando verificadas","CTA persistente no mobile"],
      dataPolicy:hasMenu?"Use exclusivamente itens, preços e adicionais verificados.":"Não há cardápio/preços verificados: NÃO invente produtos ou valores. Crie a experiência de descoberta/pedido com estados honestos e conduza ao canal real para consultar cardápio/fazer pedido.",
      checkout:hasWhatsapp?"WhatsApp é o canal real de conclusão do pedido.":hasPhone?"Telefone é o canal real de conclusão do pedido.":"Não existe canal de checkout verificado; não simule compra concluída.",
      forbidden:["transformar delivery em landing institucional","inventar cardápio, preço, taxa, raio ou prazo de entrega","usar copy de diretório como proposta principal"],
      qa:["a primeira dobra comunica ação de pedir","existe jornada de pedido perceptível","mobile mantém ação principal alcançável","a arquitetura parece delivery antes de ler o texto"]
    };
  }
  return{type:clean(template,80)||"landing",hardRequirement:false,job:"Cumprir a intenção selecionada pelo usuário.",requiredExperiences:[],forbidden:["substituir silenciosamente o tipo de produto solicitado"],qa:["a arquitetura corresponde ao tipo de produto solicitado"]};
}
export function productContractPrompt(contract={}){return "CONTRATO FUNCIONAL OBRIGATÓRIO: "+JSON.stringify(contract)}
