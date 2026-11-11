import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {captureRunning,setCaptureRunning,captureCampaignActive,blackFridayWindow,setCaptureCampaignActive} from "../../../../services/capture/dispatchControl.js";
import {recoveryRunning,setRecoveryRunning} from "../../../../services/recovery/dispatchControl.js";
import {getWorkWindow} from "../../../../services/recovery/workSchedule.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function reject(){return NextResponse.json({error:"Controle disponível apenas no ambiente local."},{status:403})}
async function snapshot(){
 const sessionId=process.env.OPENWA_SESSION_ID?.trim();
 const [approved,sent,uncertain]=sessionId?await Promise.all([
  prisma.captureApproval.count({where:{sessionId,status:"approved"}}),
  prisma.captureApproval.count({where:{sessionId,status:"sent"}}),
  prisma.captureApproval.count({where:{sessionId,status:{in:["sending","uncertain"]}}})
 ]):[0,0,0];
 const [followupApproved,followupSent,followupUncertain]=sessionId?await Promise.all([
  prisma.captureFollowup.count({where:{sessionId,status:"approved"}}),
  prisma.captureFollowup.count({where:{sessionId,status:"sent"}}),
  prisma.captureFollowup.count({where:{sessionId,status:{in:["sending","uncertain"]}}})
 ]):[0,0,0];
 const [campaignApproved,campaignSent]=sessionId?await Promise.all([prisma.captureApproval.count({where:{sessionId,status:"approved",approachVariant:{in:["black_friday","auto_black_friday"]}}}),prisma.captureApproval.count({where:{sessionId,status:"sent",approachVariant:{in:["black_friday","auto_black_friday"]}}})]):[0,0];
 const [recoverySending,captureSending]=sessionId?await Promise.all([prisma.recoveryDispatch.count({where:{sessionId,status:"sending"}}),prisma.captureApproval.count({where:{sessionId,status:"sending"}})]):[0,0];
 return {campaign:{active:captureCampaignActive(),available:blackFridayWindow(),price:500},campaignApproved,campaignSent,running:captureRunning(),recoveryRunning:recoveryRunning(),sundayBlocked:getWorkWindow().sundayBlocked,working:getWorkWindow().working,approved,sent,uncertain,followupApproved,followupSent,followupUncertain,recoveryBlock:recoverySending,blocked:recoverySending>0||captureSending>0||followupUncertain>0,sessionConfigured:!!sessionId};
}
export async function GET(){
 if(process.env.NODE_ENV==="production")return reject();
 try{return NextResponse.json(await snapshot())}catch(e){return NextResponse.json({error:e.message},{status:500})}
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return reject();
 try{
  const {action,confirmation}=await request.json();
  if(!["start","pause","start_recovery","pause_recovery","campaign_start","campaign_pause"].includes(action))return NextResponse.json({error:"Ação inválida."},{status:400});
  if(action==="campaign_start"&&confirmation!=="ATIVAR BLACK FRIDAY")return NextResponse.json({error:"Confirmação de campanha inválida."},{status:400});
  if(action==="start_recovery"&&confirmation!=="INICIAR RECUPERAÇÃO")return NextResponse.json({error:"Confirmação de início da Recuperação inválida."},{status:400});
  if(action==="start"&&confirmation!=="INICIAR CAPTAÇÃO")return NextResponse.json({error:"Confirmação de início inválida."},{status:400});
  if(["start","start_recovery"].includes(action)&&(!process.env.OPENWA_SESSION_ID||!process.env.OPENWA_URL||!process.env.OPENWA_API_KEY))
   return NextResponse.json({error:"Configure OPENWA_URL, OPENWA_API_KEY e OPENWA_SESSION_ID."},{status:400});
  if(action==="campaign_start"||action==="campaign_pause")setCaptureCampaignActive(action==="campaign_start");
  else if(action==="start_recovery"||action==="pause_recovery")setRecoveryRunning(action==="start_recovery");
  else setCaptureRunning(action==="start");
  return NextResponse.json(await snapshot());
 }catch(e){return NextResponse.json({error:e.message},{status:500})}
}
