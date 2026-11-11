// Condições exibidas pelo painel e revalidadas no servidor ao confirmar.
export function capturePreparationBlockers({active=false,running=false,inFlight=0,intakePaused=false,reviewed=false,queue=[],busy=false,statusError=false}={}){
 const reasons=[];
 if(!active)reasons.push("Ative a campanha Black Friday no painel superior.");
 if(running)reasons.push("Pause a Captação no painel superior; a preparação não modifica uma fila em execução.");
 if(inFlight>0)reasons.push("Há envio em andamento ou pendente de confirmação. Verifique a fila antes de continuar.");
 if(!queue.length)reasons.push("Selecione pelo menos um contato.");
 if(queue.some(x=>x.mode==="new")&&intakePaused)reasons.push("Retome as novas aprovações no CRM para preparar leads novos.");
 if(!reviewed)reasons.push("Marque a confirmação de revisão dos destinatários e das mensagens.");
 if(busy)reasons.push("Aguarde a operação atual terminar.");
 if(statusError)reasons.push("Não foi possível atualizar o status. Clique em Atualizar status.");
 return reasons;
}
