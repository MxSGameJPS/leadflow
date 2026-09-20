"use server";
import { revalidatePath } from "next/cache";
import { getLead,setLanding } from "../../repositories/leadRepository.js";
import { createSiteProject,deleteSiteProject,getSiteProject,updateSiteProject } from "../../services/projects/projectStore.js";
import { generateSiteFolder } from "../../services/projects/siteGeneratorV2.js";
import { normalizeSiteSkillIds,normalizeSiteSkillMode } from "../../services/projects/siteSkills.js";
import { collectLeadAssetUrls } from "../../services/projects/assetCollector.js";
import { clearReferenceImages,listReferenceImages,saveReferenceImages } from "../../services/projects/referenceImageStore.js";

const DEFAULT_EFFECTS=["entrance-motion","section-reveal","hover-lift"];
const VALID_EFFECTS=new Set(["entrance-motion","section-reveal","parallax-hero","glass-header","hover-lift","ambient-glow","cta-pulse","smooth-scroll"]);
function normalizeEffects(value,fallback=DEFAULT_EFFECTS){if(!Array.isArray(value))return[...fallback];return[...new Set(value.map(item=>String(item||"").trim()).filter(item=>VALID_EFFECTS.has(item)))]}
function sameList(a=[],b=[]){return JSON.stringify([...a].sort())===JSON.stringify([...b].sort())}
function refreshProject(project){revalidatePath("/projetos");revalidatePath("/criar-site");revalidatePath("/preview-internal/"+project.id);if(project.leadId)revalidatePath("/crm/"+project.leadId)}
function leadDescription(lead){return[lead?.problem,lead?.offer,lead?.bio,lead?.instagram?"Instagram do negócio: "+lead.instagram:""].filter(Boolean).join("\n")}
function referenceScopeFor(projectOrLead){if(projectOrLead?.referenceScope)return projectOrLead.referenceScope;if(projectOrLead?.leadId)return"lead:"+projectOrLead.leadId;if(projectOrLead?.id)return"lead:"+projectOrLead.id;return""}
function generatorInputFor({lead,input,mode,assetUrls=[],effects=[],skillMode="auto",skills=[]}){return{name:lead?.name||String(input.name||"").trim(),segment:lead?.segment||input.segment,city:lead?.city||lead?.location||input.city,address:lead?.address||"",phone:lead?.phone||lead?.whatsapp||"",placeId:lead?.externalId||"",mapsLink:lead?.mapsLink||(mode==="google"?input.source:""),existingWebsite:lead?.site||"",instagram:lead?.instagram||"",rating:lead?.googleRating||"",reviews:lead?.googleReviews||"",description:mode==="lead"?leadDescription(lead):input.source,template:input.template||"landing",assetUrls,effects,skillMode,skills}}

export async function createSiteProjectAction(input={}){
  const mode=["lead","describe","google"].includes(input.mode)?input.mode:"lead";let lead=null;
  if(mode==="lead"){lead=await getLead(String(input.leadId||""));if(!lead)throw new Error("Selecione um lead existente.")}
  const name=lead?.name||String(input.name||"").trim();if(!name)throw new Error("Informe o nome do negócio.");
  const effects=normalizeEffects(input.effects);
  const skillMode=normalizeSiteSkillMode(input.skillMode);
  const skills=normalizeSiteSkillIds(input.skills);
  const referenceScope=lead?"lead:"+lead.id:"draft:"+name;
  if(Array.isArray(input.referenceImages)&&input.referenceImages.length)await saveReferenceImages(referenceScope,input.referenceImages);
  const references=await listReferenceImages(referenceScope,{withData:true});
  const generatorInput=generatorInputFor({lead,input,mode,assetUrls:lead?await collectLeadAssetUrls(lead):[],effects,skillMode,skills});
  const instruction=String(input.instruction||"").trim();
  const generated=await generateSiteFolder({...generatorInput,instruction,referenceImages:references});
  const project=await createSiteProject({leadId:lead?.id||null,name,segment:generatorInput.segment,city:generatorInput.city,mode,source:mode==="lead"?(lead?.instagram||lead?.site||lead?.mapsLink||lead?.problem||"Dados do CRM"):input.source,template:generatorInput.template,status:"ready",folderPath:generated.folderPath,aiUsed:generated.aiUsed,warning:generated.warning,imageCount:generated.imageCount,siteData:generated.siteData,generatorInput:{...generatorInput,skillMode:generated.skillMode,skills:generated.skills},instructions:instruction?[instruction]:["Gerar landing page premium usando os dados verificados deste lead."],version:1,effects,skillMode:generated.skillMode,skills:generated.skills,referenceScope,referenceImages:references});
  if(lead)await setLanding(lead.id,"done");refreshProject(project);return project;
}

export async function refineSiteProjectAction(input={}){
  const project=await getSiteProject(String(input.projectId||""));
  const instruction=String(input.instruction||"").trim();
  const effects=normalizeEffects(input.effects,project.effects||[]);
  const skillMode=normalizeSiteSkillMode(input.skillMode??project.skillMode);
  const skills=normalizeSiteSkillIds(input.skills??project.skills);
  const referenceScope=referenceScopeFor(project);
  const newReferences=Array.isArray(input.referenceImages)?input.referenceImages:[];
  if(newReferences.length)await saveReferenceImages(referenceScope,newReferences);
  const references=await listReferenceImages(referenceScope,{withData:true});
  const effectsChanged=!sameList(effects,project.effects||[]);
  const skillsChanged=skillMode!==project.skillMode||(skillMode==="manual"&&!sameList(skills,project.skills||[]));
  if(!instruction&&!newReferences.length&&!effectsChanged&&!skillsChanged)throw new Error("Descreva uma alteração, envie uma referência, mude os efeitos ou ajuste as skills.");
  let generatorInput={...(project.generatorInput||{}),effects,skillMode,skills};
  if(project.leadId){const lead=await getLead(project.leadId);if(!lead)throw new Error("O lead vinculado a este projeto não foi encontrado.");generatorInput=generatorInputFor({lead,input:{template:project.template},mode:"lead",assetUrls:await collectLeadAssetUrls(lead),effects,skillMode,skills})}
  const generated=await generateSiteFolder({...generatorInput,folderPath:project.folderPath,existingSiteData:project.siteData,instruction,referenceImages:references,skipAi:!instruction&&!newReferences.length&&!effectsChanged&&!skillsChanged});
  const updated=await updateSiteProject(project.id,{status:"ready",aiUsed:generated.aiUsed||project.aiUsed,warning:generated.warning,imageCount:generated.imageCount,siteData:generated.siteData,generatorInput:{...generatorInput,skillMode:generated.skillMode,skills:generated.skills},instructions:instruction?[...(project.instructions||[]),instruction]:(project.instructions||[]),version:Number(project.version||1)+1,effects,skillMode:generated.skillMode,skills:generated.skills,referenceScope,referenceImages:references});
  refreshProject(updated);return updated;
}

export async function clearSiteReferenceImagesAction(projectId){
  const project=await getSiteProject(String(projectId||""));const scope=referenceScopeFor(project);
  if(scope)await clearReferenceImages(scope);
  const updated=await updateSiteProject(project.id,{referenceImages:[]});refreshProject(updated);return updated;
}

export async function deleteSiteProjectAction(id){const project=await deleteSiteProject(String(id||""));revalidatePath("/projetos");revalidatePath("/criar-site");if(project.leadId)revalidatePath("/crm/"+project.leadId);return{id:project.id}}