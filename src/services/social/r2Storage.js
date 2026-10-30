import {createHmac,createHash} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const hash=v=>createHash("sha256").update(v).digest("hex");
const hmac=(key,value)=>createHmac("sha256",key).update(value).digest();
const encode=v=>encodeURIComponent(v).replace(/[!'()*]/g,x=>"%"+x.charCodeAt(0).toString(16).toUpperCase());
export function r2Settings(){
 const account=process.env.R2_ACCOUNT_ID?.trim(),access=process.env.R2_ACCESS_KEY_ID?.trim(),secret=process.env.R2_SECRET_ACCESS_KEY?.trim(),bucket=process.env.R2_BUCKET?.trim(),publicUrl=process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/,"");
 const ready=!!(account&&access&&secret&&bucket&&publicUrl&&/^https:\/\//.test(publicUrl));
 return {ready,account,access,secret,bucket,publicUrl};
}
async function r2Request(method,key,data=null,type="application/octet-stream"){
 const c=r2Settings();if(!c.ready)throw Error("R2 não configurado: preencha R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL no .env.");
 if(!/^[\da-f-]{36}\.(jpg|jpeg|png|mp4|mov)$/i.test(key.split("/").at(-1))||!key.startsWith("posts/"))throw Error("Chave de mídia R2 inválida.");
 const date=new Date(),stamp=date.toISOString().replace(/[-:]|\.\d{3}/g,""),day=stamp.slice(0,8);
 const host=c.account+".r2.cloudflarestorage.com";
 const uri="/"+encode(c.bucket)+"/"+key.split("/").map(encode).join("/");
 const payloadHash=hash(data||Buffer.alloc(0));
 const headers={"host":host,"x-amz-content-sha256":payloadHash,"x-amz-date":stamp};
 if(data)headers["content-type"]=type;
 const signed=Object.keys(headers).sort();
 const canonicalHeaders=signed.map(k=>k+":"+headers[k].trim()+"\n").join("");
 const scope=day+"/auto/s3/aws4_request";
 const request=[method,uri,"",canonicalHeaders,signed.join(";"),payloadHash].join("\n");
 const stringToSign=["AWS4-HMAC-SHA256",stamp,scope,hash(request)].join("\n");
 const signing=hmac(hmac(hmac(hmac("AWS4"+c.secret,day),"auto"),"s3"),"aws4_request");
 const signature=createHmac("sha256",signing).update(stringToSign).digest("hex");
 headers.authorization="AWS4-HMAC-SHA256 Credential="+c.access+"/"+scope+", SignedHeaders="+signed.join(";")+", Signature="+signature;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch("https://"+host+uri,{method,headers,body:data||undefined,signal:controller.signal});
  if(!response.ok)throw Error("Cloudflare R2 HTTP "+response.status+": "+(await response.text()).slice(0,200));
 }finally{clearTimeout(timer)}
 return c.publicUrl+"/"+key.split("/").map(encode).join("/");
}
export async function ensurePublicMedia(url,{forInstagram=false}={}){
 const c=r2Settings();
 if(url.startsWith("https://"))return url;
 const matched=/^\/api\/social\/media\/([a-f0-9-]{36}\.(?:jpg|jpeg|png|mp4|mov))$/i.exec(url);
 if(!matched)throw Error("Arquivo local inválido: "+String(url).slice(0,70));
 const name=matched[1],ext=path.extname(name).toLowerCase(),local=path.join(process.cwd(),"data","social-media",name);
 let bytes=await fs.readFile(local),mime=ext===".png"?"image/png":ext===".jpg"||ext===".jpeg"?"image/jpeg":ext===".mp4"?"video/mp4":"video/quicktime";
 let keyName=name;
 if(forInstagram&&ext===".png"){
  let sharp;try{sharp=(await import("sharp")).default}catch{throw Error("Conversão de PNG requer a biblioteca sharp. Execute npm install sharp.");}
  bytes=await sharp(bytes).flatten({background:"#ffffff"}).jpeg({quality:88,mozjpeg:true}).toBuffer();
  keyName=name.replace(/\.png$/i,".jpg");mime="image/jpeg";
  await fs.writeFile(path.join(process.cwd(),"data","social-media",keyName),bytes);
 }
 return r2Request("PUT","posts/"+keyName,bytes,mime);
}
export function keyFromPublicUrl(url){
 const c=r2Settings();
 if(!c.ready||!url.startsWith(c.publicUrl+"/posts/"))return null;
 const key=decodeURIComponent(url.slice(c.publicUrl.length+1));
 return /^posts\/[a-f0-9-]{36}\.(jpg|jpeg|png|mp4|mov)$/i.test(key)?key:null;
}
export async function deletePublicMedia(key){return r2Request("DELETE",key)}
