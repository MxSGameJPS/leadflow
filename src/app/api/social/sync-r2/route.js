import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {ensurePublicMedia,r2Settings} from "../../../../services/social/r2Storage.js";
export const runtime="nodejs";
const local=url=>typeof url==="string"&&url.startsWith("/api/social/media/");
export async function POST(){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Disponível somente no ambiente local."},{status:403});
 if(!r2Settings().ready)return NextResponse.json({error:"Configure as cinco variáveis R2 no .env e reinicie o LeadFlow."},{status:400});
 const drafts=await prisma.socialPost.findMany({where:{status:"draft"},orderBy:{createdAt:"asc"}});
 const result={postsUpdated:0,filesUploaded:0,filesFailed:0,errors:[]};
 for(const post of drafts){
  let urls;try{urls=JSON.parse(post.mediaJson);if(!Array.isArray(urls))throw Error("Mídias inválidas");}catch{result.errors.push({post:post.title,error:"Lista de mídias inválida"});continue}
  if(!urls.some(local))continue;
  let selected;try{selected=JSON.parse(post.platformsJson)}catch{selected=[]}
  const next=[...urls];let failed=false;
  for(let i=0;i<urls.length;i++){
   if(!local(urls[i]))continue;
   try{next[i]=await ensurePublicMedia(urls[i],{forInstagram:selected.includes("instagram")});result.filesUploaded++}
   catch(e){result.filesFailed++;failed=true;result.errors.push({post:post.title,position:i+1,error:String(e.message||e).slice(0,160)});}
  }
  // Keep successful migrations, retain local URLs for failed files, preserve carousel sequence.
  if(next.some((url,i)=>url!==urls[i])){
   const changed=await prisma.socialPost.updateMany({where:{id:post.id,status:"draft",mediaJson:post.mediaJson},data:{mediaJson:JSON.stringify(next)}});
   if(changed.count)result.postsUpdated++;
   else result.errors.push({post:post.title,error:"Rascunho alterado durante a sincronização; atualize e tente novamente."});
  }
  if(failed)continue;
 }
 return NextResponse.json(result);
}
