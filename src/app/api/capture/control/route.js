import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {captureRunning,setCaptureRunning} from "../../../../services/capture/dispatchControl.js";
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
 const recoveryBlock=sessionId?await prisma.recoveryDispatch.count({where:{sessionId,status:{in:["uncertain","sending"]}}}):0;
 return {running:captureRunning(),approved,sent,uncertain,recoveryBlock,blocked:uncertain>0||recoveryBlock>0,sessionConfigured:!!sessionId};
}
export async function GET(){
 if(process.env.NODE_ENV==="production")return reject();
 try{return NextResponse.json(await snapshot())}catch(e){return NextResponse.json({error:e.message},{status:500})}
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return reject();
 try{
  const {action,confirmation}=await request.json();
  if(!["start","pause"].includes(action))return NextResponse.json({error:"Ação inválida."},{status:400});
  if(action==="start"&&confirmation!=="INICIAR CAPTAÇÃO")return NextResponse.json({error:"Confirmação de início inválida."},{status:400});
  if(action==="start"&&(!process.env.OPENWA_SESSION_ID||!process.env.OPENWA_URL||!process.env.OPENWA_API_KEY))
   return NextResponse.json({error:"Configure OPENWA_URL, OPENWA_API_KEY e OPENWA_SESSION_ID."},{status:400});
  setCaptureRunning(action==="start");
  return NextResponse.json(await snapshot());
 }catch(e){return NextResponse.json({error:e.message},{status:500})}
}
