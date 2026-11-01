import {NextResponse} from "next/server";
import {socialWeeklyReport} from "../../../../services/social/weeklyReport.js";
import {generateResilientWithDefaultProvider} from "../../../../services/ai/providerService.js";
import {prisma} from "../../../../lib/prisma.js";
import {generateAndStoreSocialWeeklyAnalysis} from "../../../../services/social/weeklyAutomation.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Disponível apenas no LeadFlow local."},{status:403});
 try{
  const week=new URL(request.url).searchParams.get("week")||undefined;
  if(week&&!/^\d{4}-\d{2}-\d{2}$/.test(week))return NextResponse.json({error:"Data inválida."},{status:400});
  const saved=week?await prisma.socialWeeklyAnalysis.findUnique({where:{weekStart:week}}):null;
  const report=saved?JSON.parse(saved.reportJson):await socialWeeklyReport({startDate:week});
  const history=await prisma.socialWeeklyAnalysis.findMany({where:{status:"ready"},orderBy:{weekStart:"desc"},take:20,select:{weekStart:true,updatedAt:true}});
  return NextResponse.json({...report,analysis:saved?.analysis||"",savedAt:saved?.updatedAt?.toISOString()||null,history:history.map(h=>({week:h.weekStart,savedAt:h.updatedAt.toISOString()}))});
 }catch(e){return NextResponse.json({error:String(e.message||e).slice(0,300)},{status:502})}
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Disponível apenas no LeadFlow local."},{status:403});
 try{
  const input=await request.json(),report=await socialWeeklyReport({startDate:input.week});
  const current=new Date(),monday=new Date(current.getFullYear(),current.getMonth(),current.getDate()-((current.getDay()+6)%7));
  if(new Date(report.start+"T00:00:00")<monday){await generateAndStoreSocialWeeklyAnalysis({weekStart:report.start,force:true});const saved=await prisma.socialWeeklyAnalysis.findUnique({where:{weekStart:report.start}});return NextResponse.json({...report,analysis:saved.analysis,savedAt:saved.updatedAt.toISOString()});}
  const response=await generateResilientWithDefaultProvider({
   systemPrompt:"Você é analista de marketing digital de uma operação de serviços de desenvolvimento de sites e sistemas. Produza uma análise semanal curta, em português brasileiro: (1) o que os dados sustentam; (2) limites e lacunas; (3) até 5 ações específicas para a próxima semana com gancho, público e CTA; (4) hipótese mensurável para testar. Nunca invente resultados, tendências, percentuais ou atribua clientes/conversões a posts sem evidência. Métricas ausentes (null) significam não disponíveis, não zero. Não compare alcance IG com visualizações FB como se fossem iguais. Não proponha spam, seguidores falsos ou promessas de alcance. Responda apenas texto, sem JSON.",
   prompt:JSON.stringify({period:{start:report.start,endExclusive:report.endExclusive},totals:report.totals,posts:report.rows.map(({title,platform,likes,comments,shares,saves,reach,views,interactions})=>({title,platform,likes,comments,shares,saves,reach,views,interactions})),errors:report.errors,notes:report.notes}),disableTools:true,timeoutMs:60000,retries:1,maxTokens:1100
  });
  return NextResponse.json({...report,analysis:String(response.text||"").trim().slice(0,6500)});
 }catch(e){return NextResponse.json({error:String(e.message||e).slice(0,300)},{status:502})}
}
