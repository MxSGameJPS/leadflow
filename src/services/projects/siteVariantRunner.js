export async function runSiteVariants({comparisonId,create,save}){
  const names=['leadflow','testelead'];
  const results=await Promise.allSettled(names.map(name=>create(name)));
  const failures=results.flatMap((result,index)=>result.status==='rejected'?[{variant:names[index],error:String(result.reason?.message||'Falha na geração').slice(0,500)}]:[]);
  if(failures.length===2)throw new Error('As duas propostas falharam. '+failures.map(item=>item.variant+': '+item.error).join(' | '));
  const warning=failures.length?'Uma proposta foi preservada; a outra não conseguiu concluir a geração.':'';
  const variants=await Promise.all(results.flatMap((result,index)=>result.status==='fulfilled'?[save(result.value,{comparisonId,comparisonVariant:names[index],comparisonWinner:false,...(warning?{warning:[result.value.warning,warning].filter(Boolean).join(' ')}:{})})]:[]));
  return {leadflow:variants.find(item=>item.comparisonVariant==='leadflow')||null,testelead:variants.find(item=>item.comparisonVariant==='testelead')||null,variants,comparisonId,warning,failures};
}
