import sharp from "sharp";
import {randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {generateResilientWithDefaultProvider} from "../ai/providerService.js";

const escapeXml=value=>String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const trim=(v,n)=>String(v||"").trim().slice(0,n);
function wrap(value,max=26,limit=4){
 const words=String(value||"").split(/\s+/).filter(Boolean),lines=[];let line="";
 for(const word of words){if((line+" "+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+" "+word).trim()}
 if(line)lines.push(line);
 return lines.slice(0,limit);
}
export function normalizeCreativePlan(raw,{format,topic}){
 const source=raw&&typeof raw==="object"?raw:{};
 const count=format==="carousel"?Math.max(2,Math.min(6,Number(source.slides?.length)||5)):1;
 const slides=Array.from({length:count},(_,i)=>{
  const item=Array.isArray(source.slides)?source.slides[i]||{}:{};
  return {headline:trim(item.headline|| (i===0?topic:"Uma presença digital que facilita o contato"),95),body:trim(item.body||"Ajude seus clientes a encontrar informações e falar com você.",180),cta:trim(item.cta||(i===count-1?"Converse comigo":"Saiba mais"),55)};
 });
 return {slides,caption:trim(source.caption||"",2200)};
}
function svgSlide(slide,index,total){
 const headline=wrap(slide.headline,22,4),body=wrap(slide.body,38,5);
 const head=headline.map((s,i)=>`<text x="90" y="${350+i*90}" font-family="Arial,sans-serif" font-size="77" font-weight="bold" fill="#f7f4ed">${escapeXml(s)}</text>`).join("");
 const base=350+headline.length*90+65;
 const details=body.map((s,i)=>`<text x="90" y="${base+i*49}" font-family="Arial,sans-serif" font-size="36" fill="#e5dfd2">${escapeXml(s)}</text>`).join("");
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
 <rect width="1080" height="1350" fill="#141414"/>
 <rect x="0" y="0" width="1080" height="18" fill="#c6a76a"/>
 <text x="90" y="132" font-family="Arial,sans-serif" font-size="31" font-weight="bold" fill="#c6a76a">SAULO PAVANELLO  /  SITES E SISTEMAS</text>
 <text x="90" y="234" font-family="Arial,sans-serif" font-size="28" fill="#d5d0c8">PRESENÇA DIGITAL PARA NEGÓCIOS</text>
 ${head}${details}
 <rect x="90" y="1075" width="900" height="116" rx="12" fill="#c6a76a"/>
 <text x="125" y="1148" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="#161616">${escapeXml(trim(slide.cta,44))}</text>
 <text x="90" y="1275" font-family="Arial,sans-serif" font-size="27" fill="#b8b0a2">www.saulopavanello.com.br</text>
 <text x="940" y="1275" text-anchor="end" font-family="Arial,sans-serif" font-size="25" fill="#b8b0a2">${index+1}/${total}</text>
 </svg>`;
}
export function parseCreativePlan(text){
 const raw=String(text||"").trim().replace(/^\uFEFF/,"");
 const candidates=[raw,...[...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(match=>match[1].trim())];
 const start=raw.indexOf("{"),end=raw.lastIndexOf("}");
 if(start>=0&&end>start)candidates.push(raw.slice(start,end+1));
 for(const candidate of candidates){
  try{
   const value=JSON.parse(candidate);
   if(value&&typeof value==="object"&&!Array.isArray(value)&&Array.isArray(value.slides)&&value.slides.length>0)return value;
  }catch{}
 }
 throw Error("A IA não retornou JSON válido com slides.");
}
export async function generateSocialCreative({topic,format="image",goal="autoridade e contatos"}){
 const subject=trim(topic,180);if(subject.length<5)throw Error("Informe um tema com pelo menos 5 caracteres.");
 if(!["image","carousel"].includes(format))throw Error("Formato inválido.");
 const count=format==="carousel"?5:1;
 const result=await generateResilientWithDefaultProvider({
  systemPrompt:`Você é diretor de arte e estrategista de conteúdo de Saulo Pavanello, desenvolvedor de sites e sistemas. Gere somente JSON válido, sem Markdown, no formato {"caption":"legenda com CTA e até 5 hashtags","slides":[{"headline":"título curto","body":"texto curto e útil","cta":"chamada curta"}]}. Produza exatamente ${count} slides, com narrativa coerente, títulos de até 65 caracteres, textos de até 125 caracteres e CTA de até 36 caracteres. Português brasileiro natural. Não invente métricas, clientes, depoimentos ou promessas de resultado. Para carrossel: capa, problema, insight, solução e CTA. Não repita o mesmo texto em todos os slides.`,
  prompt:JSON.stringify({topic:subject,format,goal:trim(goal,120)}),disableTools:true,timeoutMs:60000,retries:1,maxTokens:1700
 });
 let parsed;
 try{parsed=parseCreativePlan(result.text)}catch{
  const repair=await generateResilientWithDefaultProvider({
   systemPrompt:"Você corrige formatos JSON. Responda somente com um objeto JSON válido contendo caption (string) e slides (array de objetos com headline, body, cta). Não inclua Markdown nem comentários. Não invente informações.",
   prompt:JSON.stringify({expectedSlides:count,originalResponse:String(result.text||"").slice(0,9000),topic:subject}),disableTools:true,timeoutMs:45000,retries:0,maxTokens:2000
  });
  parsed=parseCreativePlan(repair.text);
 }
 const plan=normalizeCreativePlan(parsed,{format,topic:subject});
 const directory=path.join(process.cwd(),"data","social-media");
 await fs.mkdir(directory,{recursive:true});
 const files=[];
 for(let i=0;i<plan.slides.length;i++){
  const name=randomUUID()+".png";
  await sharp(Buffer.from(svgSlide(plan.slides[i],i,plan.slides.length))).png().toFile(path.join(directory,name));
  files.push({name,localUrl:"/api/social/media/"+name,publicUrl:null,type:"image/png"});
 }
 return {files,caption:plan.caption,slides:plan.slides};
}
