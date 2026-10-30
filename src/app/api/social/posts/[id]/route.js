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
