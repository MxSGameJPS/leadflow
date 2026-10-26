import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {PrismaClient} from "@prisma/client";
import {getRecoveryRest} from "../src/services/recovery/workSchedule.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
for(const name of [".env",".env.local"]){
 const filename=path.join(root,name);if(!fs.existsSync(filename))continue;
 for(const line of fs.readFileSync(filename,"utf8").split(/\r?\n/)){
  const match=line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
  if(!match||process.env[match[1]]!==undefined)continue;
  let value=match[2].trim();
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  process.env[match[1]]=value;
 }
}
const prisma=new PrismaClient();
const sessionId=process.env.OPENWA_SESSION_ID?.trim();
const lock=path.join(root,".recovery-worker.lock");
let lockFd;
try{lockFd=fs.openSync(lock,"wx");fs.writeSync(lockFd,String(process.pid));}
catch(e){if(e.code==="EEXIST")throw Error("Monitor de expediente já possui uma instância. Remova o lock apenas se tiver certeza de que não existe processo ativo.");throw e}
let running=true,abortSleep=null;
function stop(){running=false;abortSleep?.();}
process.on("SIGINT",stop);process.on("SIGTERM",stop);
const nap=ms=>new Promise(resolve=>{
 const timer=setTimeout(resolve,ms);
 abortSleep=()=>{clearTimeout(timer);resolve();};
});
async function check(){
 if(!sessionId){console.log("[expediente] OPENWA_SESSION_ID ausente.");return;}
 const latest=await prisma.recoveryDecision.findFirst({where:{sessionId,sentAt:{not:null}},orderBy:{sentAt:"desc"},select:{chatId:true,sentAt:true}});
 const snapshot=latest?await prisma.recoveryFollowupSnapshot.findUnique({where:{sessionId_chatId:{sessionId,chatId:latest.chatId}},select:{latestReplyAt:true}}):null;
 const state=getRecoveryRest({lastSentAt:latest?.sentAt,lastReplyAt:snapshot?.latestReplyAt});
 const pending=await prisma.recoveryDispatch.count({where:{sessionId,status:"reserved"}});
 const phase=!state.working?"dormindo":state.resting?"descansando":"em expediente";
 console.log("[expediente]",new Date().toLocaleString(),phase,"reservas:",pending,state.restUntil?"retorno: "+new Date(state.restUntil).toLocaleTimeString():"");
}
try{
 console.log("[expediente] Relógio local do Windows; 08h–18h; descanso de 30min. Não envia mensagens.");
 while(running){try{await check()}catch(e){console.error("[expediente]",e.message)}if(running)await nap(60000)}
}finally{
 await prisma.$disconnect();
 try{fs.closeSync(lockFd);fs.unlinkSync(lock)}catch{}
}
