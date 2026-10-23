import test from "node:test";
import assert from "node:assert/strict";
import { canSend } from "../src/services/recovery/decisionEngine.js";
test("only manually approved and consent-confirmed messages are queueable",()=>{
 assert.equal(canSend({status:"message_approved",consentConfirmed:true,messageText:"Olá",sentAt:null}),true);
 assert.equal(canSend({status:"eligible",consentConfirmed:true,messageText:"Olá"}),false);
 assert.equal(canSend({status:"message_approved",consentConfirmed:false,messageText:"Olá"}),false);
 assert.equal(canSend({status:"message_approved",consentConfirmed:true,messageText:""}),false);
});
