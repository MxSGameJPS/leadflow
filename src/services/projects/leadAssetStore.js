import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const ASSET_DIR=path.join(process.cwd(),"data","lead-assets");
function clean(value,max=2000){return String(value??"").replace(/\u0000/g,"").trim().slice(0,max)}
function safeUrl(value){const raw=clean(value,1600);if(!raw)return"";try{const url=new URL(raw);return["http:","https:"].includes(url.protocol)?url.toString():""}catch{return""}}
function keyFor(externalId){const id=clean(externalId,500);return id?createHash("sha256").update(id).digest("hex"):""}
function normalizeSeed(input={}){const imageUrls=Array.isArray(input.imageUrls)?input.imageUrls.map(safeUrl).filter(Boolean):[];return{thumbnail:safeUrl(input.thumbnail),imageUrls:[...new Set(imageUrls)].slice(0,16),site:safeUrl(input.site),instagram:safeUrl(input.instagram),mapsLink:safeUrl(input.mapsLink),updatedAt:new Date().toISOString()}}
export async function saveLeadAssetSeed(externalId,input={}){const key=keyFor(externalId);if(!key)return null;await fs.mkdir(ASSET_DIR,{recursive:true});const seed=normalizeSeed(input);await fs.writeFile(path.join(ASSET_DIR,key+".json"),JSON.stringify(seed,null,2),"utf8");return seed}
export async function getLeadAssetSeed(externalId){const key=keyFor(externalId);if(!key)return null;try{return normalizeSeed(JSON.parse(await fs.readFile(path.join(ASSET_DIR,key+".json"),"utf8")))}catch{return null}}
