"use client";
import {useEffect,useState} from "react";
import styles from "./SocialStudio.module.css";
const date=v=>v?new Date(v).toLocaleString("pt-BR"):"—";

const dayKey=value=>{const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const monthName=value=>value.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
const weekNames=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const states={draft:"Rascunho",scheduled:"Agendado",publishing:"Publicando",published:"Publicado",needs_review:"Verificar publicação",cancelled:"Cancelado"};
export default function SocialStudio({initialPosts=[]}){
 const [posts,setPosts]=useState(initialPosts),[postErrors,setPostErrors]=useState({}),[storage,setStorage]=useState(null),[syncing,setSyncing]=useState(false),[workingPost,setWorkingPost]=useState(""),[title,setTitle]=useState(""),[topic,setTopic]=useState(""),[caption,setCaption]=useState(""),[mediaType,setMediaType]=useState("image"),[platforms,setPlatforms]=useState(["instagram","facebook"]),[media,setMedia]=useState([]),[scheduledAt,setScheduledAt]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[uploaded,setUploaded]=useState([]),[visibleMonth,setVisibleMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1)),[calendarDay,setCalendarDay]=useState(null),[calendarView,setCalendarView]=useState("month"),[postFilter,setPostFilter]=useState("scheduled");
 useEffect(()=>{setPosts(initialPosts)},[initialPosts]);
 useEffect(()=>{fetch("/api/social/storage").then(r=>r.json()).then(setStorage).catch(()=>{});},[]);
 useEffect(()=>{const interval=setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},15000);return ()=>clearInterval(interval)},[]);
 async function refresh(){const response=await fetch("/api/social/posts",{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error);setPosts(data.posts)}
 async function syncOldMedia(){
  setSyncing(true);setError("");setNotice("");
  try{const response=await fetch("/api/social/sync-r2",{method:"POST"});const data=await response.json();if(!response.ok)throw Error(data.error||"Falha na sincronização");await refresh();setNotice(`${data.filesUploaded} arquivo(s) transferido(s) para o R2; ${data.postsUpdated} rascunho(s) atualizado(s).`+(data.filesFailed?` ${data.filesFailed} falha(s): `+data.errors.map(x=>x.post+" slide "+(x.position||"-")+": "+x.error).join("; "):""));}catch(e){setError(e.message)}finally{setSyncing(false)}
 }
 async function upload(event){
  const files=[...event.target.files||[]];if(!files.length)return;setBusy(true);setError("");
  try{const form=new FormData();files.forEach(file=>form.append("files",file));const response=await fetch("/api/social/upload",{method:"POST",body:form});const json=await response.json();if(!response.ok)throw Error(json.error);setUploaded(json.files);setMedia(json.files.map(x=>x.publicUrl||x.localUrl));setNotice(json.files.every(x=>x.publicUrl)?"Mídias hospedadas e prontas para agendamento.":"Criativos guardados no computador. O LeadFlow enviará ao R2 automaticamente quando você aprovar o agendamento.");}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function generateCaption(){setBusy(true);setError("");try{const r=await fetch("/api/social/caption",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,platforms})});const data=await r.json();if(!r.ok)throw Error(data.error);setCaption(data.caption)}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function create(){
  setBusy(true);setError("");setNotice("");
  try{const r=await fetch("/api/social/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,caption,mediaType,platforms,media})});const data=await r.json();if(!r.ok)throw Error(data.error);await refresh();setTitle("");setTopic("");setCaption("");setMedia([]);setUploaded([]);setNotice("Rascunho salvo. Agende-o no calendário depois da sua revisão.")}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function act(post,action){
  if(action==="schedule"&&!scheduledAt){setError("Selecione uma data e hora futuras.");return}
  const selected=JSON.parse(post.platformsJson);
  const fields={facebook:"facebookStatus",instagram:"instagramStatus"};
  const uncertain=selected.filter(p=>["uncertain","sending"].includes(post[fields[p]]));
  let retryPlatforms=[];
  if(["schedule","publish_now"].includes(action)){
   if(uncertain.length){
    const question="Confira manualmente Instagram e Facebook antes de continuar. As seguintes redes ficaram com resultado incerto: "+uncertain.join(", ")+". Confirma que NÃO houve publicação nelas e autoriza uma nova tentativa? Uma resposta incorreta pode duplicar o conteúdo.";
    if(!confirm(question))return;
    retryPlatforms=uncertain;
   }
   if(!confirm(action==="publish_now"?"Publicar agora nas redes ainda não confirmadas? O envio ocorrerá quando o agente estiver em execução.":"Autorizar o agendamento nas redes ainda não confirmadas?"))return;
  }
  setBusy(true);setWorkingPost(post.id);setError("");setPostErrors(current=>({...current,[post.id]:""}));setNotice("");
  try{const r=await fetch("/api/social/posts/"+post.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,scheduledAt:action==="schedule"?new Date(scheduledAt).toISOString():null,retryPlatforms})});const data=await r.json();if(!r.ok)throw Error(data.error);await refresh();setNotice(action==="publish_now"?"Publicação autorizada para envio imediato pelo agente.":action==="schedule"?"Agendamento aprovado.":"Publicação cancelada.")}catch(e){setError(e.message);setPostErrors(current=>({...current,[post.id]:e.message}))}finally{setBusy(false);setWorkingPost("")}
 }
 const scheduledPosts=posts.filter(p=>["scheduled","publishing","published","needs_review"].includes(p.status)&&p.scheduledAt);
 const unscheduledPosts=posts.filter(p=>["draft","cancelled"].includes(p.status));
 const monthStart=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth(),1);
 const leading=monthStart.getDay();
 const monthLength=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+1,0).getDate();
 const cells=Array.from({length:Math.ceil((leading+monthLength)/7)*7},(_,index)=>{const value=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth(),index-leading+1);return {value,key:dayKey(value),inMonth:value.getMonth()===visibleMonth.getMonth()};});
 const focusPosts=postFilter==="draft"?unscheduledPosts:postFilter==="all"?posts:calendarDay?scheduledPosts.filter(p=>dayKey(p.scheduledAt)===calendarDay):scheduledPosts.filter(p=>{const d=new Date(p.scheduledAt);return d.getFullYear()===visibleMonth.getFullYear()&&d.getMonth()===visibleMonth.getMonth()});
 function moveMonth(delta){setVisibleMonth(value=>new Date(value.getFullYear(),value.getMonth()+delta,1));setCalendarDay(null)}
 return <div className={styles.layout}>
 <section className={styles.panel}><h2>Estúdio de publicações</h2><p>Envie mídias, prepare legendas com OmniRoute e revise antes de colocar na agenda.</p>
 <label>Título interno<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Por que ter um site próprio?"/></label>
 <label>Formato<select value={mediaType} onChange={e=>{setMediaType(e.target.value);setMedia([]);setUploaded([])}}><option value="image">Imagem</option><option value="carousel">Carrossel (2 a 10)</option><option value="video">Vídeo / Reel</option><option value="text">Texto (Facebook)</option></select></label>
 <div className={styles.platforms}><label><input type="checkbox" checked={platforms.includes("instagram")} onChange={e=>setPlatforms(p=>e.target.checked?[...new Set([...p,"instagram"])]:p.filter(x=>x!=="instagram"))}/> Instagram</label><label><input type="checkbox" checked={platforms.includes("facebook")} onChange={e=>setPlatforms(p=>e.target.checked?[...new Set([...p,"facebook"])]:p.filter(x=>x!=="facebook"))}/> Facebook</label></div>
 {mediaType!=="text"&&<><label>Upload de arquivos<input type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" multiple={mediaType==="carousel"} onChange={upload}/></label>{uploaded.length>0&&<div className={styles.files}>{uploaded.map(x=><span key={x.name}>{x.name.slice(0,8)} · {x.publicUrl?"Hospedado":"Somente local"}{x.storageError?" · "+x.storageError:""}</span>)}</div>}
 <label>URLs das mídias (uma por linha, na ordem do carrossel)<textarea rows={3} value={media.join("\n")} onChange={e=>setMedia(e.target.value.split("\n").map(x=>x.trim()).filter(Boolean))} placeholder="https://.../arte.jpg"/></label><small>Os criativos permanecem locais até a aprovação. Se o R2 estiver configurado, o LeadFlow cria as URLs públicas automaticamente ao agendar.</small></>}
 <label>Tema para IA<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Ex.: vantagens de ter um site próprio"/></label><button type="button" className={styles.secondary} disabled={busy||!topic.trim()} onClick={generateCaption}>Gerar legenda com OmniRoute</button>
 <label>Legenda<textarea rows={7} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Sua legenda, CTA e hashtags"/></label>
 <button type="button" className={styles.primary} disabled={busy||!title.trim()||!caption.trim()} onClick={create}>{busy?"Processando...":"Salvar rascunho"}</button>
 </section>
 <section className={styles.panel}><h2>Agenda de publicações</h2>{storage&&<div className={styles.statusNotice} role="status">R2: {storage.ready?"Conectado/configurado — "+storage.bucket:"Credenciais incompletas no .env"} · Aguardando limpeza: {storage.pending} · Limpos: {storage.cleaned} · Erros: {storage.failed} · Retenção: 24h após publicação confirmada</div>}{storage?.ready&&<button type="button" disabled={syncing||busy} onClick={syncOldMedia}>{syncing?"Enviando criativos antigos ao R2...":"Sincronizar criativos já cadastrados com R2"}</button>}<p>Atualização automática a cada 15 segundos enquanto a página estiver aberta. Agendamentos exigem aprovação; o worker publica quando estiver executando.</p>
 <label>Data e hora de publicação<input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/></label>
 <div className={styles.stats}><div><strong>{posts.filter(x=>x.status==="draft").length}</strong><span>Rascunhos</span></div><div><strong>{posts.filter(x=>x.status==="scheduled").length}</strong><span>Agendados</span></div><div><strong>{posts.filter(x=>x.status==="published").length}</strong><span>Publicados</span></div></div>
 <div role="status" className={styles.statusNotice}>Ao aprovar o agendamento, as mídias locais são transferidas ao R2. O agendamento só será aceito após hospedagem e validação.</div>
 <div className={styles.calendarTabs}><button type="button" aria-pressed={postFilter==="scheduled"} onClick={()=>{setPostFilter("scheduled");setCalendarDay(null)}}>Programados ({scheduledPosts.filter(p=>p.status==="scheduled").length})</button><button type="button" aria-pressed={postFilter==="draft"} onClick={()=>{setPostFilter("draft");setCalendarDay(null)}}>Não programados ({unscheduledPosts.length})</button><button type="button" aria-pressed={postFilter==="all"} onClick={()=>{setPostFilter("all");setCalendarDay(null)}}>Todos ({posts.length})</button></div>
 {postFilter==="scheduled"&&<div className={styles.calendar}>
 <div className={styles.calendarToolbar}><button type="button" onClick={()=>moveMonth(-1)} aria-label="Mês anterior">‹</button><button type="button" onClick={()=>{const now=new Date();setVisibleMonth(new Date(now.getFullYear(),now.getMonth(),1));setCalendarDay(dayKey(now))}}>Hoje</button><button type="button" onClick={()=>moveMonth(1)} aria-label="Próximo mês">›</button><h3>{monthName(visibleMonth)}</h3><select value={visibleMonth.getFullYear()} aria-label="Ano" onChange={e=>{setVisibleMonth(v=>new Date(Number(e.target.value),v.getMonth(),1));setCalendarDay(null)}}>{Array.from({length:9},(_,i)=>new Date().getFullYear()-3+i).map(y=><option key={y} value={y}>{y}</option>)}</select><select aria-label="Mês" value={visibleMonth.getMonth()} onChange={e=>{setVisibleMonth(v=>new Date(v.getFullYear(),Number(e.target.value),1));setCalendarDay(null)}}>{Array.from({length:12},(_,i)=><option key={i} value={i}>{new Date(2026,i,1).toLocaleDateString("pt-BR",{month:"long"})}</option>)}</select></div>
 <div className={styles.calendarGrid} role="grid" aria-label={"Calendário de "+monthName(visibleMonth)}>{weekNames.map(day=><div key={day} role="columnheader" className={styles.weekday}>{day}</div>)}{cells.map(({value,key,inMonth})=>{const items=scheduledPosts.filter(p=>dayKey(p.scheduledAt)===key);return <button key={key} type="button" role="gridcell" aria-selected={calendarDay===key} className={styles.calendarCell} data-outside={!inMonth} data-selected={calendarDay===key} data-today={key===dayKey(new Date())} onClick={()=>{setCalendarDay(key);if(!inMonth)setVisibleMonth(new Date(value.getFullYear(),value.getMonth(),1))}}><span className={styles.dayNumber}>{value.getDate()}</span><span className={styles.dayEvents}>{items.slice(0,3).map(p=><span key={p.id} className={styles.dayEvent} data-status={p.status} title={p.title}>{new Date(p.scheduledAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} {p.title}</span>)}{items.length>3&&<small>+{items.length-3} posts</small>}</span></button>})}</div>
 {calendarDay&&<div className={styles.daySelection}><strong>{new Date(calendarDay+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</strong><button type="button" onClick={()=>setCalendarDay(null)}>Ver mês inteiro ×</button></div>}
 </div>}
 <h3 className={styles.listHeading}>{postFilter==="draft"?"Rascunhos e não programados":postFilter==="all"?"Todas as publicações":calendarDay?"Publicações deste dia":"Publicações do mês"}</h3>
 <div className={styles.posts}>{focusPosts.length===0?<p>{postFilter==="draft"?"Nenhum rascunho aguardando programação.":"Nenhuma publicação nesta seleção."}</p>:focusPosts.map(post=><article key={post.id} className={styles.post}>
 <div className={styles.postHeader}><strong>{post.title}</strong><span className={styles.status}>{workingPost===post.id?"Processando solicitação...":states[post.status]||post.status}</span></div><small>{JSON.parse(post.platformsJson).join(" + ")} · {post.mediaType} · {date(post.scheduledAt)}</small><p>{post.caption}</p>
 <small>Facebook: {post.facebookStatus} · Instagram: {post.instagramStatus}</small>{post.lastError&&<small className={styles.error}>Erro de publicação: {post.lastError}</small>}{postErrors[post.id]&&<div role="alert" className={styles.error}>Agendamento recusado: {postErrors[post.id]}</div>}{post.status==="draft"&&JSON.parse(post.mediaJson).some(url=>url.startsWith("/api/"))&&<small className={styles.error}>Criativos locais: serão hospedados automaticamente no R2 durante a aprovação do agendamento.</small>}
 {["draft","scheduled","needs_review"].includes(post.status)&&<div className={styles.actions}><button type="button" disabled={busy} onClick={()=>act(post,"schedule")}>{workingPost===post.id?"Validando...":post.status==="draft"?"Aprovar e agendar":"Reagendar"}</button><button type="button" disabled={busy} onClick={()=>act(post,"publish_now")}>Publicar agora</button>{["draft","scheduled"].includes(post.status)&&<button type="button" disabled={busy} onClick={()=>act(post,"cancel")}>Cancelar</button>}</div>}
 </article>)}</div>
 </section>
 {(error||notice)&&<div className={styles.feedback} role="status">{error||notice}</div>}
 </div>
}
