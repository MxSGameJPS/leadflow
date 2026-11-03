import {mkdir,readFile,writeFile,rename} from "node:fs/promises";
import path from "node:path";
const file=path.join(process.cwd(),"data","social-media","agent-permissions.json");
export const defaults=Object.freeze({research:true,planning:true,approvedPublishing:true,replySuggestions:true,crmRegistration:true,autoReplies:false,autoStrategyChanges:false});
const keys=Object.keys(defaults);
export async function readSocialPermissions(){
 try{const stored=JSON.parse(await readFile(file,"utf8"));return Object.fromEntries(keys.map(k=>[k,typeof stored[k]==="boolean"?stored[k]:defaults[k]]))}
 catch(error){if(error.code==="ENOENT")return {...defaults};throw error}
}
export async function saveSocialPermissions(value){
 const previous=await readSocialPermissions();
 const next={...previous};
 for(const k of keys)if(Object.prototype.hasOwnProperty.call(value,k)){if(typeof value[k]!=="boolean")throw Error("Permissão inválida: "+k);next[k]=value[k]}
 // Automatic replies and unsupervised strategy modifications are not implemented.
 next.autoReplies=false;next.autoStrategyChanges=false;
 await mkdir(path.dirname(file),{recursive:true});
 const temporary=file+"."+process.pid+".tmp";
 await writeFile(temporary,JSON.stringify(next,null,2),"utf8");
 await rename(temporary,file);
 return next;
}
