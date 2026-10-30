import fs from 'node:fs';
import path from 'node:path';

export const protocol = 1;
export function readControl(root = process.cwd()) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, 'data', 'automatizador-control.json'), 'utf8'));
    if (!['run', 'drain', 'maintenance'].includes(value.action)) throw Error('Invalid control');
    return value;
  } catch (error) { return error.code === 'ENOENT' ? { managed: false, action: 'run' } : { managed: true, action: 'drain' }; }
}
export function drainRequested(root = process.cwd(), now = new Date()) {
  const control = readControl(root);
  if (['drain', 'maintenance'].includes(control.action)) return true;
  if (!control.managed) return false;
  const hour = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour < 6 || hour >= 19;
}
export function publishRuntime(root, role, value) {
  try {
  const directory = path.join(root, 'data', 'automatizador-runtime');
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, `${role}-${process.pid}.json`);
  const temp = filename + '.tmp';
  fs.writeFileSync(temp, JSON.stringify({ protocol, pid: process.pid, role, session: process.env.AUTOMATIZADOR_SESSION || null, updatedAt: new Date().toISOString(), ...value }), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, filename);
  return true;
  } catch { return false; } // A stale receipt blocks termination without killing active work.
}
export function runtimeRows(root, session) {
  try { return fs.readdirSync(path.join(root, 'data', 'automatizador-runtime')).filter(name => /^(http|worker)-\d+\.json$/.test(name)).map(name => {
    try { return JSON.parse(fs.readFileSync(path.join(root, 'data', 'automatizador-runtime', name), 'utf8')); } catch { return null; }
  }).filter(row => row && row.session === session); } catch { return []; }
}
export function captureGenerationBaseline(root) {
  const directory = path.join(root, 'data', 'generation-progress');
  const baseline = {};
  try {
    for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
      try { if (JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')).status === 'running') baseline[name] = fs.statSync(path.join(directory, name)).mtimeMs; } catch { /* Unreadable records are never exempted. */ }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return baseline;
}
export function hasBackgroundGeneration(root, baseline = {}) {
  const directory = path.join(root, 'data', 'generation-progress');
  try {
    return fs.readdirSync(directory).filter(name => name.endsWith('.json')).some(name => {
      try {
        if (JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')).status !== 'running') return false;
        return baseline[name] !== fs.statSync(path.join(directory, name)).mtimeMs;
      } catch { return true; }
    });
  } catch (error) { return error.code !== 'ENOENT'; }
}
