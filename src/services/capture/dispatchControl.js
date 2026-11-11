import fs from "node:fs";
import path from "node:path";

// Controle persistente local. Captação e campanha possuem chaves independentes.
export const captureControlPath=path.join(process.cwd(),".leadflow-capture-control.json");
function load(){
 try{return JSON.parse(fs.readFileSync(captureControlPath,"utf8"))||{}}
 catch(error){if(error.code!=="ENOENT")throw error;return {}}
}
function save(data){
 const temp=captureControlPath+"."+process.pid+".tmp";
 fs.writeFileSync(temp,JSON.stringify({...data,updatedAt:new Date().toISOString()})+"\n",{encoding:"utf8",flag:"wx"});
 try{fs.renameSync(temp,captureControlPath)}
 catch(error){try{fs.unlinkSync(temp)}catch{}throw error}
}
export function blackFridayWindow(now=new Date()){return now.getFullYear()===2026&&now.getMonth()===10}
export function captureCampaignActive(now=new Date()){return load().blackFriday===true&&blackFridayWindow(now)}
export function captureRunning(){
 const state=load();
 return typeof state.running==="boolean"?state.running:process.env.LEADFLOW_CAPTURE_AUTO_SEND==="true";
}
export function setCaptureRunning(running){
 const data={...load(),running:running===true};
 save(data);return {...data,updatedAt:new Date().toISOString()};
}
export function setCaptureCampaignActive(enabled,now=new Date()){
 if(enabled&&!blackFridayWindow(now))throw Error("Campanha Black Friday 2026 disponível somente em novembro de 2026.");
 const data={...load(),blackFriday:enabled===true};
 save(data);return {blackFriday:captureCampaignActive(now)};
}
