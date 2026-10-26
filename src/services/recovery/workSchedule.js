// The LeadFlow worker runs on the Windows host. Node's local clock inherits
// the operating system time zone; do not fix Sao Paulo time here.
export const WORK_START=8*60;
export const WORK_END=18*60;
export const REST_MS=30*60*1000;
function localParts(now){
 const yyyy=now.getFullYear(),mm=String(now.getMonth()+1).padStart(2,"0"),dd=String(now.getDate()).padStart(2,"0");
 return {day:`${yyyy}-${mm}-${dd}`,minute:now.getHours()*60+now.getMinutes()};
}
export function getWorkWindow(now=new Date()){
 const local=localParts(now);
 return {working:local.minute>=WORK_START&&local.minute<WORK_END,day:local.day,minuteOfDay:local.minute,timeZone:"Windows local",start:"08:00",end:"18:00"};
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
