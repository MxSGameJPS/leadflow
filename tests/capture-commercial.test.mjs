import test from "node:test";
import assert from "node:assert/strict";
import {captureNextStep,summarizeCapturePerformance} from "../src/services/capture/commercialIntelligence.js";
import {evaluateSecondAttempt,addBusinessDays} from "../src/services/recovery/secondAttempt.js";
const first=new Date("2026-11-02T12:00:00Z");
const history=[{chatId:"5511999999999@c.us",fromMe:true,body:"Primeiro contato",at:first}];
test("resposta positiva deve ser priorizada para conversa",()=>{
 const result=captureNextStep({replyStatus:"replied",replyCategory:"positive_intent"});
 assert.equal(result.priority,5);
 assert.match(result.action,/conversa/);
});
test("recusa bloqueia nova abordagem",()=>{
 const result=captureNextStep({replyStatus:"replied",replyCategory:"opt_out"});
 assert.equal(result.priority,0);
 assert.equal(result.label,"Não contatar");
});
test("somente envio confirmado integra indicadores",()=>{
 const data=summarizeCapturePerformance([{status:"sent",segment:"Padaria",replyStatus:"replied",replyCategory:"positive_intent",meetingAt:"2026-11-10T12:00:00Z",outcome:"meeting_scheduled"},{status:"approved",segment:"Padaria",replyStatus:"unverified"}]);
 assert.equal(data.sent,1);assert.equal(data.replied,1);assert.equal(data.meetings,1);assert.equal(data.segments[0].sent,1);
});
test("espera cinco dias úteis antes da segunda tentativa",()=>{
 const before=evaluateSecondAttempt({history,firstSentAt:first,now:new Date("2026-11-04T12:00:00Z")});
 const after=evaluateSecondAttempt({history,firstSentAt:first,now:new Date("2026-11-10T12:00:00Z")});
 assert.equal(before.status,"waiting");assert.equal(after.status,"review");assert.equal(addBusinessDays(first).getUTCDay(),1);
});
test("resposta posterior bloqueia segundo contato",()=>{
 const reply={chatId:history[0].chatId,fromMe:false,body:"Tenho interesse",at:new Date("2026-11-03T12:00:00Z")};
 const result=evaluateSecondAttempt({history:[...history,reply],firstSentAt:first,now:new Date("2026-11-20T12:00:00Z")});
 assert.equal(result.status,"blocked");
});
test("nova mensagem manual encerra o ciclo",()=>{
 const other={chatId:history[0].chatId,fromMe:true,body:"Voltei a escrever",at:new Date("2026-11-06T12:00:00Z")};
 const result=evaluateSecondAttempt({history:[...history,other],firstSentAt:first,now:new Date("2026-11-20T12:00:00Z")});
 assert.equal(result.status,"closed");
});
