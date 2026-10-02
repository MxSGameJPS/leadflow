export const MAX_BUILDER_CALLS = 7;
export function createGenerationBudget(limit=MAX_BUILDER_CALLS) {
  const calls=[];
  return {calls,limit,get remaining(){return limit-calls.length},
    async run(stage, request, generate) {
      if(calls.length>=limit)throw Object.assign(new Error("Limite de chamadas desta geração atingido; revisão pendente."),{code:"AI_BUDGET"});
      const call={stage,startedAt:new Date().toISOString(),status:"running"};calls.push(call);
      const started=Date.now();
      try{const result=await generate({...request,retries:0,fallbackModels:[],isolatedRouting:true});call.status="success";return result}
      catch(error){call.status="error";throw error}
      finally{call.elapsedMs=Date.now()-started}
    }};
}
export function safeGeneratedPath(value) {
  const name=String(value||"").replace(/\\/g,"/");
  if(!name || name.startsWith("/") || name.includes("..") || !/^[\w./-]+$/.test(name))return "";
  if(!/^(app|components|data|lib)\//.test(name)||! /\.(jsx?|css|json)$/.test(name))return "";
  return name;
}
export function normalizeProductPlan(raw) {
  const tasks=raw?.tasks;
  if(!Array.isArray(tasks)||tasks.length<2||tasks.length>4)throw new Error("O diretor deve entregar 2–4 blocos completos, preferencialmente 3, sem microtarefas.");
  const owners=new Set(),ids=new Set();
  const normalized=tasks.map((t,i)=>{
    const id=String(t.id||`block-${i+1}`).slice(0,50);
    if(ids.has(id))throw new Error("IDs duplicados no plano.");ids.add(id);
    const requestedFiles=[...new Set((t.targetFiles||[]).map(safeGeneratedPath))];
    if(requestedFiles.some(p=>!p||p==='data/siteData.js'))throw new Error("Plano contém arquivo inválido ou reservado.");
    // The director may assign composition to a block. Keep its goal but route
    // application shell files to the dedicated integrator without another AI call.
    const targetFiles=requestedFiles.filter(p=>!/^app\/(page|layout|globals)\./.test(p));
    if(!targetFiles.length)throw new Error("Bloco sem arquivos de implementação próprios.");
    for(const file of targetFiles){if(owners.has(file))throw new Error("Arquivos compartilhados entre workers sem dono único.");owners.add(file)}
    return {...t,id,title:String(t.title||id).slice(0,150),goal:String(t.goal||'').slice(0,6000),targetFiles,dependsOn:Array.isArray(t.dependsOn)?t.dependsOn:[]};
  });
  // Preserve explicit dependencies, reject cycles instead of silently breaking imports.
  const sorted=[];
  while(sorted.length<normalized.length){const next=normalized.find(t=>!sorted.includes(t)&&t.dependsOn.every(id=>sorted.some(x=>x.id===id)));if(!next)throw new Error("Dependência desconhecida ou circular no plano.");sorted.push(next)}
  return {concept:String(raw.concept||''),productVision:String(raw.productVision||''),visualDirection:raw.visualDirection||{},sharedInterfaces:raw.sharedInterfaces||{},tasks:sorted};
}
export const DESIGN_BRIEF = `Projete para ESTE negócio. Escolha uma tese visual, uma assinatura memorável e uma hierarquia clara. Defina uma paleta coerente de 4–6 cores, tipografia de display e corpo, escala de espaçamento, raios e comportamento de movimento reduzido. Use as imagens reais fornecidas com intenção editorial, sem repetir a mesma foto em todos os produtos. Nenhuma estética é padrão: serif, sans, fundos claros ou escuros, gradientes e bordas são escolhas justificadas pela marca. Não confunda premium com gamer, brutalismo, títulos enormes em caixa alta, neon, faixas numeradas ou placares. Esses recursos só cabem quando evidências do lead ou pedido explícito sustentarem. Escolha a direção pelo caráter da marca. A primeira tela deve oferecer uma ação clara para iniciar a jornada, além do acesso ao carrinho. Evite fotos verticais que estiquem a abertura; dimensione a mídia sem depender da altura intrínseca. Associe fotos a produtos apenas quando o conteúdo observado corresponder; não adivinhe o conteúdo de assets que não foram vistos. pouco texto genérico. Estados, navegação e fluxos recebem tanto cuidado quanto a primeira dobra. Mobile 320px sem esconder overflow para mascarar defeitos; foco visível, alvos de toque 44px, textos legíveis e contraste. Não use next/font nem dependa de baixar fontes no build; prefira CSS font-family robusto. Não crie tarefas de SEO, documentação ou checklist: incorpore esses cuidados ao código.`;
