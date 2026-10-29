"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import styles from "./IntelligenceAnalyzeReply.module.css";
const names={automatic:"Resposta automática",refusal:"Recusa",opt_out:"Não contatar",interested:"Interesse",question:"Dúvida",price_objection:"Preço",timing_objection:"Momento",existing_provider:"Outro fornecedor",uncertain:"Indefinido"};
export default function IntelligenceAnalyzeReply({id,category,reasoning,recommendation,disabled}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function analyze(){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/intelligence/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Falha na análise");
   router.refresh();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className={styles.content}>
  {category&&<><strong>{names[category]||category}</strong><small>{reasoning}</small><small>{recommendation}</small></>}
  <button type="button" onClick={analyze} disabled={busy||disabled}>{busy?"Analisando...":category?"Reanalisar com IA":"Analisar com IA"}</button>
  {disabled&&<small>Histórico indisponível ou resposta sem texto.</small>}
  {error&&<small role="alert" className={styles.error}>{error}</small>}
 </div>;
}
