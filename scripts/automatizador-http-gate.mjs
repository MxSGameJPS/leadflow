import http from 'node:http';
import { drainRequested, publishRuntime, readControl } from './automatizador-runtime.mjs';

// Loaded before Next.js creates its HTTP server. Every admitted API request is counted.
const root = process.cwd();
let active = 0, aborted = 0, admitted = false, fault = false;
const report = () => {
  if (!publishRuntime(root, 'http', { active, aborted, admitted, requestId: readControl(root).requestId || null })) fault = true;
};
const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function(name, ...args) {
  if (name === 'request') {
    const [req, res] = args;
    const control = readControl(root);
    const hour = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    const pathname = req.url.split('?')[0];
    const inspectionPage = control.action === 'maintenance' && ['GET', 'HEAD'].includes(req.method) && !pathname.startsWith('/api/');
    const closed = fault || (!inspectionPage && (drainRequested(root) || (control.managed && hour < 7 && !['GET', 'HEAD', 'OPTIONS'].includes(req.method))));
    if (closed) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'LeadFlow em pausa para encerramento ou fora da janela de operacao.' }));
      return true;
    }
    active++; admitted = true; report();
    let finished = false;
    res.once('finish', () => { if (finished) return; finished = true; active--; report(); });
    res.once('close', () => { if (!finished) { if(inspectionPage){finished=true;active--}else{aborted++} report(); } });
    // An aborted response is not proof that its handler stopped: keep active until intervention.
  } else if (name === 'upgrade' && drainRequested(root)) { args[1]?.destroy(); return true; }
  return originalEmit.call(this, name, ...args);
};
report();
const reportTimer = setInterval(report, 1000); reportTimer.unref();
export function dispose() { clearInterval(reportTimer); http.Server.prototype.emit = originalEmit; }
