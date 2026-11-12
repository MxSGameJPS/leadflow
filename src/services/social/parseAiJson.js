export function parseSocialJson(text,{array=false}={}){
 const raw=String(text??"").trim().replace(/^\uFEFF/,"").replace(/<think>[\s\S]*?<\/think>/gi,"").trim();
 const candidates=[raw,...[...raw.matchAll(/(?:```|~~~)(?:json)?\s*([\s\S]*?)\s*(?:```|~~~)/gi)].map(m=>m[1].trim())];
 const open=array?"[":"{",close=array?"]":"}";
 const start=raw.indexOf(open),end=raw.lastIndexOf(close);
 if(start>=0&&end>start)candidates.push(raw.slice(start,end+1));
 for(const candidate of candidates){
  try{
   const parsed=JSON.parse(candidate);
   if(array?Array.isArray(parsed):parsed&&typeof parsed==="object"&&!Array.isArray(parsed))return parsed;
  }catch{}
 }
 throw Error(array?"A IA não retornou um calendário JSON válido.":"A IA não retornou JSON válido para o post.");
}
