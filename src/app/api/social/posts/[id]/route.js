import {NextResponse} from "next/server";
import {prisma} from "../../../../../lib/prisma.js";
import {validateSocialPost} from "../../../../../services/social/publisher.js";
export const runtime="nodejs";
const reject=(error,status=400)=>NextResponse.json({error},{status});
export async function PATCH(request,{params}){
 if(process.env.NODE_ENV==="production")return reject("Apenas ambiente local.",403);
 const {id}=await params;
 try{
 const input=await request.json(),post=await prisma.socialPost.findUnique({where:{id}});
 if(!post)return reject("Publicação não encontrada.",404);
 if(!["draft","scheduled"].includes(post.status))return reject("Publicação iniciada ou encerrada; não pode ser alterada.",409);
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
 if(input.action!=="schedule")return reject("Ação inválida.");
 const at=new Date(input.scheduledAt);
 if(!Number.isFinite(at.getTime())||at<=new Date())return reject("Escolha uma data e hora futuras.");
 validateSocialPost(post);
 const changed=await prisma.socialPost.updateMany({where:{id,status:{in:["draft","scheduled"]}},data:{scheduledAt:at,approvedAt:new Date(),status:"scheduled",facebookStatus:"pending",instagramStatus:"pending"}});
 return changed.count?NextResponse.json({ok:true}):reject("A publicação mudou de estado.",409);
 }catch(e){return reject(e.message)}
}
