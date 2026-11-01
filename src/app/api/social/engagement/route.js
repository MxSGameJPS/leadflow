import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {socialMetaConfig,socialGraph,socialComments,socialConversations,socialId} from "../../../../services/social/engagement.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reject=(error,status=400)=>NextResponse.json({error},{status});
const allowed=()=>process.env.NODE_ENV!=="production";
export async function GET(request){
 if(!allowed())return reject("Somente ambiente local.",403);
 try{
  const cfg=socialMetaConfig(),kind=new URL(request.url).searchParams.get("kind")||"comments";
  const platform=new URL(request.url).searchParams.get("platform")||"instagram";
  if(!["instagram","facebook"].includes(platform)||!["comments","dm"].includes(kind))return reject("Consulta inválida.");
  if(kind==="dm")return NextResponse.json({items:await socialConversations(cfg,platform)});
  const posts=await prisma.socialPost.findMany({where:{status:"published",OR:[{instagramPostId:{not:null}},{facebookPostId:{not:null}}]},orderBy:{scheduledAt:"desc"},take:20});
  const items=[],errors=[];
  for(const post of posts){
   const id=platform==="instagram"?post.instagramPostId:post.facebookPostId;
   if(!id)continue;
   try{items.push(...(await socialComments(cfg,platform,id)).map(c=>({...c,title:post.title})))}catch(error){errors.push({post:post.title,error:String(error.message).slice(0,160)})}
  }
  return NextResponse.json({items,errors});
 }catch(error){return reject(String(error.message||error).slice(0,320),502)}
}
export async function POST(request){
 if(!allowed())return reject("Somente ambiente local.",403);
 try{
  const input=await request.json();
  const platform=input.platform,kind=input.kind,id=String(input.id||"");
  const message=String(input.message||"").trim();
  if(!["instagram","facebook"].includes(platform)||!["comment","dm"].includes(kind)||!socialId(id))return reject("Destino inválido.");
  if(message.length<2||message.length>900)return reject("Resposta deve ter entre 2 e 900 caracteres.");
  if(input.confirmation!=="RESPONDER")return reject("Confirme o envio desta resposta.");
  const cfg=socialMetaConfig();
  if(kind==="comment"){
   const route=id+(platform==="instagram"?"/replies":"/comments");
   const result=await socialGraph(cfg,route,{message},"POST");
   return NextResponse.json({ok:true,replyId:result.id||null});
  }
  // Only respond to an inbound, recent user message. Never initiate a conversation or bypass Meta's window.
  const history=await socialGraph(cfg,id+"/messages",{fields:"id,message,from,created_time",limit:"30"});
  const owner=platform==="instagram"?cfg.ig:cfg.page;
  const incoming=(history.data||[]).filter(x=>x.from?.id&&String(x.from.id)!==String(owner)&&Date.parse(x.created_time||"")>Date.now()-24*3600000).sort((a,b)=>Date.parse(b.created_time)-Date.parse(a.created_time));
  const latest=incoming[0];
  if(!latest)return reject("Nenhuma mensagem recebida nas últimas 24 horas. Envio bloqueado para respeitar a janela da Meta.",409);
  const recipient=latest.from.id;
  if(!cfg.page||!socialId(cfg.page))return reject("META_PAGE_ID não configurado.",400);
  const result=await socialGraph(cfg,cfg.page+"/messages",{recipient:JSON.stringify({id:recipient}),message:JSON.stringify({text:message}),messaging_type:"RESPONSE"},"POST");
  return NextResponse.json({ok:true,messageId:result.message_id||null});
 }catch(error){return reject(String(error.message||error).slice(0,320),502)}
}
