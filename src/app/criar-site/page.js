import { listLeads } from "../../repositories/leadRepository.js";
import { findLatestSiteProjectByLead,getSiteProject } from "../../services/projects/projectStore.js";
import SiteCreatorStart from "../../components/SiteCreatorStart/SiteCreatorStart.jsx";
export const dynamic="force-dynamic";
export default async function CreateSitePage({searchParams}){const params=await searchParams;const leads=await listLeads();const initialLeadId=String(params?.lead||"");let project=null;if(params?.project){try{project=await getSiteProject(String(params.project))}catch{project=null}}else if(initialLeadId){project=await findLatestSiteProjectByLead(initialLeadId)}return <SiteCreatorStart leads={leads} initialLeadId={initialLeadId} project={project}/>}
