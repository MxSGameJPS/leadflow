import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICY,validatePolicy,validateProposal,createCommercialInstructions } from "../src/services/commercial/policy.js";
test("keeps meeting and entry rules",()=>{
 assert.throws(()=>validatePolicy({...DEFAULT_POLICY,requiresMeetingBeforeClosing:false}));
 assert.throws(()=>validatePolicy({...DEFAULT_POLICY,entryPercent:40}));
});
test("prevents discounts beyond policy",()=>{
 assert.equal(validateProposal(DEFAULT_POLICY,{serviceId:"express",quotedPrice:399}).allowed,false);
 assert.equal(validateProposal(DEFAULT_POLICY,{serviceId:"delivery",quotedPrice:1019}).allowed,false);
 assert.equal(validateProposal(DEFAULT_POLICY,{serviceId:"delivery",quotedPrice:1020}).allowed,true);
});
test("blocks closing before meeting",()=>{
 assert.equal(validateProposal(DEFAULT_POLICY,{serviceId:"express",quotedPrice:450,close:true}).allowed,false);
 assert.equal(validateProposal(DEFAULT_POLICY,{serviceId:"express",quotedPrice:450,close:true,meetingCompleted:true}).allowed,true);
});
test("instructions include commercial policy",()=>{
 const text=createCommercialInstructions(DEFAULT_POLICY);
 assert.match(text,/Vitrine Delivery/);assert.match(text,/reunião/);assert.match(text,/50%/);
});
