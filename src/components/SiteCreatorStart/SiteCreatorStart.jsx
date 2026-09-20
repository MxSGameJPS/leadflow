"use client";
import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { clearSiteReferenceImagesAction,createSiteProjectAction,refineSiteProjectAction } from "../../app/actions/projects.js";
import s from "./SiteCreatorStart.module.css";

const DEFAULT_EFFECTS=["entrance-motion","section-reveal","hover-lift"];
const EFFECT_OPTIONS=[
  {id:"entrance-motion",label:"Entrada suave",description:"Anima o hero ao abrir a página."},
  {id:"section-reveal",label:"Revelar seções",description:"Elementos aparecem conforme a rolagem."},
  {id:"parallax-hero",label:"Parallax no hero",description:"Movimento de profundidade na imagem principal."},
  {id:"glass-header",label:"Header glass",description:"Cabeçalho translúcido com blur."},
  {id:"hover-lift",label:"Hover nos cards",description:"Cards ganham profundidade ao passar o mouse."},
  {id:"ambient-glow",label:"Glow ambiente",description:"Aura luminosa discreta no hero."},
  {id:"cta-pulse",label:"CTA em destaque",description:"Pulso sutil nos principais botões."},
  {id:"smooth-scroll",label:"Rolagem suave",description:"Navegação entre âncoras com transição suave."},
];
const VISUAL_REFERENCE_PATTERN=/(refer[eê]ncia|print|screenshot|imagem|layout|inspir|parecid|visual|interface|ui\b)/i;

function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({dataUrl:String(reader.result||""),label:file.name,size:file.size});reader.onerror=()=>reject(reader.error||new Error("Falha ao ler imagem."));reader.readAsDataURL(file)})}
function signature(value=[]){return JSON.stringify([...value].sort())}

export default function SiteCreatorStart({leads=[],initialLeadId="",project=null,skillOptions=[]}){
  const router=useRouter();
  const[leadId,setLeadId]=useState(initialLeadId||leads[0]?.id||"");
  const[template,setTemplate]=useState("landing");
  const[instruction,setInstruction]=useState("");
  const[busy,setBusy]=useState("");
  const[notice,setNotice]=useState("");
  const[activeProject,setActiveProject]=useState(project);
  const[device,setDevice]=useState("desktop");
  const[effects,setEffects]=useState(project&&Array.isArray(project.effects)?project.effects:DEFAULT_EFFECTS);
  const[skillMode,setSkillMode]=useState(project?.skillMode==="manual"?"manual":"auto");
  const[selectedSkills,setSelectedSkills]=useState(Array.isArray(project?.skills)?project.skills:[]);
  const[pendingReferences,setPendingReferences]=useState([]);

  useEffect(()=>{
    setActiveProject(project);
    setEffects(project&&Array.isArray(project.effects)?project.effects:DEFAULT_EFFECTS);
    setSkillMode(project?.skillMode==="manual"?"manual":"auto");
    setSelectedSkills(Array.isArray(project?.skills)?project.skills:[]);
    setPendingReferences([]);
  },[project]);

  const selectedLead=useMemo(()=>leads.find(lead=>lead.id===leadId)||null,[leadId,leads]);
  const hasVisualReference=Boolean(pendingReferences.length||activeProject?.referenceImages?.length||VISUAL_REFERENCE_PATTERN.test(instruction));
  const autoSkillIds=useMemo(()=>skillOptions.filter(option=>option.auto==="core"||(option.auto==="reference"&&hasVisualReference)).map(option=>option.id),[skillOptions,hasVisualReference]);
  const activeSkillIds=skillMode==="auto"?autoSkillIds:selectedSkills;
  const effectsChanged=activeProject?signature(effects)!==signature(activeProject.effects||[]):false;
  const skillsChanged=activeProject?(skillMode!==(activeProject.skillMode||"auto")||(skillMode==="manual"&&signature(selectedSkills)!==signature(activeProject.skills||[]))):false;
  const canRefine=Boolean(instruction.trim()||pendingReferences.length||effectsChanged||skillsChanged);

  function toggleEffect(id){setEffects(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id])}
  function toggleSkill(id){if(skillMode!=="manual")return;setSelectedSkills(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id])}
  function changeSkillMode(mode){setSkillMode(mode);if(mode==="manual"&&!selectedSkills.length)setSelectedSkills(autoSkillIds)}
  function removePending(index){setPendingReferences(current=>current.filter((_,itemIndex)=>itemIndex!==index))}

  async function chooseReferences(event){
    const files=[...event.target.files].slice(0,4);event.target.value="";
    try{
      for(const file of files){if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Use apenas PNG, JPG ou WEBP.");if(file.size>5*1024*1024)throw new Error("Cada imagem pode ter no máximo 5 MB.");}
      const converted=await Promise.all(files.map(readFile));
      setPendingReferences(current=>[...current,...converted].slice(0,4));
      setNotice(converted.length?converted.length+" referência(s) pronta(s) para enviar à IA.":"");
    }catch(error){setNotice("Erro: "+error.message)}
  }

  async function createProject(event){
    event.preventDefault();if(!leadId)return;setBusy("create");setNotice("");
    try{
      const created=await createSiteProjectAction({mode:"lead",leadId,template,instruction,effects,skillMode,skills:skillMode==="auto"?autoSkillIds:selectedSkills,referenceImages:pendingReferences});
      setActiveProject(created);setEffects(created.effects||[]);setSkillMode(created.skillMode||"auto");setSelectedSkills(created.skills||[]);setPendingReferences([]);setInstruction("");
      router.push("/criar-site?lead="+encodeURIComponent(leadId)+"&project="+encodeURIComponent(created.id));router.refresh();
    }catch(error){setNotice("Erro: "+error.message)}finally{setBusy("")}
  }

  async function refine(event){
    event.preventDefault();if(!activeProject||!canRefine)return;setBusy("refine");setNotice("");
    try{
      const updated=await refineSiteProjectAction({projectId:activeProject.id,instruction,effects,skillMode,skills:skillMode==="auto"?autoSkillIds:selectedSkills,referenceImages:pendingReferences});
      setActiveProject(updated);setEffects(updated.effects||[]);setSkillMode(updated.skillMode||"auto");setSelectedSkills(updated.skills||[]);setPendingReferences([]);setInstruction("");setNotice("Alterações aplicadas. A prévia foi atualizada.");router.refresh();
    }catch(error){setNotice("Erro: "+error.message)}finally{setBusy("")}
  }

  async function clearReferences(){
    if(!activeProject)return;setBusy("references");setNotice("");
    try{const updated=await clearSiteReferenceImagesAction(activeProject.id);setActiveProject(updated);setNotice("Referências visuais removidas.");router.refresh()}
    catch(error){setNotice("Erro: "+error.message)}finally{setBusy("")}
  }

  const skillPicker=<section className={s.skills}>
    <div className={s.blockHeading}>
      <div><strong>Especialistas / Skills</strong><small>No automático o LeadFlow escolhe os especialistas ideais. No manual, você controla exatamente quais skills entram no briefing.</small></div>
      <div className={s.skillModes}>
        <button type="button" className={skillMode==="auto"?s.modeActive:""} onClick={()=>changeSkillMode("auto")}>Automático ✦</button>
        <button type="button" className={skillMode==="manual"?s.modeActive:""} onClick={()=>changeSkillMode("manual")}>Manual</button>
      </div>
    </div>
    <div className={s.skillSummary}><span>{activeSkillIds.length} skill(s) ativa(s)</span><b>{skillMode==="auto"?"Roteamento inteligente":"Seleção manual"}</b></div>
    <div className={s.skillGrid}>{skillOptions.map(option=>{
      const active=activeSkillIds.includes(option.id);
      return <button type="button" key={option.id} disabled={skillMode==="auto"} className={active?s.skillActive:s.skillOption} onClick={()=>toggleSkill(option.id)}>
        <span>{active?"✓":"+"}</span><strong>{option.label}</strong><small>{option.description}</small>{option.auto==="reference"&&skillMode==="auto"&&!active&&<em>Ativa com referência visual</em>}
      </button>;
    })}</div>
  </section>;

  const referencePicker=<section className={s.references}>
    <div className={s.blockHeading}><div><strong>Referências visuais</strong><small>Envie prints ou imagens de sites que tenham a linguagem visual desejada. Elas vão para a IA como inspiração e não entram automaticamente no site.</small></div><label className={s.uploadButton}>+ Enviar imagens<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={chooseReferences}/></label></div>
    {pendingReferences.length>0&&<div className={s.referenceGrid}>{pendingReferences.map((item,index)=><figure key={item.label+index}><img src={item.dataUrl} alt=""/><figcaption>{item.label}</figcaption><button type="button" onClick={()=>removePending(index)}>×</button></figure>)}</div>}
    {activeProject?.referenceImages?.length>0&&<div className={s.savedReferences}><span>{activeProject.referenceImages.length} referência(s) já salva(s) para este lead.</span><button type="button" disabled={busy==="references"} onClick={clearReferences}>Remover referências salvas</button></div>}
  </section>;

  const effectsPicker=<section className={s.effects}>
    <div className={s.blockHeading}><div><strong>Efeitos da página</strong><small>Você decide exatamente quais movimentos e tratamentos serão aplicados. Pode deixar tudo desligado.</small></div><div className={s.effectPresets}><button type="button" onClick={()=>setEffects([])}>Sem efeitos</button><button type="button" onClick={()=>setEffects(DEFAULT_EFFECTS)}>Padrão</button></div></div>
    <div className={s.effectGrid}>{EFFECT_OPTIONS.map(option=><button type="button" key={option.id} className={effects.includes(option.id)?s.effectActive:s.effectOption} onClick={()=>toggleEffect(option.id)}><span>{effects.includes(option.id)?"✓":"+"}</span><strong>{option.label}</strong><small>{option.description}</small></button>)}</div>
  </section>;

  if(!activeProject)return <main className={s.startPage}>
    <section className={s.startHero}><span>✦</span><h1>Criar site para um lead</h1><p>O LeadFlow usa dados do CRM, imagens reais do negócio, referências visuais e uma equipe de skills especializadas para montar uma landing page premium.</p></section>
    <form className={s.startCard} onSubmit={createProject}>
      <label><span>Lead</span><select required value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Selecione...</option>{leads.map(lead=><option key={lead.id} value={lead.id}>{lead.name} · {lead.city||lead.location||"Local não informado"}</option>)}</select></label>
      {selectedLead&&<div className={s.leadCard}><b>{selectedLead.name.slice(0,1).toUpperCase()}</b><div><strong>{selectedLead.name}</strong><small>{selectedLead.segment||"Sem categoria"} · {selectedLead.city||selectedLead.location||"Local não informado"}</small></div><a href={"/crm/"+selectedLead.id}>Abrir CRM</a></div>}
      <label><span>Tipo de projeto</span><select value={template} onChange={e=>setTemplate(e.target.value)}><option value="landing">Landing page premium</option><option value="institutional">Site institucional</option><option value="menu">Cardápio / delivery</option><option value="booking">Serviços / agendamento</option></select></label>
      {skillPicker}
      {referencePicker}
      {effectsPicker}
      <label><span>Orientação opcional</span><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Ex.: Quero algo sofisticado. Use a referência como inspiração para a composição, mas mantenha a identidade da oficina."/></label>
      <div className={s.rules}><strong>O briefing profissional já está embutido.</strong><p>As skills ativas entram de verdade no prompt do gerador. O sistema continua usando somente fatos verificáveis do lead e referências visuais apenas como direção estética.</p></div>
      <button className={s.primary} disabled={busy==="create"}>{busy==="create"?"Criando site...":"Criar prévia com IA"}</button>
      {notice&&<div className={notice.startsWith("Erro")?s.error:s.success}>{notice}</div>}
    </form>
  </main>;

  const previewSrc="/preview-internal/"+activeProject.id+"?v="+activeProject.version;
  const history=activeProject.instructions||[];
  return <main className={s.builderPage}>
    <header className={s.builderHeader}><div><a href={activeProject.leadId?"/crm/"+activeProject.leadId:"/projetos"}>← Voltar</a><h1>{activeProject.name}</h1><p>Versão {activeProject.version||1} · {activeProject.imageCount||0} imagens · {activeProject.referenceImages?.length||0} referências · {activeProject.skills?.length||0} skills</p></div><div className={s.headerActions}><a className={s.download} href={"/api/projects/"+activeProject.id+"/zip"}>Baixar ZIP</a><a href="/projetos">Projetos</a></div></header>
    <section className={s.builder}>
      <aside className={s.chatPanel}>
        <div className={s.context}><span>Projeto ativo</span><strong>{activeProject.segment||"Landing page"}</strong><small>{activeProject.city||"Local não informado"}</small></div>
        <div className={s.history}>{history.map((item,index)=><div className={s.message} key={index}><small>{index===0?"Briefing inicial":"Alteração "+index}</small><p>{item}</p></div>)}</div>
        <form className={s.promptBox} onSubmit={refine}>
          {skillPicker}
          {referencePicker}
          {effectsPicker}
          <label><span>O que você quer mudar?</span><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Ex.: Corrija o CTA do header, deixe o hero mais técnico e aproxime a composição da imagem de referência."/></label>
          <button className={s.primary} disabled={busy==="refine"||!canRefine}>{busy==="refine"?"Aplicando alteração...":"Aplicar alterações"}</button>
        </form>
        {activeProject.warning&&<div className={s.warning}>{activeProject.warning}</div>}
        {notice&&<div className={notice.startsWith("Erro")?s.error:s.success}>{notice}</div>}
      </aside>
      <section className={s.previewPanel}><div className={s.previewToolbar}><div><button className={device==="desktop"?s.active:""} onClick={()=>setDevice("desktop")}>Desktop</button><button className={device==="tablet"?s.active:""} onClick={()=>setDevice("tablet")}>Tablet</button><button className={device==="mobile"?s.active:""} onClick={()=>setDevice("mobile")}>Mobile</button></div><a href={previewSrc} target="_blank" rel="noopener noreferrer">Abrir prévia ↗</a></div><div className={s.canvas}><div className={s["device-"+device]}><iframe key={previewSrc} title={"Prévia de "+activeProject.name} src={previewSrc}/></div></div></section>
    </section>
  </main>;
}
