import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const npmCli=process.platform==="win32"?"npm.cmd":"npm";
const server=spawn(npmCli,["exec","--","next","dev"],{cwd:root,stdio:"inherit",shell:process.platform==="win32",env:process.env});
const worker=spawn(process.execPath,[path.join(root,"scripts","recovery-worker.mjs")],{cwd:root,stdio:"inherit",env:process.env});
let stopping=false;
function stop(){
 if(stopping)return;stopping=true;
 for(const child of [worker,server])if(child.exitCode===null&&!child.killed)child.kill("SIGTERM");
}
process.on("SIGINT",stop);
process.on("SIGTERM",stop);
server.on("exit",(code)=>{stop();process.exitCode=code||0;});
worker.on("exit",(code)=>{if(!stopping&&code!==0)console.error("[expediente] Agente de expediente parou. O Next.js continua ativo sem monitor independente.");});
