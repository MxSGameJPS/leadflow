import test from "node:test";
import assert from "node:assert/strict";
import {getWorkWindow,getRecoveryRest} from "../src/services/recovery/workSchedule.js";
const local=(hour,minute)=>new Date(2026,9,26,hour,minute,0,0);
test("uses Windows local hours: 08:00 inclusive, 18:00 exclusive",()=>{
 assert.equal(getWorkWindow(local(7,59)).working,false);
 assert.equal(getWorkWindow(local(8,0)).working,true);
 assert.equal(getWorkWindow(local(17,59)).working,true);
 assert.equal(getWorkWindow(local(18,0)).working,false);
});
test("rests for 30 minutes after last sent unless recipient replies",()=>{
 const sent=local(10,0);
 assert.equal(getRecoveryRest({now:local(10,29),lastSentAt:sent}).resting,true);
 assert.equal(getRecoveryRest({now:local(10,30),lastSentAt:sent}).resting,false);
 const wake=getRecoveryRest({now:local(10,8),lastSentAt:sent,lastReplyAt:local(10,5)});
 assert.equal(wake.resting,false);
 assert.equal(wake.reason,"reply_woke_agent");
});
