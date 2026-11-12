import test from "node:test";
import assert from "node:assert/strict";
import {parseSocialJson} from "../src/services/social/parseAiJson.js";
const post={title:"Exemplo",caption:"Legenda",script:"Roteiro"};
const plan=[{...post,format:"image",platforms:["instagram"],dayOffset:0,hour:12}];
test("post avulso aceita JSON puro",()=>assert.deepEqual(parseSocialJson(JSON.stringify(post)),post));
test("post avulso aceita bloco Markdown",()=>assert.deepEqual(parseSocialJson("Resultado:\n"+ "```json\n"+JSON.stringify(post)+"\n```"),post));
test("calendário aceita array com texto introdutório",()=>assert.deepEqual(parseSocialJson("Calendário:\n"+JSON.stringify(plan),{array:true}),plan));
test("resposta inválida produz erro claro",()=>assert.throws(()=>parseSocialJson("sem json"),/JSON válido/));
