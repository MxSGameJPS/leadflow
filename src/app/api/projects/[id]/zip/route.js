import { getSiteProject } from "../../../../../services/projects/projectStore.js";
import { createProjectZip } from "../../../../../services/projects/zipProject.js";
export const dynamic="force-dynamic";
function fileName(value){return String(value||"site").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"site"}
export async function GET(_request,{params}){try{const{id}=await params;const project=await getSiteProject(id);const zip=await createProjectZip(project.folderPath);return new Response(zip,{headers:{"Content-Type":"application/zip","Content-Disposition":'attachment; filename="'+fileName(project.name)+'.zip',"Cache-Control":"no-store"}})}catch(error){return Response.json({error:error.message||"Não foi possível gerar o ZIP."},{status:404})}}
