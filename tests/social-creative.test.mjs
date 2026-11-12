import test from "node:test";
import assert from "node:assert/strict";
import {parseCreativePlan,normalizeCreativePlan} from "../src/services/social/creativeGenerator.js";
const example={caption:"Legenda",slides:[{headline:"Título",body:"Texto",cta:"Contato"}]};
test("aceita JSON direto",()=>assert.deepEqual(parseCreativePlan(JSON.stringify(example)),example));
test("aceita JSON em bloco markdown",()=>assert.deepEqual(parseCreativePlan("Aqui está:\n\`\`\`json\n"+JSON.stringify(example)+"\n\`\`\`"),example));
test("aceita explicação antes do JSON",()=>assert.deepEqual(parseCreativePlan("Roteiro:\n"+JSON.stringify(example)),example));
test("rejeita estrutura sem slides",()=>assert.throws(()=>parseCreativePlan('{"caption":"oi"}'),/JSON válido/));
test("normaliza formato de imagem para um slide",()=>assert.equal(normalizeCreativePlan(example,{format:"image",topic:"Tema"}).slides.length,1));
