import test from "node:test";
import assert from "node:assert/strict";
import {CAPTURE_DAILY_LIMIT,captureCanDispatch,getCaptureDailyUsage} from "../src/services/capture/dailyQuota.js";

test("Captação comporta no máximo 20 envios diários",()=>{
 assert.equal(CAPTURE_DAILY_LIMIT,20);
 assert.equal(captureCanDispatch(0),true);
 assert.equal(captureCanDispatch(10),true);
 assert.equal(captureCanDispatch(19),true);
 assert.equal(captureCanDispatch(20),false);
 assert.equal(captureCanDispatch(21),false);
});
test("contagem soma primeiros contatos, follow-ups e tentativas incertas",async()=>{
 const calls=[];
 const count=model=>async({where})=>{
  calls.push({model,where});
  const confirmed=where.status==="sent";
  return model==="initial"?(confirmed?15:1):(confirmed?2:2);
 };
 const db={captureApproval:{count:count("initial")},captureFollowup:{count:count("followup")}};
 const usage=await getCaptureDailyUsage(db,"session-test",new Date(2026,10,11,12));
 assert.deepEqual(usage,{limit:20,used:20,confirmed:17,remaining:0});
 assert.equal(calls.length,4);
 assert.ok(calls.every(x=>x.where.sessionId==="session-test"));
 assert.ok(calls.some(x=>x.where.dayKey==="2026-11-11"));
 assert.ok(calls.some(x=>x.where.sentAt?.gte instanceof Date));
});
test("sem sessão, cota vazia sem consultas ao banco",async()=>{
 assert.deepEqual(await getCaptureDailyUsage(null,null),{limit:20,used:0,confirmed:0,remaining:20});
});
