"use client";
import { useEffect,useMemo,useState } from "react";
import s from "./GenerationLivePanel.module.css";

const PHASES={prepare:"Workspace",research:"Dados",assets:"Imagens",creative:"Direção criativa",architecture:"Arquitetura",code:"Código",review:"Review",files:"Arquivos",build:"Build",qa:"QA visual",repair:"Autocorreção",finalize:"Finalização",complete:"Pronto"};

export default function GenerationLivePanel({generationId,onClose,variants=[]}){
  const[state,setState]=useState({status:"waiting",events:[],files:[]});
  const[variantStates,setVariantStates]=useState({leadflow:{status:"waiting",events:[],files:[]},testelead:{status:"waiting",events:[],files:[]}});
  useEffect(()=>{if(!generationId)return;let alive=true,timer;
    const poll=async()=>{try{const response=await fetch("/api/generation-progress/"+encodeURIComponent(generationId),{cache:"no-store"});const data=await response.json();if(alive)setState(data);if(alive&&!["done","error"].includes(data.status))timer=setTimeout(poll,650)}catch{if(alive)timer=setTimeout(poll,1200)}};
    poll();return()=>{alive=false;clearTimeout(timer)};
  },[generationId]);
  useEffect(()=>{if(!generationId)return;let alive=true,timer;const poll=async()=>{try{const ids={leadflow:generationId+"-a",testelead:generationId+"-b"};const [a,b]=await Promise.all(Object.values(ids).map(id=>fetch("/api/generation-progress/"+encodeURIComponent(id),{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)));if(alive)setVariantStates(current=>({leadflow:a||current.leadflow,testelead:b||current.testelead}));if(alive&&![a?.status,b?.status].every(x=>["done","error"].includes(x)))timer=setTimeout(poll,650)}catch{if(alive)timer=setTimeout(poll,1200)}};poll();return()=>{alive=false;clearTimeout(timer)}},[generationId]);
  const feed=useMemo(()=>Object.entries(variantStates).flatMap(([variant,value])=>(value.events||[]).map(event=>({...event,variant}))).sort((a,b)=>new Date(a.at)-new Date(b.at)),[variantStates]);
  const [selectedVariant,setSelectedVariant]=useState("leadflow");
  const selectedState=variantStates[selectedVariant]||state;
  const current=selectedState.current||selectedState.events?.[selectedState.events.length-1]||state.current||state.events?.[state.events.length-1];
  const codeEvent=useMemo(()=>[...(state.events||[])].reverse().find(item=>item.code),[state.events]);
  const compareReady=Array.isArray(variants)&&variants.length>1;
  const isRunning=!["done","error"].includes(state.status);
  const selectedProject=variants.find(item=>(item?.comparisonVariant||item?.generatorInput?.siteVariant||item?.siteData?.siteVariant||"leadflow")===selectedVariant)||null;
  const variantLabel=key=>variantStates[key]?.status==="error"?"falhou":variantStates[key]?.status==="done"?"concluído · conferir revisão":"● trabalhando";
  const finished=["done","error"].includes(selectedState.status)||!isRunning;
  const previewSrc=selectedProject?"/preview-internal/"+selectedProject.id+"?v="+(selectedProject.version||1):"";
  return <div className={s.backdrop}><section className={s.shell}>
    <header className={s.arenaHeader}><div className={s.projectTitle}><span className={s.brand}>LEADFLOW BATTLE</span><h2>{state.status==="done"?"Escolha a melhor proposta":"Gerando duas propostas em paralelo"}</h2></div><div className={s.modelTabs}><button type="button" className={selectedVariant==="leadflow"?s.modelActive:""} onClick={()=>setSelectedVariant("leadflow")}><span>A</span><b>LeadFlow</b><small>{variantLabel("leadflow")}</small></button><button type="button" className={selectedVariant==="testelead"?s.modelActive:""} onClick={()=>setSelectedVariant("testelead")}><span>B</span><b>TesteLead</b><small>{isRunning?"● trabalhando":"pronto"}</small></button></div><div className={s.headerActions}>{compareReady&&<button type="button" onClick={()=>{for(const item of variants){const a=document.createElement("a");a.href="/api/projects/"+item.id+"/zip";a.click()}}}>↓ Baixar os 2</button>}</div></header>
    <div className={s.arenaBody}>
      <aside className={s.arenaChat}><div className={s.briefCard}><strong>Briefing</strong><p>{current?.detail||"Duas equipes estão construindo propostas independentes para o mesmo negócio."}</p></div><div className={s.agentFeed}>{feed.filter(event=>event.variant===selectedVariant).slice(-18).map((event,index)=><article key={event.at+index}><span>{String(event.variant||event.siteVariant||event.title||"").toLowerCase().includes("testelead")?"B":"A"}</span><div><b>{event.kind==="command"?"› ":event.kind==="file"?"✓ ":event.kind==="browser"?"◉ ":""}{event.title}</b>{event.file&&<code>{event.file}</code>}<small>{event.detail}</small>{event.code&&<pre>{event.code}</pre>}</div></article>)}</div><div className={s.followUp}>Acompanhe a geração ao vivo…</div></aside>
      <main className={s.arenaPreview}><div className={s.browserBar}><div className={s.viewToggle}>◉　&lt;/&gt;　⚙</div><div className={s.address}>↻　/</div>{selectedProject&&<a href={previewSrc} target="_blank" rel="noopener noreferrer">Abrir ↗</a>}</div>{selectedProject?<iframe key={previewSrc} src={previewSrc} title={"Prévia "+selectedVariant}/>:<div className={s.buildingStage}>{!finished&&<div className={s.loader}/>}<h3>{finished?"Esta proposta não tem prévia disponível":(selectedVariant==="testelead"?"TesteLead":"LeadFlow")+" está construindo"}</h3><p>{finished?(selectedState.error||"A geração terminou sem uma prévia para esta proposta. Selecione a outra proposta para conferir o resultado preservado."):"A prévia aparecerá aqui quando esta proposta estiver disponível."}</p><div className={s.liveLog}>{(selectedState.events||[]).slice(-8).map((event,index)=><span key={event.at+index}>{PHASES[event.phase]||event.phase} · {event.title}{event.file?" · "+event.file:""}</span>)}</div></div>}</main>
    </div>
    <footer><div><span>{(selectedState.files||[]).length} arquivos/entradas</span><span>{(selectedState.events||[]).length} eventos</span><span>{current?PHASES[current.phase]||current.phase:"Inicializando"}</span></div>{state.status==="error"&&<p>{state.error}</p>}{["done","error"].includes(state.status)&&<button type="button" onClick={onClose}>Fechar</button>}</footer>
  </section></div>;
}
