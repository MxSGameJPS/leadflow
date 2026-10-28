import {prisma} from "../../lib/prisma.js";
import {listLeads} from "../../repositories/leadRepository.js";
import CaptureControl from "../../components/CaptureControl/CaptureControl.jsx";
import CaptureOperations from "../../components/CaptureOperations/CaptureOperations.jsx";
export const dynamic="force-dynamic";
export default async function Page(){
 const sessionId=process.env.OPENWA_SESSION_ID||"";
 const [approvals,leads]=await Promise.all([
  prisma.captureApproval.findMany({where:{sessionId},orderBy:[{approvedAt:"asc"},{createdAt:"asc"}]}),
  listLeads()
 ]);
 const byLead=new Map(leads.map(lead=>[lead.id,lead]));
 const items=approvals.map(a=>({id:a.id,leadId:a.leadId,name:byLead.get(a.leadId)?.name||"Lead não encontrado",phone:a.chatId,message:a.messageText,status:a.status,approvedAt:a.approvedAt?.toISOString()||null,sentAt:a.sentAt?.toISOString()||null,updatedAt:a.updatedAt?.toISOString()||null,leadStage:byLead.get(a.leadId)?.stage||""}));
 return <main style={{padding:"24px",maxWidth:1300,margin:"0 auto"}}><h1>Agente de Captação</h1><p>Central de atendimentos: veja o que foi aprovado, enviado e o que exige acompanhamento. As respostas ainda precisam ser consultadas e classificadas manualmente.</p><CaptureControl/><CaptureOperations items={items}/></main>;
}
