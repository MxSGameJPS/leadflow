import fs from "node:fs";
import path from "node:path";

// Controle persistente no Windows; arquivo local não compartilhado com a instalação remota.
export const captureControlPath=path.join(process.cwd(),".leadflow-capture-control.json");
export function captureRunning(){
 try{
  const data=JSON.parse(fs.readFileSync(captureControlPath,"utf8"));
  return data?.running===true;
 }catch(e){
  if(e.code!=="ENOENT")throw e;
  // Compatibilidade com configurações anteriores, até o primeiro comando pelo CRM.
  return process.env.LEADFLOW_CAPTURE_AUTO_SEND==="true";
 }
}
export function setCaptureRunning(running){
 const state={running:running===true,updatedAt:new Date().toISOString()};
 const temp=captureControlPath+"."+process.pid+".tmp";
 fs.writeFileSync(temp,JSON.stringify(state)+"\n",{encoding:"utf8",flag:"wx"});
 try{fs.renameSync(temp,captureControlPath)}
 catch(e){try{fs.unlinkSync(temp)}catch{}throw e}
 return state;
}
