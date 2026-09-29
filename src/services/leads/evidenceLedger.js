const WEIGHTS=Object.freeze({
  "business.official":{weight:.95,primary:true},
  "crm.direct_reply":{weight:.9,primary:true},
  "crm.call_or_meeting":{weight:.85,primary:true},
  "maps.profile":{weight:.8,primary:true},
  "social.official_profile":{weight:.75,primary:true},
  "website.cited_claim":{weight:.55,primary:false},
  "directory.cited_claim":{weight:.4,primary:false},
  "ai.inference":{weight:.15,primary:false},
  contradiction:{weight:0,primary:false},
});
const FLOOR=Object.freeze({verified:.85,probable:.55,possible:.3});
export const EVIDENCE_KINDS=Object.freeze(Object.keys(WEIGHTS));
export function scoreEvidence(evidence=[]){
  const rows=(Array.isArray(evidence)?evidence:[]).filter(item=>WEIGHTS[item?.kind]);
  if(!rows.length)return{score:0,band:null,hasPrimary:false,contradicted:false};
  const contradicted=rows.some(item=>item.kind==="contradiction");
  const hasPrimary=rows.some(item=>WEIGHTS[item.kind].primary);
  let score=1-rows.reduce((remaining,item)=>remaining*(1-WEIGHTS[item.kind].weight),1);
  score=Math.min(.99,Math.max(0,score));
  if(contradicted)score=Math.min(score,.45);
  const band=score>=FLOOR.verified&&hasPrimary?"verified":score>=FLOOR.probable?"probable":score>=FLOOR.possible?"possible":null;
  return{score:Number(score.toFixed(4)),band,hasPrimary,contradicted};
}
export function evidenceDecision(evidence=[]){
  const scored=scoreEvidence(evidence);
  return{...scored,action:scored.band==="verified"?"apply":scored.band?"suggest":"discard"};
}
export function normalizeEvidenceClaim(input={}){
  const evidence=(Array.isArray(input.evidence)?input.evidence:[]).slice(0,12).map(item=>({
    kind:EVIDENCE_KINDS.includes(item?.kind)?item.kind:"ai.inference",
    detail:String(item?.detail||"").trim().slice(0,1200),
    sourceUrl:String(item?.sourceUrl||"").trim().slice(0,1200),
    observedAt:validTimestamp(item?.observedAt)||new Date().toISOString(),
  })).filter(item=>item.detail);
  const decision=evidenceDecision(evidence);
  return{
    id:String(input.id||("claim_"+Date.now()+"_"+Math.random().toString(36).slice(2,8))).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,100),
    field:String(input.field||"").trim().slice(0,120),
    value:String(input.value||"").trim().slice(0,4000),
    status:["applied","suggested","dismissed","superseded"].includes(input.status)?input.status:(decision.action==="apply"?"applied":"suggested"),
    method:String(input.method||"").trim().slice(0,180),
    score:decision.score,
    band:decision.band,
    evidence,
    observedAt:validTimestamp(input.observedAt)||new Date().toISOString(),
    decidedAt:validTimestamp(input.decidedAt),
  };
}
function validTimestamp(value){const d=new Date(String(value||""));return Number.isNaN(d.getTime())?"":d.toISOString();}
