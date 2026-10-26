import s from "./RecoveryMetrics.module.css";
export default function RecoveryMetrics({data}){
 return <main className={s.main}><a href="/recuperacao/fila">← Voltar à fila de recuperação</a><h1>Indicadores da recuperação</h1><p>Funil construído a partir de registros reais do LeadFlow.</p>
 {data.error?<p role="alert">{data.error}</p>:<>
 <section className={s.cards}>{data.steps.map(step=><article key={step.key}><span>{step.label}</span><strong>{step.value}</strong></article>)}</section>
 <h2>Resultados comerciais registrados</h2><p>Valor total contratado: <strong>{(data.contractTotalCents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></p><p>Contratos ganhos por proposta apresentada: <strong>{data.rates.winAmongProposals===null?"—":data.rates.winAmongProposals+"%"}</strong></p><h2>Taxas observadas</h2><section className={s.cards}>
 <article><span>Respostas por mensagem enviada</span><strong>{data.rates.replyAmongSent===null?"—":data.rates.replyAmongSent+"%"}</strong></article>
 <article><span>Interesse confirmado entre contatos com resposta</span><strong>{data.rates.interestAmongReplied===null?"—":data.rates.interestAmongReplied+"%"}</strong></article>
 <article><span>Propostas apresentadas por envio</span><strong>{data.rates.proposalAmongSent===null?"—":data.rates.proposalAmongSent+"%"}</strong></article>
 </section><p>Contatos encerrados com sua aprovação: <strong>{data.closed}</strong></p>
 <p className={s.note}>{data.disclaimer}</p></>}
 </main>;
}
