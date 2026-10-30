"use client";
import {useEffect,useState} from "react";
import styles from "./SocialStudio.module.css";
const date=v=>v?new Date(v).toLocaleString("pt-BR"):"—";
const states={draft:"Rascunho",scheduled:"Agendado",publishing:"Publicando",published:"Publicado",needs_review:"Verificar publicação",cancelled:"Cancelado"};
export default function SocialStudio({initialPosts=[]}){
 const [posts,setPosts]=useState(initialPosts),[postErrors,setPostErrors]=useState({}),[workingPost,setWorkingPost]=useState(""),[title,setTitle]=useState(""),[topic,setTopic]=useState(""),[caption,setCaption]=useState(""),[mediaType,setMediaType]=useState("image"),[platforms,setPlatforms]=useState(["instagram","facebook"]),[media,setMedia]=useState([]),[scheduledAt,setScheduledAt]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[uploaded,setUploaded]=useState([]);
 useEffect(()=>{setPosts(initialPosts)},[initialPosts]);
 useEffect(()=>{const interval=setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},15000);return ()=>clearInterval(interval)},[]);
 async function refresh(){const response=await fetch("/api/social/posts",{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error);setPosts(data.posts)}
 async function upload(event){
  const files=[...event.target.files||[]];if(!files.length)return;setBusy(true);setError("");
  try{const form=new FormData();files.forEach(file=>form.append("files",file));const response=await fetch("/api/social/upload",{method:"POST",body:form});const json=await response.json();if(!response.ok)throw Error(json.error);setUploaded(json.files);setMedia(json.files.map(x=>x.publicUrl||x.localUrl));setNotice(json.files.every(x=>x.publicUrl)?"Mídias hospedadas e prontas para agendamento.":"Arquivos guardados localmente. Configure armazenamento público para publicar no Instagram ou informe URLs HTTPS acessíveis.");}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function generateCaption(){setBusy(true);setError("");try{const r=await fetch("/api/social/caption",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,platforms})});const data=await r.json();if(!r.ok)throw Error(data.error);setCaption(data.caption)}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function create(){
  setBusy(true);setError("");setNotice("");
  try{const r=await fetch("/api/social/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,caption,mediaType,platforms,media})});const data=await r.json();if(!r.ok)throw Error(data.error);await refresh();setTitle("");setTopic("");setCaption("");setMedia([]);setUploaded([]);setNotice("Rascunho salvo. Agende-o no calendário depois da sua revisão.")}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function act(post,action){
  if(action==="schedule"&&!scheduledAt){setError("Selecione uma data e hora futuras.");return}
  if(action==="schedule"&&!confirm("Autorizar a publicação automática deste conteúdo nas redes escolhidas, na data indicada?"))return;
  setBusy(true);setWorkingPost(post.id);setError("");setPostErrors(current=>({...current,[post.id]:""}));setNotice("");
  try{const r=await fetch("/api/social/posts/"+post.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,scheduledAt:action==="schedule"?new Date(scheduledAt).toISOString():null})});const data=await r.json();if(!r.ok)throw Error(data.error);await refresh();setNotice(action==="schedule"?"Agendamento aprovado.":"Publicação cancelada.")}catch(e){setError(e.message);setPostErrors(current=>({...current,[post.id]:e.message}))}finally{setBusy(false);setWorkingPost("")}
 }
 return <div className={styles.layout}>
 <section className={styles.panel}><h2>Estúdio de publicações</h2><p>Envie mídias, prepare legendas com OmniRoute e revise antes de colocar na agenda.</p>
 <label>Título interno<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Por que ter um site próprio?"/></label>
 <label>Formato<select value={mediaType} onChange={e=>{setMediaType(e.target.value);setMedia([]);setUploaded([])}}><option value="image">Imagem</option><option value="carousel">Carrossel (2 a 10)</option><option value="video">Vídeo / Reel</option><option value="text">Texto (Facebook)</option></select></label>
 <div className={styles.platforms}><label><input type="checkbox" checked={platforms.includes("instagram")} onChange={e=>setPlatforms(p=>e.target.checked?[...new Set([...p,"instagram"])]:p.filter(x=>x!=="instagram"))}/> Instagram</label><label><input type="checkbox" checked={platforms.includes("facebook")} onChange={e=>setPlatforms(p=>e.target.checked?[...new Set([...p,"facebook"])]:p.filter(x=>x!=="facebook"))}/> Facebook</label></div>
 {mediaType!=="text"&&<><label>Upload de arquivos<input type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" multiple={mediaType==="carousel"} onChange={upload}/></label>{uploaded.length>0&&<div className={styles.files}>{uploaded.map(x=><span key={x.name}>{x.name.slice(0,8)} · {x.publicUrl?"Hospedado":"Somente local"}{x.storageError?" · "+x.storageError:""}</span>)}</div>}
 <label>URLs das mídias (uma por linha, na ordem do carrossel)<textarea rows={3} value={media.join("\n")} onChange={e=>setMedia(e.target.value.split("\n").map(x=>x.trim()).filter(Boolean))} placeholder="https://.../arte.jpg"/></label><small>O Instagram precisa de URLs HTTPS públicas. Arquivos apenas locais servem como biblioteca/rascunho, não podem ser agendados até a hospedagem.</small></>}
 <label>Tema para IA<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Ex.: vantagens de ter um site próprio"/></label><button type="button" className={styles.secondary} disabled={busy||!topic.trim()} onClick={generateCaption}>Gerar legenda com OmniRoute</button>
 <label>Legenda<textarea rows={7} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Sua legenda, CTA e hashtags"/></label>
 <button type="button" className={styles.primary} disabled={busy||!title.trim()||!caption.trim()} onClick={create}>{busy?"Processando...":"Salvar rascunho"}</button>
 </section>
 <section className={styles.panel}><h2>Calendário editorial</h2><p>Atualização automática a cada 15 segundos enquanto a página estiver aberta. Agendamentos exigem aprovação; o worker publica quando estiver executando.</p>
 <label>Data e hora de publicação<input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/></label>
 <div className={styles.stats}><div><strong>{posts.filter(x=>x.status==="draft").length}</strong><span>Rascunhos</span></div><div><strong>{posts.filter(x=>x.status==="scheduled").length}</strong><span>Agendados</span></div><div><strong>{posts.filter(x=>x.status==="published").length}</strong><span>Publicados</span></div></div>
 <div role="status" className={styles.statusNotice}>Atenção: arquivos em /api/social/media são locais e não podem ser publicados pela Meta. Se o agendamento falhar, o motivo aparecerá no próprio cartão.</div><div className={styles.posts}>{posts.length===0?<p>Nenhum conteúdo cadastrado.</p>:posts.map(post=><article key={post.id} className={styles.post}>
 <div className={styles.postHeader}><strong>{post.title}</strong><span className={styles.status}>{workingPost===post.id?"Processando solicitação...":states[post.status]||post.status}</span></div><small>{JSON.parse(post.platformsJson).join(" + ")} · {post.mediaType} · {date(post.scheduledAt)}</small><p>{post.caption}</p>
 <small>Facebook: {post.facebookStatus} · Instagram: {post.instagramStatus}</small>{post.lastError&&<small className={styles.error}>Erro de publicação: {post.lastError}</small>}{postErrors[post.id]&&<div role="alert" className={styles.error}>Agendamento recusado: {postErrors[post.id]}</div>}{post.status==="draft"&&JSON.parse(post.mediaJson).some(url=>url.startsWith("/api/"))&&<small className={styles.error}>Criativos armazenados apenas localmente. A Meta precisa de URL HTTPS pública; hospede as mídias antes de agendar.</small>}
 {["draft","scheduled"].includes(post.status)&&<div className={styles.actions}><button type="button" disabled={busy} onClick={()=>act(post,"schedule")}>{workingPost===post.id?"Validando...":post.status==="draft"?"Aprovar e agendar":"Reagendar"}</button><button type="button" disabled={busy} onClick={()=>act(post,"cancel")}>Cancelar</button></div>}
 </article>)}</div>
 </section>
 {(error||notice)&&<div className={styles.feedback} role="status">{error||notice}</div>}
 </div>
}
