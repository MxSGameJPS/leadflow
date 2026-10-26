import { prisma } from "../../lib/prisma.js";

function pct(n, denominator) {
  return denominator > 0 ? Math.round((n / denominator) * 1000) / 10 : null;
}
export async function getRecoveryMetrics(sessionId) {
  if (!sessionId) return { error: "OPENWA_SESSION_ID não configurado." };
  const [decisions, dispatches, snapshots, previews, commercials] = await Promise.all([
    prisma.recoveryDecision.findMany({where:{sessionId},select:{chatId:true,status:true,consentConfirmed:true}}),
    prisma.recoveryDispatch.findMany({where:{sessionId},select:{chatId:true,status:true,dayKey:true}}),
    prisma.recoveryFollowupSnapshot.findMany({where:{sessionId},select:{chatId:true,status:true,latestReplyAt:true}}),
    prisma.recoveryPreview.findMany({where:{sessionId},select:{chatId:true,status:true}}),
    prisma.recoveryCommercial.findMany({where:{sessionId},select:{chatId:true,phase:true}}),
  ]);
  const closed=new Set(decisions.filter(d=>d.status==="close_approved").map(d=>d.chatId));
  const approved=new Set(decisions.filter(d=>d.status==="message_approved"||d.status==="sent"||d.status==="close_approved"||d.status==="close_rejected").map(d=>d.chatId));
  const sent=new Set(dispatches.filter(d=>d.status==="sent").map(d=>d.chatId));
  const replied=new Set(snapshots.filter(s=>sent.has(s.chatId)&&s.latestReplyAt).map(s=>s.chatId));
  const interested=new Set(previews.filter(p=>sent.has(p.chatId)).map(p=>p.chatId));
  const prepared=new Set(previews.filter(p=>sent.has(p.chatId)&&["ready","presented"].includes(p.status)).map(p=>p.chatId));
  const presented=new Set(previews.filter(p=>sent.has(p.chatId)&&p.status==="presented").map(p=>p.chatId));
  const negotiating=new Set(commercials.filter(c=>presented.has(c.chatId)).map(c=>c.chatId));
  const meetings=new Set(commercials.filter(c=>presented.has(c.chatId)&&["meeting_held","proposal_prepared","proposal_presented"].includes(c.phase)).map(c=>c.chatId));
  const proposals=new Set(commercials.filter(c=>presented.has(c.chatId)&&c.phase==="proposal_presented").map(c=>c.chatId));
  const checked=new Set(snapshots.filter(s=>sent.has(s.chatId)).map(s=>s.chatId));
  const steps=[
    {key:"approved",label:"Mensagens aprovadas (inclusive já enviadas)",value:approved.size},
    {key:"sent",label:"Envios confirmados",value:sent.size},
    {key:"checked",label:"Envios com histórico consultado",value:checked.size},
    {key:"replied",label:"Contatos com resposta detectada",value:replied.size},
    {key:"interested",label:"Interesse confirmado manualmente",value:interested.size},
    {key:"prepared",label:"Prévia pronta",value:prepared.size},
    {key:"presented",label:"Prévia apresentada",value:presented.size},
    {key:"negotiating",label:"Negociação registrada",value:negotiating.size},
    {key:"meetings",label:"Reunião realizada",value:meetings.size},
    {key:"proposals",label:"Proposta apresentada",value:proposals.size},
  ];
  return {
    steps,
    closed:closed.size,
    pendingReview: snapshots.filter(s=>sent.has(s.chatId)&&s.latestReplyAt&&!closed.has(s.chatId)).length,
    rates:{
      replyAmongSent:pct(replied.size,sent.size),
      interestAmongReplied:pct([...interested].filter(id=>replied.has(id)).length,replied.size),
      proposalAmongSent:pct(proposals.size,sent.size),
    },
    disclaimer:"Respostas dependem de histórico OpenWA consultado; ausências não comprovam silêncio. Interesse, prévia e negociação dependem de registro humano. Este painel não mede contratos fechados nem receita.",
  };
}
