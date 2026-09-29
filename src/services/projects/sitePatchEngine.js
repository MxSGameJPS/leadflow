function clean(value,max=300000){return String(value??"").replace(/\u0000/g,"").slice(0,max)}
function normalizePath(value){
  let out=String(value||"").trim().replace(/^["']|["']$/g,"").replace(/\\/g,"/");
  out=out.split("\t")[0].trim();
  if(out.startsWith("a/")||out.startsWith("b/"))out=out.slice(2);
  if(!out||out==="/dev/null"||out.startsWith("/")||out.split("/").includes(".."))throw new Error("Caminho de diff inválido: "+out);
  return out;
}
function diffBody(text){
  const raw=clean(text).replace(/^\uFEFF/,"");
  const blocks=[...raw.matchAll(/```(?:diff|patch)?\s*\n([\s\S]*?)```/gi)].map(match=>match[1].trim()).filter(Boolean);
  if(blocks.length)return blocks.join("\n");
  const start=raw.search(/^---\s+/m);
  return start>=0?raw.slice(start).trim():raw.trim();
}
function parseCount(value,fallback){const parsed=Number.parseInt(String(value??""),10);return Number.isFinite(parsed)?parsed:fallback}
export function parseUnifiedDiff(text){
  const body=diffBody(text);
  if(!body)throw new Error("A IA não retornou um diff.");
  const lines=body.replace(/\r\n/g,"\n").split("\n"),files=[];
  let i=0;
  while(i<lines.length){
    if(!lines[i].startsWith("--- ")){i++;continue}
    const oldPath=normalizePath(lines[i].slice(4));
    i++;
    if(i>=lines.length||!lines[i].startsWith("+++ "))throw new Error("Diff sem cabeçalho +++ após "+oldPath+".");
    const newPath=normalizePath(lines[i].slice(4));
    i++;
    const file={oldPath,newPath,hunks:[]};
    while(i<lines.length&&!lines[i].startsWith("--- ")){
      if(!lines[i].startsWith("@@ ")){if(lines[i].trim()){throw new Error("Linha fora de hunk em "+newPath+": "+lines[i].slice(0,120))}i++;continue}
      const match=lines[i].match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if(!match)throw new Error("Cabeçalho de hunk inválido em "+newPath+": "+lines[i]);
      const hunk={oldStart:Number(match[1]),oldCount:parseCount(match[2],1),newStart:Number(match[3]),newCount:parseCount(match[4],1),lines:[]};
      i++;
      while(i<lines.length&&!lines[i].startsWith("@@ ")&&!lines[i].startsWith("--- ")){
        const line=lines[i];
        if(line.startsWith("\\ No newline at end of file")){i++;continue}
        const prefix=line[0];
        if(![" ","+","-"].includes(prefix))throw new Error("Linha inválida no hunk de "+newPath+": "+line.slice(0,120));
        hunk.lines.push({type:prefix,text:line.slice(1)});
        i++;
      }
      const oldActual=hunk.lines.filter(line=>line.type!=="+" ).length;
      const newActual=hunk.lines.filter(line=>line.type!=="-" ).length;
      if(oldActual!==hunk.oldCount||newActual!==hunk.newCount)throw new Error("Contagem de linhas inconsistente no hunk de "+newPath+".");
      if(!hunk.lines.some(line=>line.type==="+"||line.type==="-"))throw new Error("Hunk sem alteração em "+newPath+".");
      file.hunks.push(hunk);
    }
    if(!file.hunks.length)throw new Error("Diff sem hunks para "+newPath+".");
    files.push(file);
  }
  if(!files.length)throw new Error("Nenhum diff unificado reconhecível foi encontrado.");
  return files;
}
function linesOf(content){
  const normalized=String(content??"").replace(/\r\n/g,"\n");
  const finalNewline=normalized.endsWith("\n");
  const lines=normalized.split("\n");
  if(finalNewline)lines.pop();
  return{lines,finalNewline};
}
function sameSequence(lines,start,sequence,normalize=false){
  if(start<0||start+sequence.length>lines.length)return false;
  for(let index=0;index<sequence.length;index++){
    const a=lines[start+index],b=sequence[index];
    if(normalize){if(a.trimEnd()!==b.trimEnd())return false}
    else if(a!==b)return false;
  }
  return true;
}
function locateSequence(lines,sequence,expected){
  if(!sequence.length)return Math.max(0,Math.min(lines.length,expected));
  if(sameSequence(lines,expected,sequence,false))return expected;
  const exact=[];
  for(let index=0;index<=lines.length-sequence.length;index++)if(sameSequence(lines,index,sequence,false))exact.push(index);
  if(exact.length)return exact.sort((a,b)=>Math.abs(a-expected)-Math.abs(b-expected))[0];
  const relaxed=[];
  for(let index=0;index<=lines.length-sequence.length;index++)if(sameSequence(lines,index,sequence,true))relaxed.push(index);
  if(relaxed.length===1)return relaxed[0];
  return -1;
}
function applyHunks(content,hunks,pathName){
  const state=linesOf(content),lines=[...state.lines];
  let delta=0,changed=0;
  for(const hunk of hunks){
    const before=hunk.lines.filter(line=>line.type!=="+").map(line=>line.text);
    const after=hunk.lines.filter(line=>line.type!=="-").map(line=>line.text);
    const expected=Math.max(0,hunk.oldStart-1+delta);
    const position=locateSequence(lines,before,expected);
    if(position<0)throw new Error("Não foi possível localizar o trecho original do hunk em "+pathName+". Refaça o diff usando linhas exatamente presentes no arquivo atual.");
    lines.splice(position,before.length,...after);
    delta+=after.length-before.length;
    changed+=hunk.lines.filter(line=>line.type==="+"||line.type==="-").length;
  }
  return{content:lines.join("\n")+(state.finalNewline?"\n":""),changed};
}
export function applyUnifiedDiff(files,diffText,allowedPaths=[]){
  const source=files&&typeof files==="object"?files:{};
  const allowed=new Set((allowedPaths||Object.keys(source)).map(normalizePath));
  const next={...source},changedPaths=[];
  let changedLines=0;
  for(const patch of parseUnifiedDiff(diffText)){
    if(patch.oldPath!==patch.newPath)throw new Error("Renomear arquivos não é permitido no refinamento direcionado.");
    const filePath=patch.newPath;
    if(!allowed.has(filePath))throw new Error("O diff tentou alterar arquivo fora do escopo: "+filePath);
    if(!Object.prototype.hasOwnProperty.call(next,filePath))throw new Error("Arquivo do diff não existe no escopo atual: "+filePath);
    const result=applyHunks(next[filePath],patch.hunks,filePath);
    if(result.content!==next[filePath]){
      next[filePath]=result.content;
      changedPaths.push(filePath);
      changedLines+=result.changed;
    }
  }
  if(!changedPaths.length)throw new Error("O diff não produziu nenhuma alteração.");
  return{files:next,changedPaths:[...new Set(changedPaths)],changedLines};
}
