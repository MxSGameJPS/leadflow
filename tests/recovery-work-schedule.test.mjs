import test from "node:test";
import assert from "node:assert/strict";
import {getWorkWindow,getRecoveryRest} from "../src/services/recovery/workSchedule.js";
const d=s=>new Date(s);
test("starts at 08:00 and stops at 18:00 Sao Paulo",()=>{
 assert.equal(getWorkWindow(d("2026-10-26T10:59:00Z")).working,false);
 assert.equal(getWorkWindow(d("2026-10-26T11:00:00Z")).working,true);
 assert.equal(getWorkWindow(d("2026-10-26T20:59:00Z")).working,true);
 assert.equal(getWorkWindow(d("2026-10-26T21:00:00Z")).working,false);
});
test("wait 30 minutes after last send; reply ends rest",()=>{
 const sent=d("2026-10-26T13:00:00Z");
 assert.equal(getRecoveryRest({now:d("2026-10-26T13:29:00Z"),lastSentAt:sent}).resting,true);
 assert.equal(getRecoveryRest({now:d("2026-10-26T13:30:00Z"),lastSentAt:sent}).resting,false);
 const wake=getRecoveryRest({now:d("2026-10-26T13:08:00Z"),lastSentAt:sent,lastReplyAt:d("2026-10-26T13:05:00Z")});
 assert.equal(wake.resting,false);
 assert.equal(wake.reason,"reply_woke_agent");
});
