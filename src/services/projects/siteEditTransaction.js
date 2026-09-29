import fs from "node:fs/promises";

export async function snapshotFiles(paths=[]){
  const snapshot=new Map();
  for(const filePath of [...new Set(paths.filter(Boolean))]){
    try{snapshot.set(filePath,{exists:true,content:await fs.readFile(filePath)})}
    catch(error){if(error?.code==="ENOENT")snapshot.set(filePath,{exists:false,content:null});else throw error}
  }
  return snapshot;
}
export async function restoreFiles(snapshot){
  const failures=[];
  for(const [filePath,state] of snapshot.entries()){
    try{
      if(state.exists)await fs.writeFile(filePath,state.content);
      else await fs.rm(filePath,{force:true});
    }catch(error){failures.push(filePath+": "+(error?.message||error))}
  }
  return {ok:failures.length===0,failures};
}
export async function withFileTransaction(paths,operation){
  const snapshot=await snapshotFiles(paths);
  try{return await operation()}
  catch(error){
    const rollback=await restoreFiles(snapshot);
    if(!rollback.ok){
      const detail=rollback.failures.join(" | ");
      throw new Error((error?.message||String(error))+" | Falha adicional ao restaurar arquivos: "+detail,{cause:error});
    }
    throw error;
  }
}
