import test from "node:test";
import assert from "node:assert/strict";
import {validateCampaignDraft,campaignBlockers,checkCampaignPreparationState,CAMPAIGN_BATCH_LIMIT} from "../src/services/capture/campaignPreparationPolicy.js";
const lead={name:"Loja Teste",stage:"novo",phone:"51999998888",notes:""};
const approval={sessionId:"sessao",status:"approved",sentAt:null,approvedAt:new Date("2026-11-11T08:00:00Z"),chatId:"5551999998888@c.us"};
const cleanWorkspace={contactCount:0,lastContactAt:null};
test("mensagem da oferta precisa ser curta, trazer valor e prévia",()=>{
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
