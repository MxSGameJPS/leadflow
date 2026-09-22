import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveProjectFolder } from "./projectStore.js";

const state = globalThis.__leadflowSitePreviewServers || new Map();
globalThis.__leadflowSitePreviewServers = state;

function hash(value){
  let result=0;
  for(const char of String(value||""))result=((result<<5)-result+char.charCodeAt(0))|0;
  return Math.abs(result);
}
function portAvailable(port){
  return new Promise(resolve=>{
    const server=net.createServer();
    server.unref();
    server.once("error",()=>resolve(false));
    server.listen({host:"127.0.0.1",port},()=>server.close(()=>resolve(true)));
  });
}
async function choosePort(key){
  const start=4300+(hash(key)%500);
  for(let offset=0;offset<80;offset++){
    const port=4300+((start-4300+offset)%500);
    if(await portAvailable(port))return port;
  }
  throw new Error("Não foi encontrada uma porta local livre para a prévia.");
}
async function waitForServer(url,entry){
  const deadline=Date.now()+60000;
  let lastError="";
  while(Date.now()<deadline){
    if(entry.child.exitCode!=null)throw new Error("O servidor da prévia encerrou antes de iniciar. "+entry.logs.slice(-1200));
    try{
      const response=await fetch(url,{cache:"no-store"});
      if(response.status<500)return;
      lastError="HTTP "+response.status;
    }catch(error){lastError=error.message}
    await new Promise(resolve=>setTimeout(resolve,650));
  }
  throw new Error("A prévia não iniciou no prazo esperado. "+lastError+" "+entry.logs.slice(-1200));
}
export async function ensureProjectPreviewServer(folderPath){
  const root=resolveProjectFolder(folderPath);
  if(!root)throw new Error("Projeto sem pasta gerada.");
  const key=path.resolve(root);
  const existing=state.get(key);
  if(existing&&existing.child.exitCode==null){
    const url="http://127.0.0.1:"+existing.port;
    await waitForServer(url,existing);
    return{url,port:existing.port};
  }
  const port=await choosePort(key);
  const nextBin=path.join(process.cwd(),"node_modules","next","dist","bin","next");
  const child=spawn(process.execPath,[nextBin,"dev","-H","127.0.0.1","-p",String(port)],{
    cwd:key,
    env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"},
    stdio:["ignore","pipe","pipe"],
    windowsHide:true,
  });
  const entry={port,child,logs:""};
  const append=chunk=>{entry.logs=(entry.logs+String(chunk||"")).slice(-12000)};
  child.stdout?.on("data",append);
  child.stderr?.on("data",append);
  child.once("exit",()=>state.delete(key));
  child.unref();
  state.set(key,entry);
  const url="http://127.0.0.1:"+port;
  await waitForServer(url,entry);
  return{url,port};
}
