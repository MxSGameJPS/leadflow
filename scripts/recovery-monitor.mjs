import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
for(const filename of [".env",".env.local"]){
 const file=path.join(root,filename);
 if(!fs.existsSync(file))continue;
 for(const line of fs.readFileSync(file,"utf8").split(/\r?\n/)){
  const match=line.match(/^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)\s*$/);
  if(!match||process.env[match[1]]!==undefined)continue;
  let value=match[2].trim();
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  process.env[match[1]]=value;
 }
}
const prisma=new PrismaClient();
const sessionId=process.env.OPENWA_SESSION_ID?.trim();
const base=process.env.OPENWA_URL?.trim().replace(/\/+$/,"");
const apiKey=process.env.OPENWA_API_KEY?.trim();
if(!sessionId||!base||!apiKey)throw Error("Configure OPENWA_SESSION_ID, OPENWA_URL e OPENWA_API_KEY.");
const intervalMinutes=Math.max(5,Math.min(60,Number(process.env.RECOVERY_MONITOR_MINUTES)||5));
const refusal=/\b(n[aã]o\s+(temos?|tenho|estamos|estou|queremos|quero)\s+interesse|sem\s+interesse|n[aã]o\s+interessa|pare\s+de\s+(me\s+)?enviar|n[aã]o\s+(me\s+)?mande|remova\s+(meu\s+)?contato)\b/i;
let stopping=false;
async function cycle(){
 const dispatches=await prisma.recoveryDispatch.findMany({where:{sessionId,status:"sent"},orderBy:{createdAt:"asc"}});
 let checked=0,errors=0,changed=0;
 for(const dispatch of dispatches){
  if(stopping)break;
  try{
   const decision=await prisma.recoveryDecision.findUnique({where:{id:dispatch.decisionId}});
   if(!decision?.sentAt||decision.status==="close_approved")continue;
   const url=new URL(`${base}/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(dispatch.chatId)}/history`);
   url.searchParams.set("limit","100");url.searchParams.set("includeMedia","false");
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
   let response;
   try{response=await fetch(url,{headers:{"X-API-Key":apiKey,Accept:"application/json"},signal:controller.signal});}
   finally{clearTimeout(timer)}
   if(!response.ok)throw Error("OpenWA HTTP "+response.status);
   const raw=await response.json();
   const rows=(Array.isArray(raw)?raw:Array.isArray(raw?.messages)?raw.messages:[]).filter(m=>m.chatId===dispatch.chatId&&!m.isGroup);
   const incoming=rows.filter(m=>m.fromMe===false&&Number.isFinite(m.timestamp)&&m.timestamp>=decision.sentAt.getTime()/1000-10).sort((a,b)=>a.timestamp-b.timestamp);
   const messages=incoming.filter(m=>String(m.body||"").trim()).map(m=>({text:String(m.body).slice(0,2000),timestamp:m.timestamp,type:m.type}));
   const status=messages.some(m=>refusal.test(m.text))?"possible_refusal":messages.length?"human_review":"no_text_reply_found";
   const suggestion=status==="possible_refusal"?"Possível recusa: revisar encerramento, sem novo contato.":status==="human_review"?"Resposta recebida: revisão humana necessária.":"Sem resposta textual encontrada nas 100 mensagens recentes.";
   const previous=await prisma.recoveryFollowupSnapshot.findUnique({where:{sessionId_chatId:{sessionId,chatId:dispatch.chatId}}});
   const latestReplyAt=messages.length?new Date(messages.at(-1).timestamp*1000):null;
   if(!previous||previous.status!==status||Number(previous.latestReplyAt)!==Number(latestReplyAt))changed++;
   await prisma.recoveryFollowupSnapshot.upsert({where:{sessionId_chatId:{sessionId,chatId:dispatch.chatId}},create:{sessionId,chatId:dispatch.chatId,status,suggestion,messagesJson:JSON.stringify(messages),nonTextCount:incoming.length-messages.length,latestReplyAt,checkedAt:new Date()},update:{status,suggestion,messagesJson:JSON.stringify(messages),nonTextCount:incoming.length-messages.length,latestReplyAt,checkedAt:new Date()}});
   checked++;
  }catch(error){errors++;console.error("[monitor] Falha em",dispatch.chatId,error.message)}
 }
 console.log("[monitor]",new Date().toISOString(),"consultados:",checked,"mudanças:",changed,"erros:",errors);
}
function shutdown(){stopping=true;}
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
try{
 console.log("[monitor] Somente leitura do WhatsApp; nenhuma mensagem será enviada. Intervalo:",intervalMinutes,"minutos.");
 while(!stopping){
  await cycle();
  if(stopping)break;
  await new Promise(resolve=>{const timer=setTimeout(resolve,intervalMinutes*60000);const quit=()=>{clearTimeout(timer);resolve()};process.once("SIGINT",quit);process.once("SIGTERM",quit)});
 }
}finally{await prisma.$disconnect()}
