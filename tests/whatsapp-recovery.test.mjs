import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyRecoveryLead, draftReengagement, summarizeRecovery } from "../src/services/whatsapp/salesPipeline.js";

test("silence never grants send permission", () => {
  assert.equal(classifyRecoveryLead({ name: "Loja", phone: "51999999999", stage: "novo" }).status, "review");
});
test("opt-out and refusals stay excluded", () => {
  assert.equal(classifyRecoveryLead({ phone: "51999999999", notes: "Não tenho interesse" }).status, "excluded");
  assert.equal(classifyRecoveryLead({ phone: "51999999999", stage: "recusado" }).status, "excluded");
});
test("triage keeps every lead exactly once", () => {
  const groups = summarizeRecovery([{ id:"1", phone:"123" },{ id:"2" },{ id:"3",phone:"123",stage:"recusado" }]);
  assert.equal(Object.values(groups).reduce((n,rows)=>n+rows.length,0),3);
});
test("draft is honest and includes an easy exit", () => {
  assert.match(draftReengagement({name:"Loja A"}), /Loja A/);
  assert.match(draftReengagement({name:"Loja A"}), /não vou insistir/);
});
