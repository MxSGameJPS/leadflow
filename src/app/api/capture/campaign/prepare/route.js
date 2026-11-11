import {NextResponse} from "next/server";
import {previewCaptureCampaign,commitCaptureCampaign} from "../../../../services/capture/campaignPreparation.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function fail(message,status=400){return NextResponse.json({error:message},{status})}
export async function GET(){
 if(process.env.NODE_ENV==="production")return fail("Disponível somente no ambiente local.",403);
 try{return NextResponse.json(await previewCaptureCampaign({sessionId:process.env.OPENWA_SESSION_ID?.trim()}))}
 catch(error){return fail(String(error.message||error).slice(0,260),500)}
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return fail("Disponível somente no ambiente local.",403);
 try{
  const data=await request.json();
  const result=await commitCaptureCampaign({sessionId:process.env.OPENWA_SESSION_ID?.trim(),items:data.items,confirmation:data.confirmation});
  return NextResponse.json(result);
 }catch(error){return fail(String(error.message||error).slice(0,260))}
}
