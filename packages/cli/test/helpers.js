import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

export async function startShop() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(root, 'demo/shop/server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(url + '/api/me'); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  return { url, port, stop: () => child.kill() };
}
