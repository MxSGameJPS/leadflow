import {NextResponse} from "next/server";
import {previewCaptureCampaign,commitCaptureCampaign,capturePreparationStatus} from "../../../../../services/capture/campaignPreparation.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function fail(message,status=400){return NextResponse.json({error:message},{status})}
export async function GET(request){
 if(process.env.NODE_ENV==="production")return fail("Disponível somente no ambiente local.",403);
 try{
  const sessionId=process.env.OPENWA_SESSION_ID?.trim();
  if(new URL(request.url).searchParams.get("status")==="1")
   return NextResponse.json(await capturePreparationStatus({sessionId}));
  return NextResponse.json(await previewCaptureCampaign({sessionId}));
 }
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
