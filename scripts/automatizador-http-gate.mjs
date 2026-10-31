import http from 'node:http';
import { publishRuntime, readControl } from './automatizador-runtime.mjs';

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
    const pathname = req.url.split('?')[0];
    const inspectionPage = control.action === 'maintenance' && ['GET', 'HEAD'].includes(req.method) && !pathname.startsWith('/api/');
    // The commercial agents enforce their own working hours. Never block operator edits or scheduling based on the clock.
    // Explicit shutdown/maintenance drains still prevent new work for safe process termination.
    const automatedSession = Boolean(process.env.AUTOMATIZADOR_SESSION?.trim());
    const draining = automatedSession && (control.action === 'drain' || control.action === 'maintenance');
    // Without an automatizador session, this is the operator's local server: do not inherit stale shutdown flags.
    const closed = fault || (!inspectionPage && draining);
    if (closed) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'LeadFlow em encerramento controlado pelo automatizador.' }));
      return true;
    }
    active++; admitted = true; report();
    let finished = false;
    res.once('finish', () => { if (finished) return; finished = true; active--; report(); });
    res.once('close', () => { if (!finished) { if(inspectionPage){finished=true;active--}else{aborted++} report(); } });
    // An aborted response is not proof that its handler stopped: keep active until intervention.
  } else if (name === 'upgrade' && process.env.AUTOMATIZADOR_SESSION?.trim() && ['drain', 'maintenance'].includes(readControl(root).action)) { args[1]?.destroy(); return true; }
  return originalEmit.call(this, name, ...args);
};
report();
const reportTimer = setInterval(report, 1000); reportTimer.unref();
export function dispose() { clearInterval(reportTimer); http.Server.prototype.emit = originalEmit; }
