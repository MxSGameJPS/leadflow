import {createHmac} from "node:crypto";
const VERSION=/^v\d+\.\d+$/;
export function socialMetaConfig(){
 const version=process.env.META_GRAPH_VERSION||"v25.0",token=process.env.META_PAGE_ACCESS_TOKEN,secret=process.env.META_APP_SECRET;
 if(!VERSION.test(version)||!token||!secret)throw Error("Configure as credenciais Meta no .env.");
 return {base:"https://graph.facebook.com/"+version,token,page:process.env.META_PAGE_ID,ig:process.env.META_IG_USER_ID,proof:createHmac("sha256",secret).update(token).digest("hex")};
}
export async function socialGraph(cfg,path,params={},method="GET"){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 const body=new URLSearchParams({...params,access_token:cfg.token,appsecret_proof:cfg.proof});
 try{
  const response=await fetch(cfg.base+"/"+path+(method==="GET"?"?"+body:""),{method,headers:method==="POST"?{"Content-Type":"application/x-www-form-urlencoded"}:undefined,body:method==="POST"?body:undefined,signal:controller.signal,cache:"no-store"});
  const json=await response.json().catch(()=>({}));
  if(!response.ok||json.error)throw Error("Meta HTTP "+response.status+": "+String(json.error?.message||"Falha ao consultar Meta").slice(0,240));
  return json;
 }finally{clearTimeout(timer)}
}
export const socialId=value=>typeof value==="string"&&/^[0-9_]+$/.test(value)&&value.length<110;
export async function socialComments(cfg,platform,postId){
 if(!socialId(postId))return [];
 const endpoint=platform==="instagram"?postId+"/comments":postId+"/comments";
 const result=await socialGraph(cfg,endpoint,{fields:"id,text,from,username,timestamp,created_time,message",limit:"30"});
 return (result.data||[]).map(row=>({id:row.id,platform,postId,author:row.username||row.from?.name||"Usuário",text:row.text||row.message||"",createdAt:row.timestamp||row.created_time||null}));
}
export async function socialConversations(cfg,platform){
 const owner=platform==="instagram"?cfg.ig:cfg.page;
 if(!owner||!socialId(owner))return [];
 const result=await socialGraph(cfg,owner+"/conversations",{fields:"id,updated_time,participants,messages.limit(1){message,from,created_time}",limit:"30",...(platform==="instagram"?{platform:"instagram"}:{})});
 return (result.data||[]).map(row=>({id:row.id,platform,updatedAt:row.updated_time||null,participants:row.participants?.data||[],latest:row.messages?.data?.[0]?.message||""}));
}
