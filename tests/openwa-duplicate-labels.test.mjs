import assert from "node:assert/strict";
import { test } from "node:test";
import { selectProspectingLabels } from "../src/services/whatsapp/openwaInbox.js";
test("finds both duplicate prospecting labels with distinct IDs", () => {
  const labels = [{id:"1",name:"Prospecção de Cliente"},{id:"2",name:"Família"},{id:"3",name:"Prospecção de Cliente"}];
  assert.deepEqual(selectProspectingLabels(labels).map(label=>label.id),["1","3"]);
});
test("deduplicates repeated label IDs", () => {
  assert.equal(selectProspectingLabels([{id:"1",name:"Prospecção de Cliente"},{id:"1",name:"Prospecção de Cliente"}]).length,1);
});
test("never includes unrelated labels", () => {
  assert.deepEqual(selectProspectingLabels([{id:"7",name:"Família"}]),[]);
});
