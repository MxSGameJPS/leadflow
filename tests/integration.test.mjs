import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'leadflow-integration-'));
process.env.LEADFLOW_DATA_DIR = temp;
const {upsertProvider, generateWithDefaultProvider, generateResilientWithDefaultProvider} = await import('../src/services/ai/providerService.js');
const {generateSiteWithDefaultProvider} = await import('../src/services/ai/siteProviderService.js');
const {generateUniqueSiteCode} = await import('../src/services/projects/siteCodegenV4.js');
const originalFetch = global.fetch;
const requests=[];
let response={choices:[{message:{content:[{type:'text',text:'OK'}]}}]};
global.fetch=async (url,options)=>{
  requests.push({url:String(url),body:JSON.parse(options.body),headers:options.headers});
  return Response.json(typeof response==='function'?response(requests.at(-1)):response);
};
try {
  await upsertProvider({name:'Test',baseUrl:'http://localhost:20128/v1',endpoint:'/v1/chat/completions',model:'primary',enabled:true,isDefault:true,authType:'none'});
  assert.equal((await generateSiteWithDefaultProvider({prompt:'Test'})).text,'OK');
  assert.equal(requests.at(-1).url,'http://localhost:20128/v1/chat/completions');
  assert.equal(requests.at(-1).body.tool_choice,'none');
  assert.deepEqual(requests.at(-1).body.tools,[]);
  assert.equal(requests.at(-1).headers['x-omniroute-no-memory'],'true');
  response={choices:[{message:{content:'',tool_calls:[{function:{name:'MemorySearch'}}]}}]};
  await assert.rejects(generateWithDefaultProvider({prompt:'Test'}),{code:'AI_TOOL_CALLS'});
  response={choices:[{message:{content:null}}]};
  await assert.rejects(generateWithDefaultProvider({prompt:'Test'}),{code:'AI_EMPTY_RESPONSE'});
  response=({body})=>body.model==='primary'?{choices:[{message:{content:null}}]}:{choices:[{message:{content:'fallback'}}]};
  const fallback=await generateResilientWithDefaultProvider({prompt:'Test',disableTools:true,fallbackModels:['primary','backup']});
  assert.equal(fallback.text,'fallback');
  assert.equal(fallback.fallbackUsed,true);
  response={choices:[{message:{content:null,tool_calls:[{function:{name:'MemorySearch'}}]}}]};
  const events=[];
  await generateUniqueSiteCode({folderPath:path.join(temp,'generated'),folderName:'test',siteData:{brandName:'Teste',segment:'Delivery'},validateBuild:false,visualQa:false,onProgress:e=>events.push(e)});
  assert.ok(events.some(e=>e.title==='Revisão por IA indisponível'));
  await fs.access(path.join(temp,'generated','app','page.jsx'));
  response=({body})=>JSON.stringify(body.messages).includes('revisor final')
    ? {choices:[{message:{content:'{"pass":true,"issues":[]}'}}]}
    : {choices:[{message:{content:null,tool_calls:[{function:{name:'MemorySearch'}}]}}]};
  const validEvents=[];
  await generateUniqueSiteCode({folderPath:path.join(temp,'valid-review'),folderName:'test',siteData:{brandName:'Teste',segment:'Delivery'},validateBuild:false,visualQa:false,onProgress:e=>validEvents.push(e)});
  assert.ok(!validEvents.some(e=>e.title==='Revisão por IA indisponível'));
  assert.ok(requests.every(r=>r.body.tool_choice==='none'||!r.body.tools));
  console.log('Integration regression tests passed: URL, text blocks, tool rejection, empty response, fallback, Reviewer recovery.');
} finally {
  global.fetch=originalFetch;
  await fs.rm(temp,{recursive:true,force:true});
}
