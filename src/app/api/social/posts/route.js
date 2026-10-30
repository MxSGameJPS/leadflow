import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {validateSocialPost} from "../../../../services/social/publisher.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reject=(error,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 if(process.env.NODE_ENV==="production")return reject("Disponível apenas no LeadFlow local.",403);
 const posts=await prisma.socialPost.findMany({orderBy:{createdAt:"desc"},take:300});
 return NextResponse.json({posts});
}
export async function POST(request){
 if(process.env.NODE_ENV==="production")return reject("Disponível apenas no LeadFlow local.",403);
 try{
 const body=await request.json();
 const title=String(body.title||"").trim().slice(0,140),caption=String(body.caption||"").trim().slice(0,2200);
 const mediaType=String(body.mediaType||"image");
 const platforms=Array.isArray(body.platforms)?body.platforms.filter(x=>["facebook","instagram"].includes(x)):[];
 const media=Array.isArray(body.media)?body.media.map(x=>String(x).trim()).filter(Boolean):[];
 if(!title||!caption||!platforms.length)return reject("Informe título, legenda e pelo menos uma plataforma.");
 const candidate={mediaType,mediaJson:JSON.stringify(media),platformsJson:JSON.stringify([...new Set(platforms)]),caption};
 validateSocialPost(candidate);
 const post=await prisma.socialPost.create({data:{title,...candidate,status:"draft"}});
 return NextResponse.json({post},{status:201});
 }catch(e){return reject(e.message)}
}
