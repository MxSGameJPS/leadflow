import { spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const nextBin=path.join(root,"node_modules","next","dist","bin","next");
const port=Number(process.env.LEADFLOW_DEV_PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw Error("LEADFLOW_DEV_PORT deve ser uma porta TCP válida.");
if(!fs.existsSync(nextBin))throw Error("Next.js não encontrado. Execute npm install antes de iniciar o LeadFlow.");

// Never let Next silently fall back to :3001, which can display stale app versions.
async function portAvailable(){
 return await new Promise(resolve=>{
  const probe=createServer();
  probe.once("error",()=>resolve(false));
  probe.listen({port,host:"127.0.0.1",exclusive:true},()=>probe.close(()=>resolve(true)));
 });
}
if(!await portAvailable()){
 console.error("\n[LeadFlow] Porta "+port+" ocupada. Provavelmente existe outra versão do LeadFlow aberta.");
 console.error("[LeadFlow] Feche o terminal antigo e confira processos com: netstat -ano | findstr :"+port);
 console.error("[LeadFlow] Não vou iniciar em outra porta e misturar versões.\n");
 process.exit(1);
}
const server=spawn(process.execPath,[nextBin,"dev","--hostname","127.0.0.1","--port",String(port)],{cwd:root,stdio:"inherit",env:process.env});
let worker=null,stopping=false;
function stop(){
 if(stopping)return;
 stopping=true;
 for(const child of [worker,server])if(child&&child.exitCode===null&&!child.killed)child.kill("SIGTERM");
}
process.on("SIGINT",stop);
process.on("SIGTERM",stop);
server.on("error",err=>{console.error("[LeadFlow] Falha ao iniciar Next:",err.message);stop();process.exitCode=1;});
server.on("exit",(code,signal)=>{
 if(!stopping&&code!==0)console.error("[LeadFlow] Next.js parou; o monitor de expediente também será encerrado.");
 stop();process.exitCode=code||0;
});
if(!stopping){
 worker=spawn(process.execPath,[path.join(root,"scripts","recovery-worker.mjs")],{cwd:root,stdio:"inherit",env:process.env});
 worker.on("error",e=>console.error("[expediente] Não foi possível iniciar:",e.message));
 worker.on("exit",code=>{if(!stopping&&code!==0)console.error("[expediente] Monitor parou; servidor web segue ativo, mas sem vigia de expediente.");});
}
console.log("[LeadFlow] Servidor fixado em http://127.0.0.1:"+port+"; portas alternativas desabilitadas.");
