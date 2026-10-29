import {prisma} from "../../lib/prisma.js";
import styles from "./page.module.css";
import AnalyzeReply from "../../components/IntelligenceAnalyzeReply/IntelligenceAnalyzeReply.jsx";
import OutcomeEditor from "../../components/IntelligenceOutcome/OutcomeEditor.jsx";
export const dynamic="force-dynamic";
const categories={opt_out:"Solicitou não receber",not_interested:"Sem interesse",price_objection:"Objeção de preço",timing_objection:"Momento inadequado",existing_provider:"Já possui fornecedor/site",positive_intent:"Possível interesse",needs_review:"Resposta exige revisão",non_text_reply:"Resposta não textual",unclassified:"Sem classificação"};
function summarize(rows){
 const sent=rows.length,replied=rows.filter(x=>x.status==="replied").length,checked=rows.filter(x=>x.checkedAt&&!x.lastError).length;
 return {sent,replied,checked,rate:sent?Math.round(replied/sent*1000)/10:0};
}
export default async function CommercialIntelligencePage(){
 const sessionId=process.env.OPENWA_SESSION_ID?.trim()||"";
 const observations=sessionId?await prisma.outreachObservation.findMany({where:{sessionId},orderBy:{replyAt:"desc"},take:2000}):[];
 const outcomes=sessionId?await prisma.commercialOutcome.findMany({where:{sessionId}}):[];
 const outcomeByContact=new Map(outcomes.map(x=>[x.channel+":"+x.chatId,x]));
 const capture=observations.filter(x=>x.channel==="capture"),recovery=observations.filter(x=>x.channel==="recovery");
 const stats=[{id:"capture",label:"Captação",href:"/captacao",...summarize(capture)},{id:"recovery",label:"Recuperação",href:"/recuperacao/central",...summarize(recovery)}];
 const replied=observations.filter(x=>x.status==="replied");
 const objections=Object.entries(categories).map(([key,label])=>({key,label,count:replied.filter(x=>x.category===key).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count);
 const experiments=new Map();
 for(const item of observations){
  const key=item.channel+":"+item.messageText.trim();
  if(!item.messageText.trim())continue;
  const record=experiments.get(key)||{channel:item.channel,message:item.messageText,sent:0,replied:0,verified:0};
  record.sent++;if(item.status==="replied")record.replied++;if(item.checkedAt&&!item.lastError)record.verified++;
  const outcome=outcomeByContact.get(item.channel+":"+item.chatId);
  if(outcome){record.interested=(record.interested||0)+(["interested","meeting_scheduled","meeting_held","proposal_sent","won"].includes(outcome.stage)?1:0);record.meetings=(record.meetings||0)+(["meeting_scheduled","meeting_held","proposal_sent","won"].includes(outcome.stage)?1:0);record.proposals=(record.proposals||0)+(["proposal_sent","won"].includes(outcome.stage)?1:0);record.wins=(record.wins||0)+(outcome.stage==="won"?1:0);record.losses=(record.losses||0)+(outcome.stage==="lost"?1:0);record.revenue=(record.revenue||0)+(outcome.stage==="won"?outcome.contractAmount||0:0);}
  experiments.set(key,record);
 }
 const approaches=[...experiments.values()].sort((a,b)=>b.sent-a.sent).slice(0,12);
 const lossReasons=outcomes.filter(x=>x.stage==="lost"&&x.lossReason.trim()).reduce((m,x)=>{const k=x.lossReason.trim().toLowerCase();m.set(k,(m.get(k)||0)+1);return m},new Map());
 const ideas=[];
 const totals={meetings:outcomes.filter(x=>["meeting_scheduled","meeting_held","proposal_sent","won"].includes(x.stage)).length,proposals:outcomes.filter(x=>["proposal_sent","won"].includes(x.stage)).length,wins:outcomes.filter(x=>x.stage==="won").length,losses:outcomes.filter(x=>x.stage==="lost").length,contracted:outcomes.filter(x=>x.stage==="won").reduce((total,x)=>total+(x.contractAmount||0),0)};
 if(lossReasons.size)ideas.push("Perdas registradas: "+[...lossReasons.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([reason,n])=>reason+" ("+n+")").join("; ")+". Revise esses motivos antes de modificar a campanha.");
 if(!sessionId)ideas.push("Configure OPENWA_SESSION_ID para iniciar o monitoramento.");
 if(observations.length===0)ideas.push("Ainda não há observações: após atualizar o banco, mantenha o worker ativo para consultar as conversas enviadas.");
 if(observations.some(x=>x.lastError))ideas.push("Existem falhas nas consultas OpenWA. Verifique a conexão antes de interpretar o silêncio dos contatos.");
 if(objections.some(x=>x.key==="price_objection"))ideas.push("Há objeções explícitas de preço: avalie se a proposta comunica benefícios e escopo antes de testar outro texto.");
 if(objections.some(x=>x.key==="timing_objection"))ideas.push("Há objeções de momento: registre o melhor período de contato e respeite a preferência informada.");
 if(objections.some(x=>x.key==="opt_out"))ideas.push("Há pedidos para não receber mensagens: priorize a revisão manual e exclusão desses contatos de novas abordagens.");
 if(approaches.every(x=>x.verified<10)&&approaches.length)ideas.push("A amostra por abordagem ainda é pequena. Evite declarar uma mensagem vencedora sem mais observações e resultados comerciais.");
 return <main className={styles.page}>
 <header className={styles.header}><div><h1>Inteligência Comercial</h1><p>Monitoramento de respostas, objeções e aprendizado com as abordagens.</p></div><a href="/dashboard">Voltar ao Dashboard</a></header>
 <div className={styles.grid}>{stats.map(x=><article className={styles.card} key={x.id}><div className={styles.cardHeader}><h2>{x.label}</h2><a href={x.href}>Ver atendimentos →</a></div><strong className={styles.big}>{x.replied}<small> respostas observadas</small></strong><p>{x.checked} consultas válidas · {x.sent} contatos registrados · {x.rate}% de respostas observadas</p></article>)}</div>
 <section className={styles.card}><h2>Resultados comerciais registrados</h2><div className={styles.tags}><span>Reuniões: <b>{totals.meetings}</b></span><span>Propostas: <b>{totals.proposals}</b></span><span>Contratos: <b>{totals.wins}</b></span><span>Perdas: <b>{totals.losses}</b></span><span>Valor contratado: <b>{(totals.contracted/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b></span></div><p>Registros humanos associados a contatos monitorados, não receita recebida. Reuniões incluem etapas posteriores quando aplicável.</p></section>
 <section className={styles.card}><h2>Motivos identificados nas respostas</h2><p>Classificação conservadora baseada apenas em termos expressos pelos contatos; pode exigir revisão humana.</p>{objections.length?<div className={styles.tags}>{objections.map(x=><span key={x.key}>{x.label}: <b>{x.count}</b></span>)}</div>:<p>Nenhuma objeção explícita classificada até agora.</p>}</section>
 <section className={styles.card}><h2>Desempenho das abordagens</h2><p>Agrupamento por texto enviado. Reuniões, propostas e vendas são resultados registrados manualmente. A associação por texto não prova causalidade; uma consulta parcial não comprova ausência de resposta.</p><div className={styles.tableWrap}><table><thead><tr><th>Agente</th><th>Mensagem</th><th>Enviadas</th><th>Consultadas</th><th>Respostas</th><th>Reuniões</th><th>Propostas</th><th>Contratos</th><th>Perdas</th></tr></thead><tbody>{approaches.map((x,i)=><tr key={i}><td>{x.channel==="capture"?"Captação":"Recuperação"}</td><td>{x.message.slice(0,150)}</td><td>{x.sent}</td><td>{x.verified}</td><td>{x.replied}</td><td>{x.meetings||0}</td><td>{x.proposals||0}</td><td>{x.wins||0}</td><td>{x.losses||0}</td></tr>)}</tbody></table></div>{!approaches.length&&<p>Sem abordagens monitoradas.</p>}</section>
 <section className={styles.card}><h2>Recomendações para experimentos</h2>{ideas.length?ideas.map((item,i)=><p key={i} className={styles.idea}>{item}</p>):<p>Continue acompanhando resultados comerciais e validando hipóteses; não há alertas automáticos neste momento.</p>}<p>As recomendações são informativas: o LeadFlow não modifica campanhas nem envia novas mensagens automaticamente.</p></section>
 <section className={styles.card}><h2>Respostas recentes</h2><div className={styles.tableWrap}><table><thead><tr><th>Agente</th><th>Contato</th><th>Classificação</th><th>Resposta identificada</th><th>Última resposta</th><th>Análise IA</th><th>Resultado comercial</th></tr></thead><tbody>{replied.slice(0,40).map(x=><tr key={x.id}><td>{x.channel==="capture"?"Captação":"Recuperação"}</td><td>{x.chatId}</td><td>{categories[x.category]||"Revisar"}</td><td>{x.evidence||"Mensagem não textual"}</td><td>{x.replyAt?.toLocaleString("pt-BR")||"—"}</td><td><AnalyzeReply id={x.id} category={x.aiAnalyzedReplyAt?.getTime()===x.replyAt?.getTime()?x.aiCategory:""} reasoning={x.aiAnalyzedReplyAt?.getTime()===x.replyAt?.getTime()?x.aiReasoning:""} recommendation={x.aiAnalyzedReplyAt?.getTime()===x.replyAt?.getTime()?x.aiRecommendation:""} disabled={!!x.lastError||!x.evidence} /></td><td><OutcomeEditor observationId={x.id} initial={outcomeByContact.get(x.channel+":"+x.chatId)||null}/></td></tr>)}</tbody></table></div>{!replied.length&&<p>Nenhuma resposta identificada até agora.</p>}</section>
 </main>;
}
