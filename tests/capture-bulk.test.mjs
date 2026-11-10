import test from "node:test";
import assert from "node:assert/strict";
import {candidatePhone} from "../src/services/capture/bulkApproval.js";
import {buildCaptureMessage} from "../src/services/capture/approaches.js";

test("normaliza número nacional encontrado na busca",()=>{
 assert.equal(candidatePhone({phone:"(51) 99999-8888"}),"5551999998888");
});
test("usa telefone alternativo quando WhatsApp cadastrado está incorreto",()=>{
 assert.equal(candidatePhone({whatsapp:"sem número",phone:"51 99999-8888"}),"5551999998888");
});
test("não inventa destino quando o cadastro está incompleto",()=>{
 assert.equal(candidatePhone({whatsapp:"",phone:""}),null);
});
test("mantém o link real de prévias nas abordagens automáticas",()=>{
 const msg=buildCaptureMessage({name:"Loja de Exemplo",segment:"varejo",id:"lead-teste"},"oportunidade");
 assert.match(msg,/www\.saulopavanello\.com\.br\/previas/);
 assert.doesNotMatch(msg,/já preparamos sua prévia/i);
});
