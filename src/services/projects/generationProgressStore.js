import fs from "node:fs/promises";
import path from "node:path";

const ROOT=path.join(process.cwd(),"data","generation-progress");
function safeId(value){return String(value||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,100)}
function fileFor(id){const safe=safeId(id);if(!safe)throw new Error("generationId inválido.");return path.join(ROOT,safe+".json")}
async function readRaw(id){try{return JSON.parse(await fs.readFile(fileFor(id),"utf8"))}catch{return null}}
export async function startGenerationProgress(id,meta={}){
  await fs.mkdir(ROOT,{recursive:true});
  const state={id:safeId(id),status:"running",startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),meta,events:[],files:[]};
  await fs.writeFile(fileFor(id),JSON.stringify(state,null,2),"utf8");return state;
}
export async function reportGenerationProgress(id,event={}){
  if(!safeId(id))return null;await fs.mkdir(ROOT,{recursive:true});
  const state=await readRaw(id)||{id:safeId(id),status:"running",startedAt:new Date().toISOString(),events:[],files:[]};
  const item={at:new Date().toISOString(),phase:String(event.phase||"working"),title:String(event.title||"Processando"),detail:String(event.detail||""),kind:String(event.kind||"step"),file:String(event.file||"")};
  state.updatedAt=item.at;state.current=item;state.events=[...(state.events||[]),item].slice(-120);
  if(item.file&&!state.files.includes(item.file))state.files=[...state.files,item.file].slice(-100);
  await fs.writeFile(fileFor(id),JSON.stringify(state,null,2),"utf8");return state;
}
export async function finishGenerationProgress(id,result={}){
  const state=await readRaw(id)||{id:safeId(id),events:[],files:[]};state.status="done";state.updatedAt=new Date().toISOString();state.result=result;
  await fs.writeFile(fileFor(id),JSON.stringify(state,null,2),"utf8");return state;
}
export async function failGenerationProgress(id,error){
  const state=await readRaw(id)||{id:safeId(id),events:[],files:[]};state.status="error";state.updatedAt=new Date().toISOString();state.error=String(error?.message||error||"Falha na geração.");
  await fs.writeFile(fileFor(id),JSON.stringify(state,null,2),"utf8");return state;
}
export async function getGenerationProgress(id){return readRaw(id)}
