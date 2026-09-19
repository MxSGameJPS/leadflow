import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

const ROOT=path.join(process.cwd(),"data","site-reference-images");
const MAX_FILE_BYTES=5*1024*1024;
const MAX_IMAGES=6;
const TYPES={"image/png":"png","image/jpeg":"jpg","image/jpg":"jpg","image/webp":"webp"};

function clean(value,max=300){return String(value??"").replace(/\u0000/g,"").trim().slice(0,max)}
function keyFor(scope){const value=clean(scope,220);if(!value)throw new Error("Escopo de referências inválido.");return createHash("sha256").update(value).digest("hex")}
function directoryFor(scope){return path.join(ROOT,keyFor(scope))}
function indexFile(scope){return path.join(directoryFor(scope),"index.json")}
function publicMeta(item){return{fileName:item.fileName,label:item.label,mimeType:item.mimeType,size:item.size,createdAt:item.createdAt}}
async function readIndex(scope){try{const value=JSON.parse(await fs.readFile(indexFile(scope),"utf8"));return Array.isArray(value)?value:[]}catch(error){if(error?.code==="ENOENT")return[];return[]}}
async function writeIndex(scope,items){await fs.mkdir(directoryFor(scope),{recursive:true});await fs.writeFile(indexFile(scope),JSON.stringify(items.map(publicMeta),null,2),"utf8")}
function decodeImage(item){
  const dataUrl=String(item?.dataUrl||"").replace(/\s+/g,"");
  const match=dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if(!match)throw new Error("Use apenas imagens PNG, JPG ou WEBP.");
  const mimeType=match[1].toLowerCase();
  const buffer=Buffer.from(match[2],"base64");
  if(!buffer.length)throw new Error("Uma das imagens de referência está vazia.");
  if(buffer.length>MAX_FILE_BYTES)throw new Error("Cada imagem de referência pode ter no máximo 5 MB.");
  return{buffer,mimeType,extension:TYPES[mimeType]||"jpg",label:clean(item?.label,180)||"Referência visual"}
}
export async function saveReferenceImages(scope,incoming=[]){
  if(!Array.isArray(incoming)||!incoming.length)return listReferenceImages(scope);
  const dir=directoryFor(scope);await fs.mkdir(dir,{recursive:true});
  let items=await readIndex(scope);
  for(const raw of incoming.slice(0,4)){
    const image=decodeImage(raw);
    const fileName=Date.now()+"-"+randomBytes(4).toString("hex")+"."+image.extension;
    await fs.writeFile(path.join(dir,fileName),image.buffer);
    items.push({fileName,label:image.label,mimeType:image.mimeType,size:image.buffer.length,createdAt:new Date().toISOString()});
  }
  while(items.length>MAX_IMAGES){const removed=items.shift();if(removed?.fileName)await fs.rm(path.join(dir,removed.fileName),{force:true})}
  await writeIndex(scope,items);
  return items.map(publicMeta);
}
export async function listReferenceImages(scope,{withData=false}={}){
  const items=await readIndex(scope);
  if(!withData)return items.map(publicMeta);
  const dir=directoryFor(scope);const result=[];
  for(const item of items){
    try{const buffer=await fs.readFile(path.join(dir,item.fileName));result.push({...publicMeta(item),dataUrl:"data:"+item.mimeType+";base64,"+buffer.toString("base64")})}catch{}
  }
  return result;
}
export async function clearReferenceImages(scope){const dir=directoryFor(scope);await fs.rm(dir,{recursive:true,force:true});return[]}
