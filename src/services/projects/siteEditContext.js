function clean(value,max=20000){return String(value??"").replace(/\u0000/g,"").trim().slice(0,max)}
function unique(values){return [...new Set((values||[]).filter(Boolean))]}
function lineCount(value){return String(value??"").replace(/\r\n/g,"\n").split("\n").length}
function broadInstruction(instruction){
  return /\b(refa(?:ça|ca)|recrie|reconstrua|redesenhe|reorganize|reestruture|troque\s+(?:todo|toda)|mude\s+(?:todo|toda)|layout\s+(?:inteiro|completo)|design\s+(?:inteiro|completo))\b/i.test(clean(instruction,5000));
}
function removalInstruction(instruction){
  return /\b(remova|remover|retire|retirar|delete|deletar|exclua|excluir|oculte|ocultar|substitua|substituir)\b/i.test(clean(instruction,5000));
}
function importsOf(jsx){
  return unique([...String(jsx||"").matchAll(/import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["'];?/g)].map(match=>match[1]));
}
function siteFieldsOf(jsx){
  return unique([...String(jsx||"").matchAll(/\bsite(?:\?\.)?\.([A-Za-z_$][A-Za-z0-9_$]*)/g)].map(match=>match[1])).sort();
}
function idsOf(jsx){
  return unique([...String(jsx||"").matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match=>match[1])).sort();
}
function styleRefsOf(jsx){
  return unique([...String(jsx||"").matchAll(/\bstyles\.([A-Za-z_$][A-Za-z0-9_$]*)/g)].map(match=>match[1])).sort();
}
function cssClassesOf(css){
  return unique([...String(css||"").matchAll(/(?:^|[\s,>+~])\.([A-Za-z_][A-Za-z0-9_-]*)/gm)].map(match=>match[1])).sort();
}
export function analyzeComponentContract(source={}){
  const jsx=String(source.jsx||""),css=String(source.css||"");
  return {
    jsxLines:lineCount(jsx),
    cssLines:lineCount(css),
    imports:importsOf(jsx),
    siteFields:siteFieldsOf(jsx),
    ids:idsOf(jsx),
    styleRefs:styleRefsOf(jsx),
    cssClasses:cssClassesOf(css),
    clientComponent:/^\s*["']use client["'];/.test(jsx),
    hasDefaultExport:/\bexport\s+default\b/.test(jsx),
  };
}
export function buildComponentEditContext(plan={},componentName="",source={}){
  const components=Array.isArray(plan?.components)?plan.components:[];
  const index=components.findIndex(item=>item?.name===componentName);
  const target=index>=0?components[index]:null;
  const previous=index>0?components[index-1]:null;
  const next=index>=0&&index<components.length-1?components[index+1]:null;
  const contract=analyzeComponentContract(source);
  return {
    target:target?{name:target.name,role:target.role,purpose:target.purpose,acceptanceCriteria:target.acceptanceCriteria,visualHook:target.visualHook}:null,
    position:index,
    totalComponents:components.length,
    previous:previous?{name:previous.name,role:previous.role,purpose:previous.purpose,visualHook:previous.visualHook}:null,
    next:next?{name:next.name,role:next.role,purpose:next.purpose,visualHook:next.visualHook}:null,
    pageSequence:components.map(item=>({name:item.name,role:item.role,purpose:item.purpose})),
    contract,
  };
}
export function patchBudgetFor(source={},instruction=""){
  const contract=analyzeComponentContract(source);
  const total=Math.max(1,contract.jsxLines+contract.cssLines);
  const broad=broadInstruction(instruction);
  const maxChangedLines=broad?Math.max(120,Math.ceil(total*1.25)):Math.max(36,Math.ceil(total*.45));
  return {broad,totalLines:total,maxChangedLines};
}
export function validatePatchPreservation(before={},after={},instruction="",patch={}){
  const errors=[];
  const beforeContract=analyzeComponentContract(before);
  const afterContract=analyzeComponentContract(after);
  const budget=patchBudgetFor(before,instruction);
  const changedLines=Number(patch?.changedLines||0);
  if(changedLines>budget.maxChangedLines){
    errors.push("Diff amplo demais para o pedido: "+changedLines+" linhas alteradas; limite cirúrgico "+budget.maxChangedLines+". Preserve mais do componente existente.");
  }
  if(beforeContract.clientComponent&&!afterContract.clientComponent&&!removalInstruction(instruction)){
    errors.push('O diff removeu a diretiva "use client" de um componente que já dependia dela.');
  }
  if(beforeContract.hasDefaultExport&&!afterContract.hasDefaultExport){
    errors.push("O diff removeu o export default existente.");
  }
  const removedImports=beforeContract.imports.filter(item=>!afterContract.imports.includes(item));
  if(removedImports.length&&!removalInstruction(instruction)){
    errors.push("O diff removeu imports existentes sem o pedido indicar remoção: "+removedImports.join(", "));
  }
  const orphanStyles=afterContract.styleRefs.filter(item=>!afterContract.cssClasses.includes(item));
  if(orphanStyles.length){
    errors.push("O JSX referencia classes ausentes no CSS Module: "+orphanStyles.slice(0,8).join(", "));
  }
  return {ok:errors.length===0,errors,budget,before:beforeContract,after:afterContract};
}
