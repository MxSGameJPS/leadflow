import {createHmac} from "node:crypto";
import {prisma} from "../../lib/prisma.js";
const allowedVersion=/^v\d+\.\d+$/;
function config(){
 const version=process.env.META_GRAPH_VERSION||"v25.0",token=process.env.META_PAGE_ACCESS_TOKEN,secret=process.env.META_APP_SECRET;
 if(!allowedVersion.test(version)||!token||!secret)throw Error("Configure META_GRAPH_VERSION, META_PAGE_ACCESS_TOKEN e META_APP_SECRET.");
 return {base:"https://graph.facebook.com/"+version,token,proof:createHmac("sha256",secret).update(token).digest("hex"),page:process.env.META_PAGE_ID,ig:process.env.META_IG_USER_ID};
}
async function call(cfg,node,params={},method="POST"){
 const data=new URLSearchParams({...params,access_token:cfg.token,appsecret_proof:cfg.proof});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const url=cfg.base+"/"+node+(method==="GET"?"?"+data:"");
  const res=await fetch(url,{method,headers:method==="POST"?{"Content-Type":"application/x-www-form-urlencoded"}:undefined,body:method==="POST"?data:undefined,signal:controller.signal,cache:"no-store"});
  const result=await res.json().catch(()=>({}));
  if(!res.ok||result.error)throw Error("Meta HTTP "+res.status+": "+String(result.error?.message||"falha desconhecida").slice(0,220));
  return result;
 }finally{clearTimeout(timer)}
}
const urlOk=(u)=>{try{const x=new URL(u);return x.protocol==="https:"&&!/(^localhost$|\.local$|^127\.|^10\.|^192\.168\.|^169\.254\.)/.test(x.hostname)}catch{return false}};
export function validateSocialPost(post){
 const media=JSON.parse(post.mediaJson),platforms=JSON.parse(post.platformsJson);
 if(!Array.isArray(media)||!Array.isArray(platforms)||!platforms.length)throw Error("Selecione ao menos uma rede social.");
 if(!["image","carousel","video","text"].includes(post.mediaType))throw Error("Tipo de mídia inválido.");
 if(media.length>10)throw Error("O limite é de 10 mídias por publicação.");
 if(media.some(u=>!urlOk(u)))throw Error("MÍDIA_LOCAL: Há imagens ou vídeos acessíveis somente no seu computador. Configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL para hospedar os criativos, ou substitua as URLs por links HTTPS públicos antes de agendar.");
 if(post.mediaType==="image"&&media.length!==1||post.mediaType==="video"&&media.length!==1||post.mediaType==="carousel"&&(media.length<2||media.length>10))throw Error("Quantidade de mídias incompatível com a publicação.");
 if(platforms.includes("instagram")&&post.mediaType==="text")throw Error("Instagram exige imagem ou vídeo.");
 if(platforms.includes("instagram")&&post.mediaType!=="video"&&media.some(u=>/\.png(?:\?|$)/i.test(u)))throw Error("Para Instagram, converta imagens PNG para JPEG antes de agendar.");
 if(post.mediaType!=="text"&&!media.length)throw Error("Mídia obrigatória.");
 return {media,platforms};
}
async function publishFacebook(cfg,post,media){
 if(!cfg.page)throw Error("META_PAGE_ID não configurado.");
 const identity=await call(cfg,"me",{fields:"id,name"},"GET");
 if(String(identity.id)!==String(cfg.page))throw Error("O META_PAGE_ACCESS_TOKEN não pertence à Página configurada. No Graph API Explorer, obtenha o token da Página (não o token de usuário), confira META_PAGE_ID e reinicie o LeadFlow. Identidade retornada: "+String(identity.name||identity.id).slice(0,80));
 if(post.mediaType==="text")return (await call(cfg,cfg.page+"/feed",{message:post.caption})).id;
 if(post.mediaType==="image")return (await call(cfg,cfg.page+"/photos",{url:media[0],caption:post.caption})).post_id;
 if(post.mediaType==="video")return (await call(cfg,cfg.page+"/videos",{file_url:media[0],description:post.caption})).id;
 // Publicação multiphoto via fotos não publicadas + attached_media.
 const children=[];
 for(const url of media){const result=await call(cfg,cfg.page+"/photos",{url,published:"false"});children.push({media_fbid:result.id})}
 return (await call(cfg,cfg.page+"/feed",{message:post.caption,attached_media:JSON.stringify(children)})).id;
}
async function createInstagramContainer(cfg,post,media){
 if(!cfg.ig)throw Error("META_IG_USER_ID não configurado.");
 if(post.mediaType==="image")return (await call(cfg,cfg.ig+"/media",{image_url:media[0],caption:post.caption})).id;
 if(post.mediaType==="video")return (await call(cfg,cfg.ig+"/media",{media_type:"REELS",video_url:media[0],caption:post.caption})).id;
 const ids=[];
 for(const url of media){const isVideo=/\.(mp4|mov)(\?|$)/i.test(url);const opts=isVideo?{video_url:url,media_type:"VIDEO",is_carousel_item:"true"}:{image_url:url,is_carousel_item:"true"};ids.push((await call(cfg,cfg.ig+"/media",opts)).id)}
 return (await call(cfg,cfg.ig+"/media",{media_type:"CAROUSEL",children:ids.join(","),caption:post.caption})).id;
}
async function awaitInstagramReady(cfg,id){
 for(let attempt=0;attempt<8;attempt++){
  const result=await call(cfg,id,{fields:"status_code"},"GET");
  if(result.status_code==="FINISHED")return;
  if(["ERROR","EXPIRED"].includes(result.status_code))throw Error("Processamento Meta falhou: "+result.status_code);
  if(attempt<7)await new Promise(resolve=>setTimeout(resolve,15000));
 }
 throw Error("Processamento de vídeo ainda não finalizado. Confira no Instagram antes de tentar outra publicação.");
}
async function publishInstagram(cfg,post,media){
 const id=await createInstagramContainer(cfg,post,media);
 await awaitInstagramReady(cfg,id);
 return (await call(cfg,cfg.ig+"/media_publish",{creation_id:id})).id;
}
export async function publishScheduledSocialPosts(){
 const now=new Date();
 const posts=await prisma.socialPost.findMany({where:{status:"scheduled",scheduledAt:{lte:now},approvedAt:{not:null}},orderBy:{scheduledAt:"asc"},take:3});
 for(const post of posts){
  let validated;try{validated=validateSocialPost(post)}catch(e){await prisma.socialPost.update({where:{id:post.id},data:{status:"needs_review",lastError:e.message}});continue}
  const claimed=await prisma.socialPost.updateMany({where:{id:post.id,status:"scheduled"},data:{status:"publishing"}});
  if(!claimed.count)continue;
  for(const platform of validated.platforms){
   const field=platform==="facebook"?"facebookStatus":"instagramStatus",idField=platform==="facebook"?"facebookPostId":"instagramPostId";
   if(!["pending"].includes(post[field]))continue;
   await prisma.socialPost.update({where:{id:post.id},data:{[field]:"sending"}});
   try{
    const cfg=config(),id=platform==="facebook"?await publishFacebook(cfg,post,validated.media):await publishInstagram(cfg,post,validated.media);
    await prisma.socialPost.update({where:{id:post.id},data:{[field]:"sent",[idField]:id||null}});
    console.log("[social] Publicação confirmada:",platform,post.id);
   }catch(e){
    await prisma.socialPost.update({where:{id:post.id},data:{[field]:"uncertain",lastError:String(e.message||e).slice(0,450)}});
    console.error("[social] Resultado incerto; nenhuma repetição automática:",platform,post.id,e.message);
   }
  }
  const final=await prisma.socialPost.findUnique({where:{id:post.id}});
  const states=validated.platforms.map(p=>final[p==="facebook"?"facebookStatus":"instagramStatus"]);
  await prisma.socialPost.update({where:{id:post.id},data:{status:states.every(x=>x==="sent")?"published":"needs_review"}});
 }
 return posts.length;
}
