import {prisma} from "../../lib/prisma.js";
import {socialMetaConfig,socialGraph} from "./engagement.js";
const iso=d=>d.toISOString().slice(0,10);
const number=v=>typeof v==="number"&&Number.isFinite(v)?v:null;
const sum=(values)=>values.some(v=>v!==null)?values.reduce((a,v)=>a+(v??0),0):null;
async function safe(query,errors,label){try{return await query()}catch(e){errors.push(label+": "+String(e.message||e).slice(0,150));return null}}
async function instagramMetrics(cfg,id,errors){
 const base=await safe(()=>socialGraph(cfg,id,{fields:"id,like_count,comments_count,media_type,permalink"},"GET"),errors,"Instagram "+id+" (informações)");
 const insights=await safe(()=>socialGraph(cfg,id+"/insights",{metric:"reach,saved,shares,total_interactions"},"GET"),errors,"Instagram "+id+" (insights)");
 const metrics=Object.fromEntries((insights?.data||[]).map(x=>[x.name,number(x.values?.[0]?.value??x.total_value?.value)]));
 return {likes:number(base?.like_count),comments:number(base?.comments_count),reach:metrics.reach??null,saves:metrics.saved??null,shares:metrics.shares??null,interactions:metrics.total_interactions??null,permalink:base?.permalink||null,available:!!base||!!insights};
}
async function facebookMetrics(cfg,id,errors){
 const result=await safe(()=>socialGraph(cfg,id,{fields:"id,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares,permalink_url"},"GET"),errors,"Facebook "+id+" (engajamento)");
 const views=await safe(()=>socialGraph(cfg,id+"/insights",{metric:"post_media_view"},"GET"),errors,"Facebook "+id+" (visualizações)");
 const v=views?.data?.find(x=>x.name==="post_media_view")?.values?.[0]?.value;
 return {likes:number(result?.reactions?.summary?.total_count),comments:number(result?.comments?.summary?.total_count),shares:number(result?.shares?.count),views:number(v),permalink:result?.permalink_url||null,available:!!result||!!views};
}
export async function socialWeeklyReport({startDate}={}){
 const start=startDate?new Date(startDate+"T00:00:00"):new Date();
 if(!Number.isFinite(start.getTime()))throw Error("Data inválida");
 if(!startDate){const day=start.getDay();start.setDate(start.getDate()-((day+6)%7));start.setHours(0,0,0,0)}
 const end=new Date(start);end.setDate(start.getDate()+7);
 const now=new Date();if(start>now)throw Error("A semana ainda não começou.");
 const posts=await prisma.socialPost.findMany({where:{scheduledAt:{gte:start,lt:end}},orderBy:{scheduledAt:"asc"},take:100});
 const errors=[];let cfg=null;try{cfg=socialMetaConfig()}catch(e){errors.push(String(e.message||e))}
 const rows=[];
 for(const post of posts){
  for(const platform of ["instagram","facebook"]){
   const postId=post[platform==="instagram"?"instagramPostId":"facebookPostId"];
   if(!postId)continue;
   const metrics=cfg?platform==="instagram"?await instagramMetrics(cfg,postId,errors):await facebookMetrics(cfg,postId,errors):{available:false};
   rows.push({id:post.id,postId,title:post.title,platform,scheduledAt:post.scheduledAt?.toISOString(),status:post.status,...metrics});
  }
 }
 const observed=await prisma.outreachObservation.count({where:{channel:{in:["capture","recovery"]},replyAt:{gte:start,lt:end},status:"replied"}});
 const commercial=await prisma.commercialOutcome.findMany({where:{updatedAt:{gte:start,lt:end}},select:{channel:true,stage:true,meetingAt:true,contractAmount:true}});
 const totals={publishedPosts:posts.filter(p=>p.status==="published").length,plannedPosts:posts.filter(p=>p.status==="draft").length,scheduledPosts:posts.filter(p=>p.status==="scheduled").length,likes:sum(rows.map(x=>x.likes??null)),comments:sum(rows.map(x=>x.comments??null)),shares:sum(rows.map(x=>x.shares??null)),instagramReach:sum(rows.filter(x=>x.platform==="instagram").map(x=>x.reach??null)),instagramSaves:sum(rows.filter(x=>x.platform==="instagram").map(x=>x.saves??null)),facebookViews:sum(rows.filter(x=>x.platform==="facebook").map(x=>x.views??null)),conversationsObserved:observed,commercialRecordsUpdated:commercial.length,meetingsRecorded:commercial.filter(x=>x.meetingAt&&x.meetingAt>=start&&x.meetingAt<end).length,contractsRecorded:commercial.filter(x=>x.contractAmount>0&&["won","ganho","closed_won"].includes(x.stage)).length};
 return {start:iso(start),endExclusive:iso(end),totals,rows,errors,notes:["Alcance do Instagram não é somado às visualizações do Facebook: são métricas diferentes.","Os indicadores comerciais abrangem os canais registrados no LeadFlow; ainda não existe atribuição comprovada entre um post e uma venda.","Campos sem acesso ou dados são nulos, nunca zero estimado."],generatedAt:new Date().toISOString()};
}
