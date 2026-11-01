import {NextResponse} from "next/server";
import {prisma} from "../../../../lib/prisma.js";
import {readSocialPermissions} from "../../../../services/social/permissionsStore.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const deny=()=>process.env.NODE_ENV==="production";
const fail=(error,status=400)=>NextResponse.json({error},{status});
const safe=(v,max=250)=>String(v??"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,max);
export async function GET(){
 if(deny())return fail("Acesso disponível somente no ambiente local.",403);
 const leads=await prisma.lead.findMany({where:{externalId:{startsWith:"social:"}},select:{id:true,name:true,source:true,stage:true,externalId:true,createdAt:true},orderBy:{createdAt:"desc"},take:200});
 const grouped={instagram:0,facebook:0};
 for(const lead of leads){if(lead.source==="social_instagram")grouped.instagram++;if(lead.source==="social_facebook")grouped.facebook++;}
 const full=await prisma.lead.findMany({where:{externalId:{startsWith:"social:"}},select:{source:true,notes:true}});
 const campaigns={};for(const lead of full){const tag=lead.notes.match(/^Campanha UTM: ([a-z0-9_-]+)$/m);if(tag)campaigns[tag[1]]=(campaigns[tag[1]]||0)+1;}
 return NextResponse.json({leads,counts:grouped,total:full.length,campaigns:Object.entries(campaigns).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),note:full.length>200?"Exibindo os 200 registros mais recentes; contadores incluem todos.":null});
}
export async function POST(request){
 if(deny())return fail("Acesso disponível somente no ambiente local.",403);
 const permissions=await readSocialPermissions();if(!permissions.crmRegistration)return fail("Registro de oportunidades desativado nas permissões do agente.",403);
 let input;try{input=await request.json()}catch{return fail("JSON inválido.");}
 const platform=safe(input.platform,20),kind=safe(input.kind,20),interactionId=safe(input.interactionId,120);
 if(!["instagram","facebook"].includes(platform)||!["comment","dm"].includes(kind)||!/^[A-Za-z0-9_:-]{1,120}$/.test(interactionId))return fail("Origem da interação inválida.");
 if(input.confirmation!=="CRIAR_LEAD")return fail("Confirmação obrigatória.");
 const name=safe(input.name,120),text=safe(input.text,1500),authorId=safe(input.authorId,120);
 const campaign=safe(input.campaign,90).toLowerCase(),contentId=safe(input.contentId,90).toLowerCase();
 if((campaign&&!/^[a-z0-9_-]+$/.test(campaign))||(contentId&&!/^[a-z0-9_-]+$/.test(contentId)))return fail("Campanha ou publicação inválida.");
 if(name.length<2)return fail("Informe um nome de pelo menos dois caracteres.");
 const externalId=`social:${platform}:${kind}:${interactionId}`;
 const existing=await prisma.lead.findUnique({where:{externalId},select:{id:true,name:true,stage:true}});
 if(existing)return NextResponse.json({ok:true,created:false,lead:existing});
 const notes=[`Origem: ${platform} / ${kind}`,`Interação: ${interactionId}`,authorId?`Identificador do autor: ${authorId}`:"",campaign?`Campanha UTM: ${campaign}`:"",contentId?`Conteúdo UTM: ${contentId}`:"",text?`Texto recebido: ${text}`:"","Oportunidade registrada manualmente; intenção comercial ainda deve ser qualificada."].filter(Boolean).join("\n");
 try{
 const lead=await prisma.lead.create({data:{externalId,name,source:`social_${platform}`,stage:"novo",notes,weakSite:false},select:{id:true,name:true,stage:true}});
 return NextResponse.json({ok:true,created:true,lead},{status:201});
 }catch(error){
 if(error.code==="P2002"){const lead=await prisma.lead.findUnique({where:{externalId},select:{id:true,name:true,stage:true}});return NextResponse.json({ok:true,created:false,lead});}
 return fail("Falha ao registrar oportunidade no CRM.",500);
 }
}
