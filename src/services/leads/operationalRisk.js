import { leadInactivity } from "./pipelineIntelligence.js";
export function operationalRisk(lead,workspace={},now=new Date()){
  const health=leadInactivity(lead,workspace,now);
  const closed=["ganho","perdido"].includes(String(lead?.stage||""));
  if(closed)return{bucket:"closed",onRadar:false,priority:0,reason:"closed",...health};
  const nextAction=String(lead?.nextAction||"").trim();
  const futureFollowUp=String(lead?.followUpAt||"")>now.toISOString().slice(0,10);
  if(!nextAction&&!futureFollowUp)return{bucket:"no_next_action",onRadar:true,priority:100,reason:"no_next_action",...health};
  if(futureFollowUp&&!health.overdueFollowUp)return{bucket:"in_flight",onRadar:health.reason==="stage_stuck",priority:health.reason==="stage_stuck"?70:20,reason:health.reason==="stage_stuck"?"stage_stuck":"scheduled",...health};
  if(!health.stale)return{bucket:"healthy",onRadar:false,priority:10,reason:"fresh",...health};
  const critical=health.stageDays!=null&&health.threshold!=null&&health.stageDays>=health.threshold*3;
  return{bucket:critical?"critical":"at_risk",onRadar:true,priority:critical?95:80,reason:health.reason,...health};
}
export function sortOperationalRisk(items=[]){return [...items].sort((a,b)=>Number(b?.operationalRisk?.priority||0)-Number(a?.operationalRisk?.priority||0));}
