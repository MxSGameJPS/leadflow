import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
const TYPES=new Map([["image/jpeg",".jpg"],["image/png",".png"],["video/mp4",".mp4"],["video/quicktime",".mov"]]);
export async function POST(request){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Uploads locais somente no LeadFlow local."},{status:403});
 try{
 const form=await request.formData(),files=form.getAll("files");
 if(!files.length||files.length>10)return NextResponse.json({error:"Selecione entre 1 e 10 arquivos."},{status:400});
 const uploaded=[],directory=path.join(process.cwd(),"data","social-media");
 await fs.mkdir(directory,{recursive:true});
 for(const file of files){
  if(!TYPES.has(file.type)||file.size>100*1024*1024||file.size===0)return NextResponse.json({error:"Formato inválido ou arquivo maior que 100 MB. Use JPEG, PNG, MP4 ou MOV."},{status:400});
  const name=randomUUID()+TYPES.get(file.type);
  const bytes=Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(directory,name),bytes,{flag:"wx"});
  uploaded.push({name,localUrl:"/api/social/media/"+name,publicUrl:null,size:file.size,type:file.type,storageError:""});

 }
 return NextResponse.json({files:uploaded});
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:500})}
}
