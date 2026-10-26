export const RECOVERY_TZ="America/Sao_Paulo";
export const WORK_START=8*60;
export const WORK_END=18*60;
export const REST_MS=30*60*1000;
function parts(now){
 const fields=new Intl.DateTimeFormat("en-US",{timeZone:RECOVERY_TZ,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
 const value=Object.fromEntries(fields.map(p=>[p.type,p.value]));
 return {day:`${value.year}-${value.month}-${value.day}`,minute:Number(value.hour)%24*60+Number(value.minute)};
}
export function getWorkWindow(now=new Date()){
 const local=parts(now),working=local.minute>=WORK_START&&local.minute<WORK_END;
 return {working,day:local.day,minuteOfDay:local.minute,timeZone:RECOVERY_TZ,start:"08:00",end:"18:00"};
}
export function getRecoveryRest({now=new Date(),lastSentAt=null,lastReplyAt=null}={}){
 const window=getWorkWindow(now);
 const sent=lastSentAt?new Date(lastSentAt):null;
 if(!sent||!Number.isFinite(sent.getTime()))return {...window,resting:false,restUntil:null,reason:window.working?"ready":"outside_hours"};
 const reply=lastReplyAt?new Date(lastReplyAt):null;
 const responded=reply&&Number.isFinite(reply.getTime())&&reply.getTime()>sent.getTime()&&reply.getTime()<=now.getTime();
 const until=new Date(sent.getTime()+REST_MS);
 const resting=!responded&&now.getTime()<until.getTime();
 return {...window,resting,restUntil:resting?until:null,reason:!window.working?"outside_hours":resting?"resting":responded?"reply_woke_agent":"ready"};
}
