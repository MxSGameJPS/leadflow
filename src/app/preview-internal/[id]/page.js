import { notFound } from "next/navigation";
import { getSiteProject } from "../../../services/projects/projectStore.js";
import { ensureProjectPreviewServer } from "../../../services/projects/previewServer.js";
import { isUniqueCodegenProject } from "../../../services/projects/siteCodegenV4.js";
import SitePreview from "../../../components/SitePreview/SitePreview.jsx";

export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false,nocache:true}};

export default async function InternalPreviewPage({params}){
  const{id}=await params;
  let project;
  try{project=await getSiteProject(id)}catch{notFound()}
  if(!project?.siteData)notFound();
  let previewUrl="";
  if(project.folderPath&&await isUniqueCodegenProject(project.folderPath)){
    try{previewUrl=(await ensureProjectPreviewServer(project.folderPath)).url}catch(error){
      return <SitePreview project={project} previewError={error.message}/>;
    }
  }
  return <SitePreview project={project} previewUrl={previewUrl}/>;
}
