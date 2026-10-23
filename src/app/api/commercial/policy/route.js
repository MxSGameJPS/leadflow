import { NextResponse } from "next/server";
import { getCommercialPolicy, saveCommercialPolicy } from "../../../../services/commercial/policyStore.js";
import { createCommercialInstructions } from "../../../../services/commercial/policy.js";
export const runtime="nodejs";
export async function GET(){
 const policy=await getCommercialPolicy();
 return NextResponse.json({policy,instructions:createCommercialInstructions(policy)});
}
export async function PUT(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Edição disponível somente na instalação local de desenvolvimento."},{status:403});
 try{
  const policy=await saveCommercialPolicy(await request.json());
  return NextResponse.json({policy});
 }catch(error){return NextResponse.json({error:error.message},{status:400})}
}
