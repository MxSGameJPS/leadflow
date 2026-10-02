export function selectionFromPreviewMessage(event,frameWindow,origin,components=[]){
  if(event.source!==frameWindow||event.origin!==origin||event.data?.type!=='leadflow:component-selected')return null;
  const name=event.data.component;
  return name===''||components.some(item=>item.name===name)?name:null;
}
export function qualityPresentation(quality={}){
  const functional=quality.metrics?.functional;
  return {
    status:quality.pass?'Aprovado':quality.hardFailure?'Correção necessária':'Revisão pendente',
    visual:quality.judgeUsed&&Number.isFinite(quality.score)?quality.score+'/100':'Avaliação visual pendente',
    functional:functional?.pass?'Jornada testada':functional?.available?'Jornada com falha':'Jornada ainda não testada',
    steps:Array.isArray(functional?.steps)?functional.steps.length:0,
    summary:functional?.summary||quality.skippedReason||quality.summary||'A avaliação ainda não foi concluída.',
  };
}
