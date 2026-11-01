import fs from "node:fs";
import path from "node:path";
const file=path.join(process.cwd(),".leadflow-recovery-control.json");
export function recoveryRunning(){
 try{return JSON.parse(fs.readFileSync(file,"utf8")).running===true}
 catch(error){if(error.code!=="ENOENT")throw error;return process.env.LEADFLOW_RECOVERY_AUTO_SEND==="true"}
}
export function setRecoveryRunning(running){
 const state={running:running===true,updatedAt:new Date().toISOString()};
 const temp=file+"."+process.pid+".tmp";
 fs.writeFileSync(temp,JSON.stringify(state)+"\n",{encoding:"utf8",flag:"wx"});
 try{fs.renameSync(temp,file)}catch(e){try{fs.unlinkSync(temp)}catch{}throw e}
 return state;
}
