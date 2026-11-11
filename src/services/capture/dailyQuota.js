// Captação: primeiros contatos e follow-ups compartilham a mesma cota.
// Reservar o espaço de mensagens incertas evita ultrapassar o teto diário.
export const CAPTURE_DAILY_LIMIT=20;
export function captureCanDispatch(used){
 return Number.isInteger(used)&&used>=0&&used<CAPTURE_DAILY_LIMIT;
}
export async function getCaptureDailyUsage(db,sessionId,now=new Date()){
 if(!sessionId)return {limit:CAPTURE_DAILY_LIMIT,used:0,confirmed:0,remaining:CAPTURE_DAILY_LIMIT};
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
 const dayKey=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
 const [firstConfirmed,firstInFlight,followupConfirmed,followupInFlight]=await Promise.all([
  db.captureApproval.count({where:{sessionId,status:"sent",sentAt:{gte:start,lt:end}}}),
  db.captureApproval.count({where:{sessionId,status:{in:["sending","uncertain"]},updatedAt:{gte:start,lt:end}}}),
  db.captureFollowup.count({where:{sessionId,dayKey,status:"sent"}}),
  db.captureFollowup.count({where:{sessionId,dayKey,status:{in:["sending","uncertain"]}}})
 ]);
 const confirmed=firstConfirmed+followupConfirmed;
 const used=confirmed+firstInFlight+followupInFlight;
 return {limit:CAPTURE_DAILY_LIMIT,used,confirmed,remaining:Math.max(0,CAPTURE_DAILY_LIMIT-used)};
}
