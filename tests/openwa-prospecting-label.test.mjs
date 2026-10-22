import { test } from "node:test";
import assert from "node:assert/strict";
import { selectProspectingLabel } from "../src/services/whatsapp/openwaInbox.js";

test("selects WhatsApp Business label in singular", () => {
  const labels = [{ id: "7", name: "Prospecção de Cliente" }, { id: "8", name: "Família" }];
  assert.equal(selectProspectingLabel(labels)?.id, "7");
});
test("supports plural as a fallback when singular is absent", () => {
  assert.equal(selectProspectingLabel([{ id: "3", name: "Prospecção de Clientes" }])?.id, "3");
});
test("does not select unrelated labels", () => {
  assert.equal(selectProspectingLabel([{ id: "9", name: "Clientes" }]), null);
});
test("does not guess when multiple alias matches exist", () => {
  assert.equal(selectProspectingLabel([{ id: "1", name: "Prospecção de Clientes" }, { id: "2", name: "Prospecção de Cliente" }], "Outra etiqueta"), null);
});
