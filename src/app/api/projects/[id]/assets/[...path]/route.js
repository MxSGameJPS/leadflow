import fs from "node:fs/promises";
import path from "node:path";
import { getSiteProject,resolveProjectFolder } from "../../../../../../services/projects/projectStore.js";
export const dynamic="force-dynamic";
const TYPES={".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif",".svg":"image/svg+xml"};
export async function GET(_request,{params}){try{const values=await params;const project=await getSiteProject(values.id);const root=resolveProjectFolder(project.folderPath);const publicRoot=path.resolve(root,"public");const relative=(values.path||[]).map(item=>String(item)).join("/");const target=path.resolve(publicRoot,relative);if(!target.startsWith(publicRoot+path.sep))throw new Error("Arquivo inválido.");return new Response(await fs.readFile(target),{headers:{"Content-Type":TYPES[path.extname(target).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"}})}catch{return new Response("Not found",{status:404})}}
