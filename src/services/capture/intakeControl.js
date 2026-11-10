import fs from "node:fs";
import path from "node:path";
const filename=path.join(process.cwd(),".leadflow-capture-intake.json");
export function captureIntakePaused(){
 try{return JSON.parse(fs.readFileSync(filename,"utf8")).paused===true}
 catch(error){if(error.code==="ENOENT")return false;throw error}
}
export function setCaptureIntakePaused(paused){
 const next={paused:paused===true,updatedAt:new Date().toISOString()};
 const temporary=filename+"."+process.pid+".tmp";
 fs.writeFileSync(temporary,JSON.stringify(next)+"\n",{encoding:"utf8",flag:"wx"});
 try{fs.renameSync(temporary,filename)}
 catch(error){try{fs.unlinkSync(temporary)}catch{}throw error}
 return next;
}
