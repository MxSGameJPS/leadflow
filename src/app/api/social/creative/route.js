import {NextResponse} from "next/server";
import {generateSocialCreative} from "../../../../services/social/creativeGenerator.js";
export const runtime="nodejs";
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Geração disponível apenas no LeadFlow local."},{status:403});
 try{
  const {topic,format,goal}=await request.json();
  const result=await generateSocialCreative({topic,format,goal});
  return NextResponse.json(result);
 }catch(error){return NextResponse.json({error:String(error.message||error).slice(0,350)},{status:400})}
}
