import test from "node:test";
import {capturePreparationBlockers} from "../src/services/capture/campaignPreparationUiState.js";
import assert from "node:assert/strict";
import {validateCampaignDraft,campaignBlockers,checkCampaignPreparationState,CAMPAIGN_BATCH_LIMIT} from "../src/services/capture/campaignPreparationPolicy.js";
const lead={name:"Loja Teste",stage:"novo",phone:"51999998888",notes:""};
const approval={sessionId:"sessao",status:"approved",sentAt:null,approvedAt:new Date("2026-11-11T08:00:00Z"),chatId:"5551999998888@c.us"};
const cleanWorkspace={contactCount:0,lastContactAt:null};
test("primeiro contato permite prévia gratuita sem antecipar o preço",()=>{
 assert.equal(validateCampaignDraft("Olá, nesta Black Friday temos uma página por R$ 500. Posso preparar uma prévia gratuita para sua loja?").includes("R$ 500"),true);
 assert.throws(()=>validateCampaignDraft("Olá! Tenho uma proposta interessante para o seu negócio, podemos conversar?"),/R\$ 500/);
 assert.throws(()=>validateCampaignDraft("Oi! Por R$ 500 já preparei uma prévia gratuita para você, garanto resultados."),/alegações/);
});
test("conversão permite somente aprovados sem histórico e mesmo telefone",()=>{
 assert.deepEqual(campaignBlockers({mode:"convert",lead,approval,sessionId:"sessao",phone:"5551999998888",workspace:cleanWorkspace}),[]);
 assert.ok(campaignBlockers({mode:"convert",lead,approval:{...approval,status:"sent"},sessionId:"sessao",phone:"5551999998888",workspace:cleanWorkspace}).length>0);
 assert.ok(campaignBlockers({mode:"convert",lead,approval,sessionId:"sessao",phone:"5511999999999",workspace:cleanWorkspace}).some(x=>x.includes("Número")));
});
test("recusa, contato anterior e recuperação bloqueiam a conversão",()=>{
 const problems=campaignBlockers({mode:"convert",lead:{...lead,notes:"Não tenho interesse"},approval,workspace:{contactCount:1},sessionId:"sessao",phone:"5551999998888",hasConflict:true});
 assert.ok(problems.some(x=>x.includes("recusa")));
 assert.ok(problems.some(x=>x.includes("contato")));
 assert.ok(problems.some(x=>x.includes("Recuperação")));
});
test("lead novo não pode substituir registro antigo nem usar conversa já vinculada",()=>{
 assert.deepEqual(campaignBlockers({mode:"new",lead,approval:null,workspace:cleanWorkspace,sessionId:"sessao",phone:"5551999998888"}),[]);
 assert.ok(campaignBlockers({mode:"new",lead,approval,workspace:cleanWorkspace,sessionId:"sessao",phone:"5551999998888",hasLinkedChat:true}).length>=2);
});
test("nenhuma alteração de campanha enquanto captação estiver ativa ou houver envio em andamento",()=>{
 assert.throws(()=>checkCampaignPreparationState({campaignActive:true,running:true,inFlight:0,mode:"convert"}),/Pause a Captação/);
 assert.throws(()=>checkCampaignPreparationState({campaignActive:true,running:false,inFlight:1,mode:"convert"}),/envio em andamento/);
 assert.throws(()=>checkCampaignPreparationState({campaignActive:false,running:false,inFlight:0,mode:"convert"}),/Ative a campanha/);
 assert.doesNotThrow(()=>checkCampaignPreparationState({campaignActive:true,running:false,inFlight:0,mode:"new",intakePaused:false}));
 assert.equal(CAMPAIGN_BATCH_LIMIT,10);
});

test("botão da campanha mostra o bloqueio quando Captação está ligada",()=>{
 const reasons=capturePreparationBlockers({active:true,running:true,inFlight:0,reviewed:true,queue:[{mode:"convert"}]});
 assert.equal(reasons.length,1);
 assert.match(reasons[0],/Pause a Captação/);
});
test("botão é liberado após sincronizar pausa sem perder seleção nem revisão",()=>{
 const selected=[{mode:"convert",leadId:"lead-a"}];
 assert.deepEqual(capturePreparationBlockers({active:true,running:false,inFlight:0,reviewed:true,queue:selected}),[]);
});
test("botão continua bloqueado se houver envio em andamento ou nova entrada pausada",()=>{
 assert.ok(capturePreparationBlockers({active:true,running:false,inFlight:1,reviewed:true,queue:[{mode:"convert"}]}).some(x=>/envio em andamento/.test(x)));
 assert.ok(capturePreparationBlockers({active:true,running:false,inFlight:0,intakePaused:true,reviewed:true,queue:[{mode:"new"}]}).some(x=>/novas aprovações/.test(x)));
 assert.ok(capturePreparationBlockers({active:true,running:false,inFlight:0,reviewed:true,queue:[{mode:"convert"}],statusError:true}).some(x=>/Atualizar status/.test(x)));
});
