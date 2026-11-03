import {NextResponse} from "next/server";
import {readSocialPermissions,saveSocialPermissions} from "../../../../services/social/permissionsStore.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reject=(error,status=400)=>NextResponse.json({error},{status});
export async function GET(){
 if(process.env.NODE_ENV==="production")return reject("Somente ambiente local.",403);
 try{return NextResponse.json({permissions:await readSocialPermissions()})}catch{return reject("Não foi possível carregar as permissões.",500)}
}
export async function PUT(request){
 if(process.env.NODE_ENV==="production")return reject("Somente ambiente local.",403);
 try{
  const input=await request.json();
  if(!input||typeof input!=="object"||Array.isArray(input)||!input.permissions||typeof input.permissions!=="object"||Array.isArray(input.permissions))return reject("Formato inválido.");
  return NextResponse.json({permissions:await saveSocialPermissions(input.permissions)});
 }catch(error){return reject(String(error.message||"Erro ao salvar.").slice(0,180),400)}
}
