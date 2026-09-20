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
  assert.deepEqual(empty.strategyMap, { nodes: [], edges: [] });
  assert.equal(empty.objectionAssistant.conversation, "");
  assert.equal(empty.objectionAssistant.tone, "natural");

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
    strategyMap: {
      nodes: [
        { id: "lead", title: "Lead", type: "lead", status: "done", x: 20, y: 30 },
        { id: "contato", title: "Contato", type: "contact", status: "active", x: 250, y: 30 },
      ],
      edges: [
        { id: "e1", from: "lead", to: "contato" },
        { id: "invalida", from: "lead", to: "nao_existe" },
      ],
    },
    objectionAssistant: {
      conversation: "CLIENTE: Achei caro.",
      tone: "consultative",
      objective: "negotiate",
      objectionType: "Preço",
      interestLevel: "médio",
      interpretation: "Existe interesse, mas o valor virou barreira.",
      response: "Entendo. Posso te explicar o que está incluído?",
      nextStep: "Entender qual parte do investimento gerou dúvida.",
      lastAnalyzedAt: "2026-09-20T18:00:00.000Z",
      providerName: "Teste",
      model: "modelo-teste",
    },
  });
  assert.equal(sanitized.lastContactKind, "");
  assert.equal(sanitized.contactCount, 0);
  assert.equal(sanitized.strategyMap.nodes.length, 2);
  assert.equal(sanitized.strategyMap.edges.length, 1);
  assert.equal(sanitized.strategyMap.edges[0].from, "lead");
  assert.equal(sanitized.strategyMap.edges[0].to, "contato");
  assert.equal(sanitized.objectionAssistant.objectionType, "Preço");
  assert.equal(sanitized.objectionAssistant.interestLevel, "médio");
  assert.equal(sanitized.objectionAssistant.objective, "negotiate");

  console.log("Testes de workspace passaram.");
} finally {
  await fs.rm(workspaceFile, { force: true });
}
