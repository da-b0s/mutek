// The Tripwire proxy: a reverse proxy in front of the app under test.
// Disarmed it passes everything through (and, in record mode, notes traffic and what the page showed).
// Armed with one mutant it changes exactly one realistic thing about the app's behaviour.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { applyJsonOps, injectHtml, replaceHtml } from './actions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RECORDER_JS = fs.readFileSync(path.join(here, 'browser/recorder.js'), 'utf8');
const MUTATE_JS = fs.readFileSync(path.join(here, 'browser/mutate.js'), 'utf8');
// Fingerprint of the code a proxy serves; a runner refuses to reuse a proxy built from older code.
export const PROXY_CODE = crypto.createHash('sha1').update(RECORDER_JS + MUTATE_JS + fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')).digest('hex').slice(0, 12);

const HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer'];
const MAX_BODY_SAMPLE = 256 * 1024;
const STATIC_EXT = /\.(js|mjs|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|map)$/i;

export function matches(match, req) {
  if (!match) return false;
  if (match.document) return req.isDocument;
  if (match.method && match.method !== '*' && match.method.toUpperCase() !== req.method) return false;
  if (match.path) {
    if (match.path.startsWith('re:')) { if (!new RegExp(match.path.slice(3)).test(req.path)) return false; }
    else if (match.path !== req.path) return false;
  }
  return true;
}

export function createProxy({ target, port = 8080, log = () => {} }) {
  const upstream = new URL(target);
  const state = {
    armed: null,        // current mutant definition
    hits: 0,            // times the armed mutant actually changed something
    uses: 0,            // times it matched (for `times` limits)
    record: false,      // inject the DOM recorder + keep full bodies
    test: null,         // label of the test currently running (set by the runner)
    seq: 0,
    traffic: [],
    dom: [],
    lastGet: new Map(), // path -> last GET response (for stale-read)
    staleFor: new Map() // path -> response as it was before the most recent write
  };

  const resetRun = (test) => {
    state.test = test ?? null;
    state.traffic = [];
    state.dom = [];
    state.hits = 0;
    state.uses = 0;
    state.lastGet.clear();
    state.staleFor.clear();
  };

  function send(res, status, body, headers = {}) {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json', 'cache-control': 'no-store', ...headers });
    res.end(data);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  function forward(req, body) {
    return new Promise((resolve, reject) => {
      const headers = { ...req.headers, host: upstream.host };
      for (const h of HOP) delete headers[h];
      // Ask for plain bodies and no conditional requests: a 304 would skip the mutation.
      delete headers['accept-encoding'];
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
      if (body.length) headers['content-length'] = String(body.length);
      const out = http.request({ protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port || 80, method: req.method, path: req.url, headers }, (up) => {
        const chunks = [];
        up.on('data', (c) => chunks.push(c));
        up.on('end', () => resolve({ status: up.statusCode, headers: up.headers, body: Buffer.concat(chunks) }));
        up.on('error', reject);
      });
      out.on('error', reject);
      out.end(body);
    });
  }

  function cleanHeaders(h) {
    const out = { ...h };
    for (const k of [...HOP, 'content-length', 'content-encoding', 'etag', 'last-modified', 'content-security-policy', 'content-security-policy-report-only']) delete out[k];
    out['cache-control'] = 'no-store';
    return out;
  }

  const isJson = (h) => /json/i.test(h['content-type'] || '');
  const isHtml = (h) => /text\/html/i.test(h['content-type'] || '');
  const tryJson = (buf) => { try { return JSON.parse(buf.toString('utf8')); } catch { return undefined; } };

  function record(entry) {
    state.traffic.push({ seq: ++state.seq, test: state.test, ...entry });
  }

  function fire(note) {
    state.hits++;
    log(`fired ${state.armed?.id}${note ? ' (' + note + ')' : ''}`);
  }

  async function handleControl(req, res, url) {
    const body = req.method === 'POST' ? tryJson(await readBody(req)) ?? {} : {};
    switch (`${req.method} ${url.pathname}`) {
      case 'GET /_tw/health': return send(res, 200, { ok: true, target, code: PROXY_CODE, armed: state.armed?.id ?? null, record: state.record });
      case 'POST /_tw/arm':
        if (!body || !body.id || !body.action) return send(res, 400, { error: 'mutant needs id and action' });
        state.armed = body; state.hits = 0; state.uses = 0; state.staleFor.clear(); state.lastGet.clear();
        log(`armed ${body.id}`);
        return send(res, 200, { armed: body.id });
      case 'POST /_tw/disarm':
        log(`disarmed ${state.armed?.id ?? '(none)'}`);
        state.armed = null; state.hits = 0; state.uses = 0;
        return send(res, 200, { armed: null });
      case 'POST /_tw/reset':
        resetRun(body.test);
        if (typeof body.record === 'boolean') state.record = body.record;
        return send(res, 200, { test: state.test, record: state.record });
      case 'GET /_tw/traffic': return send(res, 200, { traffic: state.traffic });
      case 'GET /_tw/dom': return send(res, 200, { dom: state.dom });
      case 'GET /_tw/hit': return send(res, 200, { armed: state.armed?.id ?? null, hits: state.hits, fired: state.hits > 0 });
      case 'POST /_tw/dom':
        for (const ev of body.events || []) state.dom.push({ test: state.test, ...ev });
        return send(res, 204, '');
      case 'POST /_tw/fired':
        if (state.armed && body.id === state.armed.id) fire('in page');
        return send(res, 204, '');
      default: return send(res, 404, { error: 'unknown control endpoint' });
    }
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://proxy');
    if (url.pathname.startsWith('/_tw/')) return handleControl(req, res, url);

    const reqBody = await readBody(req);
    const accept = req.headers.accept || '';
    const info = { method: req.method, path: url.pathname, isDocument: req.method === 'GET' && /text\/html/.test(accept) };
    const m = state.armed;
    const action = m?.action;
    const limited = m && m.times && state.uses >= m.times;
    const armedHere = m && !limited && matches(m.match, info);
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const reqJson = isJson(req.headers) ? tryJson(reqBody) : undefined;

    // ---- request-phase mutants: the app never sees (or sees twice) the request ----
    if (armedHere && action.type === 'respond') {
      state.uses++; fire(`${action.status} instead of forwarding`);
      if (isWrite) snapshotStale(url.pathname);
      const body = action.body === undefined ? { error: action.status >= 500 ? 'Internal Server Error' : 'Unauthorized' } : action.body;
      record({ method: req.method, path: url.pathname, status: action.status, type: 'json', req: reqJson, json: body, mutated: true });
      return send(res, action.status, body);
    }
    if (armedHere && action.type === 'stale-read' && req.method === 'GET' && state.staleFor.has(url.pathname)) {
      state.uses++; fire('served the previous response');
      const prev = state.staleFor.get(url.pathname);
      record({ method: req.method, path: url.pathname, status: prev.status, type: 'json', json: tryJson(prev.body), mutated: true });
      res.writeHead(prev.status, cleanHeaders(prev.headers));
      return res.end(prev.body);
    }

    let up;
    try {
      if (isWrite) snapshotStale(url.pathname);
      up = await forward(req, reqBody);
      if (armedHere && action.type === 'forward-twice' && isWrite) {
        state.uses++; fire('request applied twice');
        up = await forward(req, reqBody);
      }
    } catch (err) {
      return send(res, 502, { error: `tripwire proxy could not reach ${target}: ${err.message}` });
    }

    let status = up.status;
    let body = up.body;
    const headers = cleanHeaders(up.headers);
    let mutated = false;

    // ---- response-phase mutants ----
    if (armedHere && action.type === 'status-map' && action.from.includes(status)) {
      state.uses++; fire(`${status} -> ${action.to}`);
      status = action.to; mutated = true;
    }
    if (armedHere && action.type === 'json' && isJson(up.headers)) {
      const parsed = tryJson(body);
      if (parsed !== undefined) {
        const r = applyJsonOps(parsed, action.ops);
        if (r.changed) { state.uses++; fire(); body = Buffer.from(JSON.stringify(r.body)); mutated = true; }
      }
    }
    if (isHtml(up.headers)) {
      let html = body.toString('utf8');
      if (state.record) html = injectHtml(html, `<script id="__tw-recorder">${RECORDER_JS}</script>`);
      if (armedHere && action.type === 'dom') {
        state.uses++;
        // fired is reported by the page once the element was really changed
        html = injectHtml(html, `<script id="__tw-mutant">window.__TW_MUTANT=${JSON.stringify({ id: m.id, ...action.dom }).replace(/</g, '\\u003c')};${MUTATE_JS}</script>`);
        mutated = true;
      }
      if (armedHere && action.type === 'inject-css') {
        state.uses++; fire('css injected');
        html = injectHtml(html, `<style id="__tw-mutant">${action.css}</style>`);
        mutated = true;
      }
      if (armedHere && action.type === 'html-replace') {
        const r = replaceHtml(html, action.find, action.replace);
        if (r.changed) { state.uses++; fire(); html = r.html; mutated = true; }
      }
      body = Buffer.from(html);
    }

    if (req.method === 'GET' && !mutated && status < 400) state.lastGet.set(url.pathname, { status, headers: up.headers, body: up.body });

    if (!STATIC_EXT.test(url.pathname)) {
      const entry = { method: req.method, path: url.pathname, query: url.search || undefined, status, type: isJson(up.headers) ? 'json' : isHtml(up.headers) ? 'html' : 'other', mutated };
      if (reqJson !== undefined) entry.req = reqJson;
      if (entry.type === 'json' && body.length <= MAX_BODY_SAMPLE) entry.json = tryJson(body);
      if (entry.type === 'html') entry.document = info.isDocument;
      record(entry);
    }

    res.writeHead(status, headers);
    res.end(body);
  }

  function snapshotStale(writePath) {
    // Everything read so far is now potentially out of date; remember it as the "stale" version.
    for (const [p, v] of state.lastGet) if (p !== writePath) state.staleFor.set(p, v);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      log(`error: ${err.stack || err}`);
      if (!res.headersSent) send(res, 500, { error: 'tripwire proxy error', detail: String(err.message || err) });
      else res.end();
    });
  });

  // Websockets and other upgrades are passed through untouched.
  server.on('upgrade', (req, socket, head) => {
    const conn = net.connect(upstream.port || 80, upstream.hostname, () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const k = req.rawHeaders[i];
        lines.push(`${k}: ${k.toLowerCase() === 'host' ? upstream.host : req.rawHeaders[i + 1]}`);
      }
      conn.write(lines.join('\r\n') + '\r\n\r\n');
      if (head && head.length) conn.write(head);
      socket.pipe(conn).pipe(socket);
    });
    conn.on('error', () => socket.destroy());
    socket.on('error', () => conn.destroy());
  });

  return {
    state,
    server,
    listen: () => new Promise((resolve) => server.listen(port, () => resolve(server.address().port))),
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); })
  };
}

// Small client used by the runner and tests.
export function proxyClient(base) {
  const call = async (method, p, body) => {
    const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 204) return null;
    const data = await r.json();
    if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${data.error || ''}`);
    return data;
  };
  return {
    health: () => call('GET', '/_tw/health'),
    arm: (mutant) => call('POST', '/_tw/arm', mutant),
    disarm: () => call('POST', '/_tw/disarm'),
    reset: (test, record) => call('POST', '/_tw/reset', { test, record }),
    traffic: async () => (await call('GET', '/_tw/traffic')).traffic,
    dom: async () => (await call('GET', '/_tw/dom')).dom,
    hit: () => call('GET', '/_tw/hit')
  };
}
