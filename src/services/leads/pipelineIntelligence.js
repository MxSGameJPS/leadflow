const DAY_MS=86_400_000;
export const PIPELINE_STAGES=[
  {id:"novo",label:"Novo",probability:5,staleDays:7,closed:false},
  {id:"contatado",label:"Contatado",probability:15,staleDays:4,closed:false},
  {id:"sem_resposta",label:"Sem resposta",probability:8,staleDays:5,closed:false},
  {id:"com_resposta",label:"Com resposta",probability:35,staleDays:4,closed:false},
  {id:"proposta",label:"Proposta",probability:55,staleDays:4,closed:false},
  {id:"proposta_rejeitada",label:"Proposta rejeitada",probability:18,staleDays:3,closed:false},
  {id:"negociacao",label:"Negociação",probability:75,staleDays:3,closed:false},
  {id:"ganho",label:"Ganho",probability:100,staleDays:null,closed:true},
  {id:"perdido",label:"Perdido",probability:0,staleDays:null,closed:true},
];
const BY_ID=new Map(PIPELINE_STAGES.map(stage=>[stage.id,stage]));
function validDate(value){const date=value?new Date(value):null;return date&&!Number.isNaN(date.getTime())?date:null}
export function pipelineStage(stageId){return BY_ID.get(String(stageId||""))||BY_ID.get("novo")}
export function weightedPipelineValue(lead){
  const stage=pipelineStage(lead?.stage);
  if(stage.closed)return stage.id==="ganho"?Number(lead?.proposalValue||0):0;
  return Math.round(Number(lead?.proposalValue||0)*(stage.probability/100));
}
export function daysInCurrentStage(lead,workspace={},now=new Date()){
  const entered=validDate(workspace?.stageEnteredAt)||validDate(lead?.updatedAt)||validDate(lead?.createdAt);
  if(!entered)return null;
  return Math.max(0,Math.floor((now.getTime()-entered.getTime())/DAY_MS));
}
export function leadInactivity(lead,workspace={},now=new Date()){
  const stage=pipelineStage(lead?.stage);
  if(stage.closed)return{stale:false,days:0,threshold:null,reason:"closed"};
  const last=validDate(workspace?.lastContactAt)||validDate(lead?.updatedAt)||validDate(lead?.createdAt);
  if(!last)return{stale:false,days:null,threshold:stage.staleDays,reason:"unknown"};
  const days=Math.max(0,Math.floor((now.getTime()-last.getTime())/DAY_MS));
  const stageDays=daysInCurrentStage(lead,workspace,now);
  const followUp=String(lead?.followUpAt||"");
  const today=now.toISOString().slice(0,10);
  const overdue=Boolean(followUp&&followUp<=today);
  const stuck=stageDays!=null&&stageDays>=stage.staleDays;
  return{stale:overdue||days>=stage.staleDays||stuck,days,stageDays,threshold:stage.staleDays,overdueFollowUp:overdue,reason:overdue?"follow_up_overdue":stuck?"stage_stuck":days>=stage.staleDays?"inactive":"fresh"};
}
export function pipelineForecast(leads=[],workspaceByLead={}){
  const summary={openValue:0,weightedValue:0,wonValue:0,staleCount:0,byStage:{}};
  for(const lead of leads){
    const stage=pipelineStage(lead?.stage),value=Number(lead?.proposalValue||0),weighted=weightedPipelineValue(lead);
    if(stage.id==="ganho")summary.wonValue+=value;
    else if(!stage.closed)summary.openValue+=value;
    if(!stage.closed)summary.weightedValue+=weighted;
    const inactivity=leadInactivity(lead,workspaceByLead?.[lead?.id]||{});
    if(inactivity.stale)summary.staleCount++;
    const current=summary.byStage[stage.id]||{count:0,value:0,weightedValue:0,probability:stage.probability,staleCount:0};
    current.count++;current.value+=value;current.weightedValue+=weighted;if(inactivity.stale)current.staleCount++;
    summary.byStage[stage.id]=current;
  }
  return summary;
}
