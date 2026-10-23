import test from "node:test";
import assert from "node:assert/strict";
import {nextDecision,canSend} from "../src/services/recovery/decisionEngine.js";
test("AI cannot decide automatically: only explicit manual actions advance",()=>{
 assert.equal(nextDecision(null,"eligible"),"eligible");
 assert.throws(()=>nextDecision(null,"message_approved"));
 assert.equal(nextDecision({status:"eligible"},"ineligible"),"ineligible");
 assert.equal(nextDecision({status:"ineligible"},"eligible"),"eligible");
});
test("send is disabled even when approved",()=>{
 assert.throws(()=>nextDecision({status:"message_approved"},"sent"));
 assert.equal(canSend({status:"eligible"}),false);
});
test("closing requires explicit post-send state",()=>{
 assert.throws(()=>nextDecision(null,"close_approved"));
 assert.equal(nextDecision({status:"sent"},"close_approved"),"close_approved");
});
