import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const stamp=Date.now()+"_"+Math.random().toString(16).slice(2);
const folder="generated-sites/checkpoint-"+stamp;
const root=path.join(process.cwd(),folder);
const project={id:"checkpoint_"+stamp,folderPath:folder,version:1,siteData:{brandName:"Teste"},generatorInput:{name:"Teste"},instructions:["Inicial"],effects:[],skillMode:"auto",skills:[],referenceImages:[]};

const { createProjectSourceSnapshot, countProjectSnapshots, restoreLatestProjectSourceSnapshot } = await import("../src/services/projects/projectVersionStore.js");

try{
  await fs.mkdir(path.join(root,"app"),{recursive:true});
  await fs.mkdir(path.join(root,"data"),{recursive:true});
  await fs.writeFile(path.join(root,"app","state.txt"),"v1","utf8");
  await createProjectSourceSnapshot(project);
  assert.equal(await countProjectSnapshots(project.id),1);
  await fs.writeFile(path.join(root,"app","state.txt"),"v2","utf8");
  const restored=await restoreLatestProjectSourceSnapshot(project);
  assert.equal(restored.sourceVersion,1);
  assert.equal(await fs.readFile(path.join(root,"app","state.txt"),"utf8"),"v1");
  assert.equal(await countProjectSnapshots(project.id),0);
  console.log("Testes de checkpoints passaram.");
}finally{
  await fs.rm(root,{recursive:true,force:true});
  await fs.rm(path.join(process.cwd(),"data","project-versions",project.id),{recursive:true,force:true});
}
