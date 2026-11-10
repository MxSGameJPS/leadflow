const clamp=(n)=>Math.max(0,Math.min(100,Math.round(n)));
const has=(v)=>typeof v==="string"&&v.trim().length>0;
const normal=(s)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const CLOSED=new Set(["ganho","perdido","descartado","excluido"]);
const ACTIVE=new Set(["contatado","sem_resposta","com_resposta","proposta","negociacao","proposta_rejeitada"]);
const purchase=/\b(preciso|precisamos|procurando|contratar|orcamento|solicitei|quero criar|queremos criar|integrar sistema|automatizar pedidos)\b/;
const pain=/\b(perdendo pedidos|controle manual|sem controle|site lento|site fora do ar|sem site|dificuldade com pedidos|demora no atendimento)\b/;
const avoid=/\b(nao tenho interesse|sem interesse|nao quero receber|pare de enviar|remova meu contato)\b/;
export function scoreCaptureLead(lead,{alreadyContacted=false,hasRecovery=false}={}){
 const reasons=[],warnings=[];
 if(!lead||!has(lead.name))return {score:0,band:"blocked",eligible:false,reasons:[],warnings:["Cadastro sem empresa identificada."],confidence:"insuficiente"};
 if(CLOSED.has(normal(lead.stage)))warnings.push("Lead encerrado no CRM.");
 if(ACTIVE.has(normal(lead.stage)))warnings.push("Lead já está em acompanhamento comercial.");
 if(alreadyContacted)warnings.push("Já possui registro de Captação.");
 if(hasRecovery)warnings.push("Consta na Recuperação; não duplicar abordagem.");
 const phone=String(lead.whatsapp||lead.phone||"").replace(/\D/g,"");
 if(![10,11,12,13].includes(phone.length))warnings.push("Contato telefônico precisa de validação.");
 const evidence=normal([lead.problem,lead.offer,lead.reason,lead.nextAction].filter(Boolean).join(" "));
 if(avoid.test(evidence))warnings.push("Há indicação de recusa: revisar antes de contatar.");
 const explicit=purchase.test(evidence),problem=pain.test(evidence);
 let score=10;
 if(explicit){score+=38;reasons.push("Há sinal textual de possível intenção comercial nos dados cadastrados.");}
 else if(problem){score+=23;reasons.push("Há problema comercial descrito no cadastro.");}
 if(has(lead.problem)&&!explicit&&!problem){score+=8;reasons.push("Cadastro contém uma observação de necessidade a verificar.");}
 if(has(lead.segment)){score+=8;reasons.push("Segmento identificado: "+String(lead.segment).slice(0,65));}
 if(has(lead.city)){score+=5;reasons.push("Localização comercial informada.");}
 if(has(lead.site)){score+=4;reasons.push("Site cadastrado para análise posterior.");}
 else {score+=5;reasons.push("Site não informado; isso não prova que a empresa não possui site.");}
 if(has(lead.instagram))score+=4;
 if(has(lead.whatsapp)||has(lead.phone))score+=7;
 if(Number.isFinite(Number(lead.score))&&Number(lead.score)>0){score+=Math.min(10,Math.round(Number(lead.score)/10));reasons.push("Pontuação prévia do cadastro considerada com peso limitado.");}
 const eligible=warnings.length===0;
 if(!explicit&&!problem)warnings.push("Intenção de compra ainda não demonstrada.");
 const final=clamp(score);
 return {score:final,band:!eligible?"blocked":final>=70?"high":final>=45?"medium":"low",eligible,confidence:explicit?"indício explícito no cadastro":problem?"problema registrado":"inferência preliminar",reasons,warnings};
}
export function rankCaptureCandidates(leads,{approvals=[],recoveryChatIds=[]}={}){
 const used=new Set(approvals.map(x=>x.leadId));
 const digits=value=>String(value||"").replace(/\D/g,"");
 const normalized=value=>{const x=digits(value);return x.startsWith("55")&&[12,13].includes(x.length)?x.slice(2):x;};
 const recovered=new Set(recoveryChatIds.map(normalized).filter(x=>[10,11].includes(x.length)));
 return leads.map(lead=>{
  const phones=[lead.whatsapp,lead.phone].map(normalized).filter(x=>[10,11].includes(x.length));
  const hasRecovery=phones.some(phone=>recovered.has(phone));
  return {...scoreCaptureLead(lead,{alreadyContacted:used.has(lead.id),hasRecovery}),id:lead.id,name:lead.name,segment:lead.segment||"",city:lead.city||""};
 }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score||String(a.name).localeCompare(String(b.name),"pt-BR"));
}
