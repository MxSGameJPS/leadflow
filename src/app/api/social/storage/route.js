import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {r2Settings} from "../../../../services/social/r2Storage.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 if(process.env.NODE_ENV==="production")return NextResponse.json({error:"Apenas ambiente local"},{status:403});
 const {ready,publicUrl,bucket}=r2Settings();
 const [pending,cleaned,failed]=await Promise.all([
  prisma.socialPost.count({where:{status:"published",r2CleanedAt:null}}),
  prisma.socialPost.count({where:{r2CleanedAt:{not:null}}}),
  prisma.socialPost.count({where:{r2CleanupError:{not:""}}})
 ]);
 return NextResponse.json({ready,bucket:ready?bucket:null,publicUrl:ready?publicUrl:null,pending,cleaned,failed,retentionHours:24});
}
