import http from "node:http";
import https from "node:https";

// Native transport for long non-streaming local gateway calls. The caller's
// AbortSignal is the sole deadline, avoiding fetch's five-minute header cap.
export function requestLongLocalProvider(url,{method,headers,body,signal}) {
  return new Promise((resolve,reject)=>{
    const transport=url.protocol==='https:'?https:http;
    const request=transport.request(url,{method,headers,signal},response=>{
      const chunks=[];let size=0;
      response.on('data',chunk=>{size+=chunk.length;if(size>32*1024*1024){request.destroy(new Error('Resposta do provedor excedeu o limite de tamanho.'));return;}chunks.push(chunk)});
      response.on('error',reject);
      response.on('end',()=>resolve({ok:response.statusCode>=200&&response.statusCode<300,status:response.statusCode,text:async()=>Buffer.concat(chunks).toString('utf8')}));
    });
    request.on('error',reject);
    if(body!==undefined)request.write(body);
    request.end();
  });
}
