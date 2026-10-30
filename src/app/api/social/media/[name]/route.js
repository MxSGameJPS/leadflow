import {NextResponse} from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
const types={jpg:"image/jpeg",png:"image/png",mp4:"video/mp4",mov:"video/quicktime"};
export const runtime="nodejs";
export async function GET(_request,{params}){
 if(process.env.NODE_ENV==="production")return new Response("Local only",{status:403});
 const {name}=await params;
 if(!/^[a-f0-9-]{36}\.(jpg|png|mp4|mov)$/.test(name))return new Response("Invalid",{status:400});
 try{
 const bytes=await fs.readFile(path.join(process.cwd(),"data","social-media",name));
 const ext=name.split(".").at(-1);
 return new Response(bytes,{headers:{"Content-Type":types[ext],"Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"}});
 }catch{return new Response("Not found",{status:404})}
}
