import {prisma} from "../../lib/prisma.js";
import {deletePublicMedia,keyFromPublicUrl,r2Settings} from "./r2Storage.js";
const retentionMs=24*60*60*1000;
export async function cleanupPublishedSocialMedia(){
 if(!r2Settings().ready)return {cleaned:0,skipped:"R2 não configurado"};
 const cutoff=new Date(Date.now()-retentionMs);
 const posts=await prisma.socialPost.findMany({where:{status:"published",r2CleanedAt:null,updatedAt:{lte:cutoff}},orderBy:{updatedAt:"asc"},take:15});
 if(!posts.length)return {cleaned:0};
 const all=await prisma.socialPost.findMany({select:{id:true,mediaJson:true,status:true,updatedAt:true}});
 let cleaned=0;
 for(const post of posts){
  const urls=JSON.parse(post.mediaJson);
  const keys=[...new Set(urls.map(keyFromPublicUrl).filter(Boolean))];
  try{
   for(const key of keys){
    const shared=all.some(other=>other.id!==post.id&&JSON.parse(other.mediaJson).some(url=>keyFromPublicUrl(url)===key)&&(other.status!=="published"||other.updatedAt>cutoff));
    if(shared)throw Error("Arquivo ainda vinculado a outra publicação pendente ou no período de retenção.");
   }
   for(const key of keys)await deletePublicMedia(key);
   await prisma.socialPost.update({where:{id:post.id},data:{r2CleanedAt:new Date(),r2CleanupError:""}});
   cleaned++;
  }catch(error){
   await prisma.socialPost.update({where:{id:post.id},data:{r2CleanupError:String(error.message||error).slice(0,350)}});
   console.error("[social] Limpeza R2 pendente:",post.id,error.message);
  }
 }
 return {cleaned};
}
