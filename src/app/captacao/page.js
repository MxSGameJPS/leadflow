import {prisma} from "../../lib/prisma.js";
import {listLeads} from "../../repositories/leadRepository.js";
import CaptureControl from "../../components/CaptureControl/CaptureControl.jsx";
import CaptureOperations from "../../components/CaptureOperations/CaptureOperations.jsx";
import CapturePriority from "../../components/CapturePriority/CapturePriority.jsx";
import {rankCaptureCandidates} from "../../services/capture/prioritization.js";
import s from "./page.module.css";
export const dynamic="force-dynamic";
export default async function Page(){
 const sessionId=process.env.OPENWA_SESSION_ID||"";
 const [approvals,leads,observations,outcomes]=await Promise.all([
  prisma.captureApproval.findMany({where:{sessionId},orderBy:[{approvedAt:"asc"},{createdAt:"asc"}]}),
  listLeads(),
  prisma.outreachObservation.findMany({where:{sessionId,channel:"capture"},select:{chatId:true,status:true,category:true}}),
  prisma.commercialOutcome.findMany({where:{sessionId,channel:"capture"},select:{chatId:true,stage:true,meetingAt:true,contractAmount:true}})
 ]);
 const recovery=await prisma.recoveryDecision.findMany({where:{sessionId},select:{chatId:true}});
 const candidates=rankCaptureCandidates(leads,{approvals,recoveryChatIds:recovery.map(x=>x.chatId)});
 const byLead=new Map(leads.map(lead=>[lead.id,lead]));
 const replies=new Map(observations.map(o=>[o.chatId,o]));
 const results=new Map(outcomes.map(o=>[o.chatId,o]));
 const items=approvals.map(a=>({id:a.id,leadId:a.leadId,name:byLead.get(a.leadId)?.name||"Lead não encontrado",phone:a.chatId,message:a.messageText,status:a.status,approvedAt:a.approvedAt?.toISOString()||null,sentAt:a.sentAt?.toISOString()||null,updatedAt:a.updatedAt?.toISOString()||null,leadStage:byLead.get(a.leadId)?.stage||"",approachVariant:a.approachVariant||"legacy",replyStatus:replies.get(a.chatId)?.status||"unverified",replyCategory:replies.get(a.chatId)?.category||"unclassified",outcome:results.get(a.chatId)?.stage||"",meetingAt:results.get(a.chatId)?.meetingAt?.toISOString()||null,contractAmount:results.get(a.chatId)?.contractAmount||0}));
 return <main className={s.main}><h1>Agente de Captação</h1><p>Central de atendimentos: veja o que foi aprovado, enviado e o que exige acompanhamento. As respostas ainda precisam ser consultadas e classificadas manualmente.</p><CaptureControl/><CapturePriority candidates={candidates}/><CaptureOperations items={items}/></main>;
}
