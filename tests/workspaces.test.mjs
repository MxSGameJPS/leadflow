import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const leadId = `test_contact_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const workspaceFile = path.join(root, "data", "lead-workspaces", `${leadId}.json`);

const { getLeadWorkspace, saveLeadWorkspace } = await import("../src/services/workspaces/leadWorkspaceStore.js");

try {
  const empty = await getLeadWorkspace(leadId);
  assert.equal(empty.lastContactAt, "");
  assert.equal(empty.lastContactKind, "");
  assert.equal(empty.contactCount, 0);

  const first = await saveLeadWorkspace(leadId, {
    lastContactAt: "2026-08-08T13:00:00.000Z",
    lastContactKind: "initial",
    contactCount: 1,
  });
  assert.equal(first.lastContactAt, "2026-08-08T13:00:00.000Z");
  assert.equal(first.lastContactKind, "initial");
  assert.equal(first.contactCount, 1);

  const second = await saveLeadWorkspace(leadId, {
    lastContactAt: "2026-08-09T14:30:00.000Z",
    lastContactKind: "followup",
    contactCount: 2,
  });
  assert.equal(second.lastContactKind, "followup");
  assert.equal(second.contactCount, 2);

  const loaded = await getLeadWorkspace(leadId);
  assert.equal(loaded.lastContactAt, "2026-08-09T14:30:00.000Z");
  assert.equal(loaded.lastContactKind, "followup");
  assert.equal(loaded.contactCount, 2);

  const sanitized = await saveLeadWorkspace(leadId, {
    lastContactKind: "tipo-invalido",
    contactCount: -10,
  });
  assert.equal(sanitized.lastContactKind, "");
  assert.equal(sanitized.contactCount, 0);

  console.log("Testes de workspace passaram.");
} finally {
  await fs.rm(workspaceFile, { force: true });
}
