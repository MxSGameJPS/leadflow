import {prisma} from "../../lib/prisma.js";
import {listLeads} from "../../repositories/leadRepository.js";
import CaptureControl from "../../components/CaptureControl/CaptureControl.jsx";
import CaptureOperations from "../../components/CaptureOperations/CaptureOperations.jsx";
import CapturePriority from "../../components/CapturePriority/CapturePriority.jsx";
import CaptureCampaignPreparation from "../../components/CaptureCampaignPreparation/CaptureCampaignPreparation.jsx";
import CaptureFollowup from "../../components/CaptureFollowup/CaptureFollowup.jsx";
import {rankCaptureCandidates} from "../../services/capture/prioritization.js";
import {captureNextStep,summarizeCapturePerformance} from "../../services/capture/commercialIntelligence.js";
import s from "./page.module.css";
export const dynamic="force-dynamic";
export default async function Page(){
 const sessionId=process.env.OPENWA_SESSION_ID||"";
 const [approvals,leads,observations,outcomes]=await Promise.all([
  prisma.captureApproval.findMany({where:{sessionId},orderBy:[{approvedAt:"asc"},{createdAt:"asc"}]}),
  listLeads(),
  prisma.outreachObservation.findMany({where:{sessionId,channel:"capture"},select:{chatId:true,status:true,category:true,aiCategory:true,replyAt:true,lastError:true,id:true,evidence:true}}),
  prisma.commercialOutcome.findMany({where:{sessionId,channel:"capture"},select:{chatId:true,stage:true,meetingAt:true,contractAmount:true}})
 ]);
 const [recovery,followups]=await Promise.all([prisma.recoveryDecision.findMany({where:{sessionId},select:{chatId:true}}),prisma.captureFollowup.findMany({where:{sessionId}})]);
 const followupByLead=new Map(followups.map(x=>[x.leadId,x]));
 const candidates=rankCaptureCandidates(leads,{approvals,recoveryChatIds:recovery.map(x=>x.chatId)});
 const byLead=new Map(leads.map(lead=>[lead.id,lead]));
 const replies=new Map(observations.map(o=>[o.chatId,o]));
 const results=new Map(outcomes.map(o=>[o.chatId,o]));
 const items=approvals.map(a=>({id:a.id,leadId:a.leadId,name:byLead.get(a.leadId)?.name||"Lead não encontrado",phone:a.chatId,message:a.messageText,status:a.status,approvedAt:a.approvedAt?.toISOString()||null,sentAt:a.sentAt?.toISOString()||null,updatedAt:a.updatedAt?.toISOString()||null,leadStage:byLead.get(a.leadId)?.stage||"",segment:byLead.get(a.leadId)?.segment||"",approachVariant:(a.approachVariant||"legacy").replace(/^auto_/,""),replyStatus:replies.get(a.chatId)?.status||"unverified",replyCategory:replies.get(a.chatId)?.category||"unclassified",aiCategory:replies.get(a.chatId)?.aiCategory||"",observationId:replies.get(a.chatId)?.id||"",replyEvidence:replies.get(a.chatId)?.evidence||"",replyAt:replies.get(a.chatId)?.replyAt?.toISOString()||null,replyError:replies.get(a.chatId)?.lastError||"",outcome:results.get(a.chatId)?.stage||"",meetingAt:results.get(a.chatId)?.meetingAt?.toISOString()||null,contractAmount:results.get(a.chatId)?.contractAmount||0}));
 const intelligence=items.filter(x=>x.status==="sent").map(x=>({...x,nextStep:captureNextStep({replyStatus:x.replyStatus,replyCategory:x.replyCategory,aiCategory:x.aiCategory,outcome:x.outcome,meetingAt:x.meetingAt,lastError:x.replyError})})).sort((a,b)=>b.nextStep.priority-a.nextStep.priority);
 const performance=summarizeCapturePerformance(items);
 const followupCandidates=items.filter(x=>x.status==="sent").map(x=>({...x,followup:followupByLead.get(x.leadId)||null}));
 return <main className={s.main}><h1>Agente de Captação</h1><p>Central de atendimentos: veja o que foi aprovado, enviado e o que exige acompanhamento. As respostas ainda precisam ser consultadas e classificadas manualmente.</p><CaptureControl/><CaptureCampaignPreparation/><CapturePriority candidates={candidates}/><CaptureOperations items={items} intelligence={intelligence} performance={performance}/><CaptureFollowup candidates={followupCandidates}/></main>;
}
