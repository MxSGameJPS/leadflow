const OPS=new Set(["eq","neq","contains","gte","lte","exists"]);
function get(obj,path){return String(path||"").split(".").filter(Boolean).reduce((value,key)=>value&&typeof value==="object"?value[key]:undefined,obj)}
function matches(condition,context){
  const op=OPS.has(condition?.op)?condition.op:"eq",raw=get(context,condition?.field),expected=condition?.value;
  if(op==="exists")return condition?.value===false?raw==null||raw==="":raw!=null&&raw!=="";
  if(raw==null)return op==="neq";
  if(op==="contains"){const needle=String(expected??"").toLowerCase();return Array.isArray(raw)?raw.some(item=>String(item).toLowerCase()===needle):String(raw).toLowerCase().includes(needle)}
  if(op==="gte"||op==="lte"){const left=Number(raw),right=Number(expected);if(!Number.isFinite(left)||!Number.isFinite(right))return false;return op==="gte"?left>=right:left<=right}
  const equal=String(raw)===String(expected??"");return op==="eq"?equal:!equal;
}
export function evaluateAutomationConditions(conditions=[],context={}){return (Array.isArray(conditions)?conditions:[]).every(condition=>matches(condition,context))}
export function automationEvent(type,payload={},metadata={}){return{id:String(metadata.id||("evt_"+Date.now()+"_"+Math.random().toString(36).slice(2,8))),type:String(type||""),payload,metadata:{...metadata},createdAt:new Date().toISOString()}}
export async function runAutomationRules({event,rules=[],context={},actions={}}={}){
  if(!event?.type)return[];
  if(event.metadata?.causedByRule)return[{status:"skipped",reason:"caused_by_rule"}];
  const runs=[];
  for(const rule of rules){
    if(!rule?.active||rule.trigger!==event.type||!evaluateAutomationConditions(rule.conditions,context))continue;
    const results=[];
    for(const action of Array.isArray(rule.actions)?rule.actions:[]){
      const execute=actions[action?.type];
      if(typeof execute!=="function"){results.push({type:action?.type||"unknown",status:"failed",error:"unknown_action"});continue}
      try{results.push({type:action.type,status:"success",detail:await execute({event,context,config:action.config||{},rule,metadata:{causedByRule:rule.id}})})}
      catch(error){results.push({type:action.type,status:"failed",error:error instanceof Error?error.message:String(error)})}
    }
    runs.push({ruleId:rule.id,name:rule.name||rule.id,status:results.some(r=>r.status==="failed")?"partial":"success",results});
  }
  return runs;
}
export const AUTOMATION_TRIGGERS=Object.freeze(["lead.created","lead.stage_changed","lead.stale","lead.follow_up_overdue","lead.no_next_action","lead.evidence_verified"]);
