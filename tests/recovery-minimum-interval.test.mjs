import test from "node:test";
import assert from "node:assert/strict";
import {getRecoveryRest,REST_MS} from "../src/services/recovery/workSchedule.js";

const sent=new Date(2026,10,10,9,0,0);
const after=(minutes)=>new Date(sent.getTime()+minutes*60*1000);

test("sem resposta: primeiro minuto deve permanecer bloqueado",()=>{
 const state=getRecoveryRest({now:after(1),lastSentAt:sent});
 assert.equal(state.working,true);
 assert.equal(state.resting,true);
 assert.equal(state.reason,"minimum_interval");
});
test("resposta do cliente não cancela o intervalo mínimo dos disparos",()=>{
 const state=getRecoveryRest({now:after(1),lastSentAt:sent,lastReplyAt:new Date(sent.getTime()+30*1000)});
 assert.equal(state.resting,true);
 assert.equal(state.restUntil.getTime()-sent.getTime(),REST_MS);
});
test("29 minutos e 59 segundos continuam bloqueados",()=>{
 const state=getRecoveryRest({now:new Date(sent.getTime()+REST_MS-1000),lastSentAt:sent,lastReplyAt:after(2)});
 assert.equal(state.resting,true);
});
test("após 30 minutos exatos o próximo contato pode ficar elegível",()=>{
 const state=getRecoveryRest({now:new Date(sent.getTime()+REST_MS),lastSentAt:sent,lastReplyAt:after(1)});
 assert.equal(state.resting,false);
});
test("fora do expediente envio continua bloqueado",()=>{
 const state=getRecoveryRest({now:new Date(2026,10,10,18,1),lastSentAt:sent});
 assert.equal(state.working,false);
});
