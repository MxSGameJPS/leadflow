import {NextResponse} from "next/server";
import {prisma} from "../../../../../lib/prisma.js";
import {generateResilientWithDefaultProvider} from "../../../../../services/ai/providerService.js";
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Indisponível."},{status:403});
 const {chatId}=await request.json();
 const sessionId=process.env.OPENWA_SESSION_ID;
 const item=await prisma.recoverySecondAttempt.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
 if(item?.status!=="review")return NextResponse.json({error:"Revisão necessária."},{status:409});
 const original=await prisma.recoveryDispatch.findUnique({where:{sessionId_chatId:{sessionId,chatId}}});
 const ai=await generateResilientWithDefaultProvider({systemPrompt:"Escreva um rascunho curto e respeitoso de acompanhamento comercial em português. Não invente fatos nem pressione. Apenas o texto.",prompt:String(original?.messageSnapshot||"").slice(0,900),disableTools:true,timeoutMs:45000,retries:1});
 return NextResponse.json({message:String(ai.text||"").trim().slice(0,900)});
}
