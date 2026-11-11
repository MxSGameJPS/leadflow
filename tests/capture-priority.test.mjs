import test from "node:test";
import assert from "node:assert/strict";
import {scoreCaptureLead,rankCaptureCandidates} from "../src/services/capture/prioritization.js";
import {captureSegmentBenefit,buildCaptureMessage,captureApproachForLead} from "../src/services/capture/approaches.js";

const lead={id:"a1",name:"Padaria Exemplo",segment:"Padaria",city:"Portão",phone:"51999998888",stage:"novo",problem:"perdendo pedidos",score:40};
test("problema registrado gera justificativa, sem comprovação de compra",()=>{
 const result=scoreCaptureLead(lead);
 assert.equal(result.eligible,true);
 assert.ok(result.score>0);
 assert.ok(result.reasons.some(x=>x.includes("problema")));
 assert.notEqual(result.confidence,"compra confirmada");
});
test("contato em recuperação não deve entrar na fila elegível",()=>{
 const ranked=rankCaptureCandidates([lead],{recoveryChatIds:["5551999998888@c.us"]});
 assert.equal(ranked[0].eligible,false);
 assert.ok(ranked[0].warnings.some(x=>x.includes("Recuperação")));
});
test("lead com registro de captação não deve ser priorizado novamente",()=>{
 const ranked=rankCaptureCandidates([lead],{approvals:[{leadId:"a1"}]});
 assert.equal(ranked[0].eligible,false);
});
test("não presumir necessidade apenas porque site não foi informado",()=>{
 const result=scoreCaptureLead({id:"b",name:"Empresa",phone:"51999998888",stage:"novo"});
 assert.ok(result.reasons.some(x=>x.includes("não prova")));
 assert.ok(result.warnings.some(x=>x.includes("Intenção")));
});
test("oferta Black Friday inclui R$ 500 e prévia ainda não criada",()=>{
 const msg=buildCaptureMessage(lead,"black_friday");
 assert.ok(msg.includes("R$ 500"));
 assert.match(msg,/Black Friday/i);
 assert.match(msg,/prévia gratuita/i);
 assert.doesNotMatch(msg,/prévia já pronta|já preparamos/i);
 assert.ok(msg.length<400);
 assert.equal(captureApproachForLead(lead,{blackFriday:true}),"black_friday");
 assert.notEqual(captureApproachForLead(lead),"black_friday");
});
test("mensagem por segmento inclui benefício e portfólio sem prometer diagnóstico",()=>{
 assert.match(captureSegmentBenefit(lead),/cardápio/);
 const msg=buildCaptureMessage(lead,"oportunidade");
 assert.match(msg,/cardápio/);
 assert.match(msg,/saulopavanello.com.br\/previas/);
 assert.doesNotMatch(msg,/já identificamos|site está com problema/i);
});
