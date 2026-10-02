import assert from 'node:assert/strict';
import http from 'node:http';
import {requestLongLocalProvider} from '../src/services/ai/providerHttp.js';
const server=http.createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>setTimeout(()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({method:req.method,body:JSON.parse(body||'{}')}))},80))});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
 const target=new URL('http://127.0.0.1:'+server.address().port+'/chat/completions');
 const result=await requestLongLocalProvider(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool_choice:'none',tools:[]}),signal:AbortSignal.timeout(1000)});
 assert.equal(result.status,200);assert.equal(result.ok,true);assert.deepEqual(JSON.parse(await result.text()),{method:'POST',body:{tool_choice:'none',tools:[]}});
 await assert.rejects(requestLongLocalProvider(target,{method:'POST',headers:{},body:'{}',signal:AbortSignal.timeout(10)}),error=>error.name==='AbortError');
 console.log('Provider HTTP tests passed: request body, delayed response and enforced abort.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
