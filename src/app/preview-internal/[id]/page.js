import { notFound } from "next/navigation";
import { getSiteProject } from "../../../services/projects/projectStore.js";
import SitePreview from "../../../components/SitePreview/SitePreview.jsx";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false,nocache:true}};
export default async function InternalPreviewPage({params}){const{id}=await params;let project;try{project=await getSiteProject(id)}catch{notFound()}if(!project?.siteData)notFound();return <SitePreview project={project}/>}
