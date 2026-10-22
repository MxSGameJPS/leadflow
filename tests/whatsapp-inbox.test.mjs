import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone, normalizeChatList, matchChatToLead } from "../src/services/whatsapp/chatMatching.js";

test("normalizes Brazilian phones but refuses LID and group IDs", () => {
  assert.equal(normalizePhone("(51) 99999-8888"), "5551999998888");
  assert.equal(normalizePhone("5551999998888@c.us"), "5551999998888");
  assert.equal(normalizePhone("123456@lid"), "");
  assert.equal(normalizePhone("123@g.us"), "");
});
test("matches a unique lead only", () => {
  const chat={id:"5551999998888@c.us"};
  assert.equal(matchChatToLead(chat,[{id:"a",whatsapp:"51999998888"}])?.id,"a");
  assert.equal(matchChatToLead(chat,[{id:"a",phone:"51999998888"},{id:"b",phone:"51999998888"}]),null);
});
test("filters group conversations", () => {
  assert.equal(normalizeChatList({data:{chats:[{id:"123@g.us"},{id:"5551999998888@c.us",name:"Cliente"}]}}).length,1);
});
