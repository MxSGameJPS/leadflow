"use client";
import { useEffect,useMemo,useState } from "react";
import s from "./GenerationLivePanel.module.css";

const PHASES={prepare:"Workspace",research:"Dados",assets:"Imagens",creative:"Direção criativa",architecture:"Arquitetura",code:"Código",review:"Review",files:"Arquivos",build:"Build",qa:"QA visual",repair:"Autocorreção",finalize:"Finalização",complete:"Pronto"};

export default function GenerationLivePanel({generationId,onClose,variants=[]}){
  const[state,setState]=useState({status:"waiting",events:[],files:[]});
  useEffect(()=>{if(!generationId)return;let alive=true,timer;
    const poll=async()=>{try{const response=await fetch("/api/generation-progress/"+encodeURIComponent(generationId),{cache:"no-store"});const data=await response.json();if(alive)setState(data);if(alive&&!["done","error"].includes(data.status))timer=setTimeout(poll,650)}catch{if(alive)timer=setTimeout(poll,1200)}};
    poll();return()=>{alive=false;clearTimeout(timer)};
  },[generationId]);
  const current=state.current||state.events?.[state.events.length-1];
  const [selectedVariant,setSelectedVariant]=useState("leadflow");
  const codeEvent=useMemo(()=>[...(state.events||[])].reverse().find(item=>item.code),[state.events]);
  const compareReady=Array.isArray(variants)&&variants.length>1;
  const selectedProject=compareReady?(variants.find(item=>(item?.generatorInput?.siteVariant||item?.siteData?.siteVariant||"leadflow")===selectedVariant)||variants[0]):null;
  const previewSrc=selectedProject?"/preview-internal/"+selectedProject.id+"?v="+(selectedProject.version||1):"";
  return <div className={s.backdrop}><section className={s.shell}>
    <header><div><span className={s.brand}>LEADFLOW BUILDER</span><h2>{state.status==="done"?"Site criado com sucesso":state.status==="error"?"A geração encontrou um erro":"Construindo seu site ao vivo"}</h2><p>{current?.detail||"Inicializando agentes e workspace..."}</p></div><div className={s.pulse}><i/> {state.status==="running"?"AGENTES TRABALHANDO":state.status==="done"?"CONCLUÍDO":state.status==="error"?"INTERROMPIDO":"INICIANDO"}</div></header>
    {compareReady&&<nav className={s.battleBar}><div><strong>Battle A/B</strong><small>Escolha a proposta para visualizar</small></div>{variants.map((item,index)=>{const variant=item?.generatorInput?.siteVariant||item?.siteData?.siteVariant||"leadflow";return <button type="button" key={item.id} className={selectedVariant===variant?s.battleActive:""} onClick={()=>setSelectedVariant(variant)}><span>Proposta {index===0?"A":"B"}</span><b>{variant==="testelead"?"TesteLead":"LeadFlow"}</b></button>})}</nav>}
    {compareReady?<div className={s.previewWorkspace}><aside className={s.battleRail}>{variants.map((item,index)=>{const variant=item?.generatorInput?.siteVariant||item?.siteData?.siteVariant||"leadflow";return <button type="button" key={item.id} className={selectedVariant===variant?s.thumbActive:""} onClick={()=>setSelectedVariant(variant)}><span>{index===0?"A":"B"}</span><b>{variant==="testelead"?"TesteLead":"LeadFlow"}</b><small>{item?.siteData?.codegenQuality?.score!=null?"QA "+item.siteData.codegenQuality.score+"/100":"Site concluído"}</small></button>})}</aside><main className={s.livePreview}><div className={s.browserBar}><span>●</span><span>●</span><span>●</span><div>/</div><a href={previewSrc} target="_blank" rel="noopener noreferrer">Abrir ↗</a></div><iframe key={previewSrc} src={previewSrc} title={"Prévia "+selectedVariant}/></main></div>:<div className={s.workspace}>
      <aside className={s.tree}><strong>EXPLORER</strong><div className={s.root}>▾ site/</div>{(state.files||[]).map(file=><div className={s.file} key={file}>↳ {file}</div>)}{!(state.files||[]).length&&<small>A estrutura aparecerá aqui conforme for criada.</small>}</aside>
      <main className={s.editor}><div className={s.tabs}>{codeEvent?.file||current?.file||"generation.log"}</div>{codeEvent?.code?<pre><code>{codeEvent.code}</code></pre>:<div className={s.terminal}>{(state.events||[]).map((event,index)=><p key={event.at+index}><time>{new Date(event.at).toLocaleTimeString("pt-BR")}</time><b>{PHASES[event.phase]||event.phase}</b><span>{event.title}</span></p>)}</div>}</main>
      <aside className={s.timeline}><strong>AGENT ACTIVITY</strong>{(state.events||[]).slice(-14).map((event,index)=><article className={event===current?s.current:""} key={event.at+index}><i/><div><b>{event.title}</b><small>{event.detail}</small></div></article>)}</aside>
    </div>}
    <footer><div><span>{(state.files||[]).length} arquivos/entradas</span><span>{(state.events||[]).length} eventos</span><span>{current?PHASES[current.phase]||current.phase:"Inicializando"}</span></div>{state.status==="error"&&<p>{state.error}</p>}{["done","error"].includes(state.status)&&<button type="button" onClick={onClose}>Fechar</button>}</footer>
  </section></div>;
}
