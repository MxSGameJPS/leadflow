import {NextResponse} from "next/server";
import {prisma} from "../../../../../lib/prisma.js";
import {validateSocialPost} from "../../../../../services/social/publisher.js";
import {ensurePublicMedia,r2Settings} from "../../../../../services/social/r2Storage.js";
export const runtime="nodejs";
const reject=(error,status=400)=>NextResponse.json({error},{status});
export async function PATCH(request,{params}){
 if(process.env.NODE_ENV==="production")return reject("Apenas ambiente local.",403);
 const {id}=await params;
 try{
 const input=await request.json(),post=await prisma.socialPost.findUnique({where:{id}});
 if(!post)return reject("Publicação não encontrada.",404);
 if(!["draft","scheduled","needs_review"].includes(post.status))return reject("Publicação em processamento ou encerrada; não pode ser alterada.",409);
 if(input.action==="prepare"){
  if(post.status!=="draft")return reject("Apenas rascunhos podem ser editados.",409);
  const media=Array.isArray(input.media)?input.media.map(x=>String(x).trim()).filter(Boolean):JSON.parse(post.mediaJson);
  const platforms=Array.isArray(input.platforms)?input.platforms.filter(x=>["facebook","instagram"].includes(x)):JSON.parse(post.platformsJson);
  const next={title:String(input.title??post.title).trim().slice(0,140),caption:String(input.caption??post.caption).trim().slice(0,2200),script:String(input.script??post.script).slice(0,5000),mediaType:String(input.mediaType??post.mediaType),mediaJson:JSON.stringify(media),platformsJson:JSON.stringify([...new Set(platforms)])};
  if(!next.title||!next.caption||!platforms.length||media.length>10||media.some(x=>!x.startsWith("https://")&&!x.startsWith("/api/social/media/")))return reject("Verifique texto, plataformas e URLs das mídias.");
  const updated=await prisma.socialPost.update({where:{id},data:next});return NextResponse.json({post:updated});
 }
 if(input.action==="cancel"){
 const changed=await prisma.socialPost.updateMany({where:{id,status:{in:["draft","scheduled"]}},data:{status:"cancelled"}});
 return changed.count?NextResponse.json({ok:true}):reject("A publicação mudou de estado.",409);
 }
 if(!["schedule","publish_now"].includes(input.action))return reject("Ação inválida.");
 const immediate=input.action==="publish_now";
 const at=immediate?new Date():new Date(input.scheduledAt);
 if(!immediate&&(!Number.isFinite(at.getTime())||at<=new Date()))return reject("Escolha uma data e hora futuras.");
 const platforms=JSON.parse(post.platformsJson);
 const fields={facebook:"facebookStatus",instagram:"instagramStatus"};
 const uncertain=platforms.filter(name=>post[fields[name]]==="uncertain"||post[fields[name]]==="sending");
 const explicit=Array.isArray(input.retryPlatforms)?input.retryPlatforms:[];
 if(uncertain.some(name=>!explicit.includes(name)))return reject("Antes de reagendar, confira as redes e confirme quais resultados incertos NÃO foram publicados: "+uncertain.join(", ")+".");
 if(explicit.some(name=>!uncertain.includes(name)))return reject("Seleção de repetição inválida.");
 if(platforms.every(name=>post[fields[name]]==="sent"))return reject("Esta publicação já está confirmada em todas as redes.",409);
 if(platforms.some(name=>post[fields[name]]==="sending"&&post.status!=="needs_review"))return reject("Publicação ainda em processamento; aguarde para evitar duplicidade.",409);
 const selected=platforms;
 const original=JSON.parse(post.mediaJson);
 if(original.some(x=>x.startsWith("/api/social/media/"))&&!r2Settings().ready)return reject("Cloudflare R2 não configurado. Verifique as cinco variáveis R2_* no .env e reinicie o LeadFlow.");
 let hosted=original;
 try{
  hosted=[];
  for(const url of original)hosted.push(await ensurePublicMedia(url,{forInstagram:selected.includes("instagram")}));
  validateSocialPost({...post,mediaJson:JSON.stringify(hosted)});
 }catch(error){return reject("Falha ao preparar mídia para publicação: "+String(error.message||error),400)}
 const reset={};
 for(const name of platforms){
  if(uncertain.includes(name)&&explicit.includes(name))reset[fields[name]]="pending";
 }
 const changed=await prisma.socialPost.updateMany({where:{id,status:post.status,facebookStatus:post.facebookStatus,instagramStatus:post.instagramStatus},data:{scheduledAt:at,approvedAt:new Date(),status:"scheduled",mediaJson:JSON.stringify(hosted),...reset,lastError:""}});
 return changed.count?NextResponse.json({ok:true}):reject("A publicação mudou de estado.",409);
 }catch(e){return reject(e.message)}
}
