import test from "node:test";
import assert from "node:assert/strict";
import {auditConversation} from "../src/services/recovery/historyAudit.js";
test("reports incoming after first approach without human decisions",()=>{
 const messages=[{direction:"outgoing",timestamp:100,body:"Oi"},{direction:"incoming",timestamp:110,body:"Olá"}];
 const result=auditConversation(messages,2);
 assert.equal(result.replyAfterApproach,true);
 assert.equal(result.suggestedStatus,"review");
});
test("marks partial histories rather than asserting silence",()=>{
 const result=auditConversation([{direction:"outgoing",timestamp:100}],50);
 assert.equal(result.historyIncomplete,true);
 assert.equal(result.suggestedStatus,"potentially_unanswered");
});
