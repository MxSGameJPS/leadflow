"use client";
import {useEffect,useState} from "react";
import styles from "./SocialPermissions.module.css";
const options=[["research","Pesquisa e análise de tendências"],["planning","Planejamento de calendário"],["approvedPublishing","Publicação de posts previamente aprovados"],["replySuggestions","Sugestões de respostas por IA"],["crmRegistration","Registro manual de oportunidades no CRM"],["autoReplies","Responder sem aprovação (não disponível)"],["autoStrategyChanges","Alterar estratégia sem revisão (não disponível)"]];
export default function SocialPermissions(){
 const [permissions,setPermissions]=useState(null),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
 async function load(){try{const r=await fetch("/api/social/permissions",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error);setPermissions(d.permissions)}catch(e){setStatus(e.message)}}
 useEffect(()=>{load()},[]);
 async function save(){setBusy(true);setStatus("");try{const r=await fetch("/api/social/permissions",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({permissions})});const d=await r.json();if(!r.ok)throw Error(d.error);setPermissions(d.permissions);setStatus("Permissões salvas neste computador.")}catch(e){setStatus(e.message)}finally{setBusy(false)}}
 return <section className={styles.panel}><h2>Permissões do agente</h2><p>Preferências persistidas localmente. Publicações e respostas continuam sujeitas às aprovações atuais. Respostas automáticas e mudanças autônomas de estratégia permanecem indisponíveis.</p>{permissions?<><div className={styles.options}>{options.map(([key,label])=><label key={key}><input type="checkbox" disabled={busy||key==="autoReplies"||key==="autoStrategyChanges"} checked={!!permissions[key]} onChange={e=>setPermissions(p=>({...p,[key]:e.target.checked}))}/><span>{label}</span></label>)}</div><button type="button" onClick={save} disabled={busy}>{busy?"Salvando...":"Salvar permissões"}</button></>:<p>Carregando preferências...</p>}{status&&<p role="status">{status}</p>}</section>;
}
