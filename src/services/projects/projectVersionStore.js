import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectFolder } from "./projectStore.js";

const ROOT=path.join(process.cwd(),"data","project-versions");
const SOURCE_DIRS=["app","components","data","lib"];
const SOURCE_FILES=["package.json","next.config.mjs","README.md","generation-format.json","generation-report.json","builder-report.json","director-plan.json","public/leadflow-inspector.js",".gitignore"];
const MAX_SNAPSHOTS=8;

function safe(value){const text=String(value||"").trim();if(!/^[a-zA-Z0-9_-]+$/.test(text))throw new Error("Identificador de projeto inválido.");return text}
function snapshotRoot(projectId){return path.join(ROOT,safe(projectId))}
function snapshotDir(projectId,version){return path.join(snapshotRoot(projectId),"v"+Math.max(1,Number(version)||1))}
async function exists(target){try{await fs.access(target);return true}catch{return false}}
async function copyIfExists(source,target){
  if(!await exists(source))return;
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.cp(source,target,{recursive:true,force:true});
}
async function snapshotVersions(projectId){
  try{
    const names=await fs.readdir(snapshotRoot(projectId),{withFileTypes:true});
    return names.filter(item=>item.isDirectory()&&/^v\d+$/.test(item.name)).map(item=>Number(item.name.slice(1))).sort((a,b)=>b-a);
  }catch(error){if(error?.code==="ENOENT")return[];throw error}
}
async function trimSnapshots(projectId){
  const versions=await snapshotVersions(projectId);
  for(const version of versions.slice(MAX_SNAPSHOTS))await fs.rm(snapshotDir(projectId,version),{recursive:true,force:true});
}
export async function createProjectSourceSnapshot(project){
  if(!project?.id||!project?.folderPath)return null;
  const source=resolveProjectFolder(project.folderPath);
  if(!source)return null;
  const target=snapshotDir(project.id,project.version||1);
  await fs.rm(target,{recursive:true,force:true});
  await fs.mkdir(target,{recursive:true});
  for(const name of SOURCE_DIRS)await copyIfExists(path.join(source,name),path.join(target,name));
  for(const name of SOURCE_FILES)await copyIfExists(path.join(source,name),path.join(target,name));
  const metadata={
    projectId:project.id,
    sourceVersion:Number(project.version||1),
    createdAt:new Date().toISOString(),
    project:{
      warning:project.warning||null,
      imageCount:Number(project.imageCount||0),
      aiUsed:Boolean(project.aiUsed),
      siteData:project.siteData||null,
      generatorInput:project.generatorInput||null,
      instructions:Array.isArray(project.instructions)?project.instructions:[],
      effects:Array.isArray(project.effects)?project.effects:[],
      skillMode:project.skillMode||"auto",
      skills:Array.isArray(project.skills)?project.skills:[],
      referenceScope:project.referenceScope||null,
      referenceImages:Array.isArray(project.referenceImages)?project.referenceImages:[],
    },
  };
  await fs.writeFile(path.join(target,"snapshot.json"),JSON.stringify(metadata,null,2),"utf8");
  await trimSnapshots(project.id);
  return metadata;
}
export async function countProjectSnapshots(projectId){return(await snapshotVersions(projectId)).length}
export async function restoreLatestProjectSourceSnapshot(project){
  if(!project?.id||!project?.folderPath)throw new Error("Projeto sem pasta gerada.");
  const versions=await snapshotVersions(project.id);
  if(!versions.length)throw new Error("Não existe versão anterior para restaurar.");
  const version=versions[0],source=snapshotDir(project.id,version),target=resolveProjectFolder(project.folderPath);
  if(!target)throw new Error("Projeto sem pasta gerada.");
  const metadata=JSON.parse(await fs.readFile(path.join(source,"snapshot.json"),"utf8"));
  for(const name of SOURCE_DIRS){
    await fs.rm(path.join(target,name),{recursive:true,force:true});
    await copyIfExists(path.join(source,name),path.join(target,name));
  }
  for(const name of SOURCE_FILES){
    await fs.rm(path.join(target,name),{recursive:true,force:true});
    await copyIfExists(path.join(source,name),path.join(target,name));
  }
  await fs.rm(path.join(target,".next"),{recursive:true,force:true});
  await fs.rm(path.join(target,".leadflow-build"),{recursive:true,force:true});
  await fs.rm(source,{recursive:true,force:true});
  return metadata;
}
