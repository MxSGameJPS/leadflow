import assert from "node:assert/strict";
import { buildFreelanceQueries, buildIntentQueries, cleanIntentQuery } from "../src/services/intent/intentQueries.js";
import { normalizeRawSignal, extractSignalsFromCommandOutput } from "../src/services/intent/intentNormalizer.js";
import { calculateIntentScore, fallbackIntentClassification, gradeFromIntentScore, intentBand } from "../src/services/intent/intentScoring.js";
import { normalizeIntentSearchInput } from "../src/services/intent/intentService.js";

assert.equal(cleanIntentQuery("preciso & site | agora"), "preciso site agora");
assert.deepEqual(buildIntentQueries({ service: "app", maxQueries: 2 }), ["preciso criar um aplicativo", "procuro desenvolvedor de aplicativo"]);
assert.equal(buildFreelanceQueries("site").length, 3);

const signal = normalizeRawSignal({ title: "Procuro desenvolvedor", description: "Preciso de um sistema para minha pizzaria", url: "https://example.com/post/1" }, { source: "web", query: "sistema" });
assert.equal(signal.source, "web");
assert.equal(signal.sourceUrl, "https://example.com/post/1");
assert.equal(signal.fingerprint.length, 64);

const parsed = extractSignalsFromCommandOutput(JSON.stringify({ results: [{ title: "A", url: "https://example.com/a", text: "Preciso de um site para minha empresa" }] }), { source: "web", query: "site" });
assert.equal(parsed.length, 1);

const high = fallbackIntentClassification({ content: "Procuro desenvolvedor, preciso criar um aplicativo para minha empresa com urgência" });
assert.equal(high.isOpportunity, true);
assert.equal(high.matchedService, "app");
assert.equal(high.intentLevel, "high");
const score = calculateIntentScore({ publishedAt: new Date().toISOString() }, high);
assert.ok(score >= 80);
assert.equal(intentBand(score), score >= 85 ? "hot" : "high");
assert.equal(gradeFromIntentScore(90), "A");

const research = fallbackIntentClassification({ content: "Tutorial: como criar um site em HTML e aprender programação" });
assert.equal(research.isOpportunity, false);

const input = normalizeIntentSearchInput({ service: "invalid", sources: ["web", "invalid", "web"], minimumScore: 500, maxQueries: 99 });
assert.equal(input.service, "all");
assert.deepEqual(input.sources, ["web"]);
assert.equal(input.minimumScore, 100);
assert.equal(input.maxQueries, 8);

console.log("Intent Engine passed: queries, normalization, heuristics, score and input validation.");
