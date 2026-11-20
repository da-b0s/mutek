// Thin wrapper around the kane-cli binary: run one test.md, collect NDJSON, find its evidence pack.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isWin = process.platform === 'win32';
const quote = (a) => (/^[\w./:=@-]+$/.test(a) ? a : `"${String(a).replace(/"/g, '\\"')}"`);

export function kaneBin() {
  return process.env.TRIPWIRE_KANE || 'kane-cli';
}

// Run kane-cli with stdin closed (non-TTY => NDJSON, no prompts). Our own kill timer guards against
// runs that ignore --timeout (kane-cli issue #207).
export function runKane(args, { cwd = process.cwd(), killAfterMs = 240000, logFile } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const bin = kaneBin();
    // TRIPWIRE_KANE may be a whole command ("node fake-kane.mjs"); then it is used as written.
    const useShell = isWin || /\s/.test(bin);
    const cmd = [/\s/.test(bin) ? bin : quote(bin), ...args.map(quote)].join(' ');
    const child = useShell
      ? spawn(cmd, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
      : spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const events = [];
    let out = '';
    let err = '';
    let buf = '';
    const log = logFile ? fs.createWriteStream(logFile) : null;
    child.stdout.on('data', (c) => {
      const s = c.toString();
      out += s;
      log?.write(s);
      buf += s;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line.startsWith('{')) { try { events.push(JSON.parse(line)); } catch { /* not json */ } }
      }
    });
    child.stderr.on('data', (c) => { err += c.toString(); log?.write(c); });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (isWin) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGKILL');
    }, killAfterMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      log?.end();
      resolve({ code: timedOut ? 3 : code ?? 2, timedOut, events, stdout: out, stderr: err, durationMs: Date.now() - started });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: 2, events, stdout: out, stderr: String(e), durationMs: Date.now() - started, spawnError: true });
    });
  });
}

// Pull the useful bits out of a testmd run's NDJSON stream.
export function summarizeEvents(events) {
  const done = [...events].reverse().find((e) => e.type === 'test_md_done' || e.event === 'test_md_done');
  const runEnds = events.filter((e) => e.type === 'run_end' || e.event === 'run_end');
  const text = JSON.stringify(events);
  const heal = events.filter((e) => /heal/i.test(e.type || e.event || '') || e.healed === true || e.heal);
  const credits = runEnds.reduce((s, e) => s + (Number(e.credits ?? e.credits_used ?? e.usage?.credits) || 0), 0);
  const failedEnds = runEnds.filter((e) => e.status === 'failed' || e.status === 'error');
  const failure = failedEnds.map((e) => e.failure_reason || e.reason || e.error).filter(Boolean)[0];
  // Kane triages every failed replay; keep its verdict (product bug vs automation bug)
  const bug = events.filter((e) => e.type === 'test_md_bug_verdict').map((e) => ({ confirmed: e.confirmed, family: e.family, category: e.category, title: e.bug_title, oneLiner: e.one_liner, confidence: e.confidence }))[0];
  const failedStep = events.filter((e) => e.type === 'test_md_step_end' && e.status === 'failed').map((e) => e.step_index)[0];
  return {
    bugVerdict: bug,
    failedStep,
    status: done?.overall_status ?? done?.status,
    sessionId: done?.session_id ?? runEnds.find((e) => e.session_id)?.session_id,
    shareUrl: done?.share_url,
    credits,
    healEvents: heal.length,
    mentionsHeal: /"(healed|heal_applied|reauthor|re-author)/i.test(text),
    failureReason: failure
  };
}

export function newestPack(cwd, sinceMs) {
  const dir = path.join(cwd, '.testmuai', 'evidence');
  if (!fs.existsSync(dir)) return null;
  const packs = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.evidence'))
    .map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .filter((p) => p.t >= sinceMs - 2000)
    .sort((a, b) => b.t - a.t);
  return packs[0]?.f ?? null;
}

// Kane failures that happen before any step runs (no browser, no credits spent) and are worth
// waiting out: Test Manager not answering during auth resolution, network resets, rate limits.
export const TRANSIENT = /TMS did not return an org_id|Token refresh failed|auth resolution failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|network error|\b429\b|\b50[234]\b/i;
export const isTransient = (r) => r.code === 2 && !r.events.some((e) => e.type === 'test_md_step_start') && TRANSIENT.test(r.stderr + r.stdout);

const pause = (ms) => new Promise((res) => setTimeout(res, ms));

// kane-cli's --timeout is per step, so the safety timer around a whole test allows every step its
// timeout, plus time for Kane to triage a failure and seal the evidence pack (issue #207 guard).
export function killAfterFor(file, timeout, cwd = process.cwd()) {
  let steps = 1;
  try { steps = Math.max(1, (fs.readFileSync(path.resolve(cwd, file), 'utf8').match(/^## /gm) || []).length); } catch { /* unreadable: one step */ }
  return (timeout * steps + 180) * 1000;
}

// One test against whatever the proxy currently serves. Transient pre-run failures are retried
// with backoff (15 s, 45 s, 90 s) since they cost nothing and usually clear on their own.
export async function runTest(file, { heal = false, timeout = 180, cwd, logFile, extra = [], backoff = [15000, 45000, 90000], onRetry } = {}) {
  const args = ['testmd', 'run', file, '--agent', '--headless', '--timeout', String(timeout)];
  if (!heal) args.push('--no-adaptive-heal');
  args.push(...extra);
  let r;
  let started;
  for (let i = 0; ; i++) {
    started = Date.now();
    r = await runKane(args, { cwd, killAfterMs: killAfterFor(file, timeout, cwd), logFile });
    if (!isTransient(r) || i >= backoff.length) break;
    onRetry?.(i + 1, (r.stderr || r.stdout).trim().split('\n').pop());
    await pause(backoff[i]);
  }
  return { ...r, ...summarizeEvents(r.events), pack: newestPack(cwd || process.cwd(), started), transient: isTransient(r) };
}

// Judge a sealed pack against a policy file; returns { verdict: pass|fail|errored|unknown, file, raw }.
export async function verdict(pack, policyFile, { cwd } = {}) {
  if (!pack) return { verdict: 'unknown', reason: 'no evidence pack found' };
  const r = await runKane(['evidence', 'verdict', pack, '--policy', policyFile], { cwd, killAfterMs: 60000 });
  const v = r.code === 0 ? 'pass' : r.code === 1 ? 'fail' : r.code === 3 ? 'errored' : 'unknown';
  const m = (r.stdout + r.stderr).match(/[^\s]+\.verdict\.json/);
  let raw = null;
  if (m && fs.existsSync(m[0])) { try { raw = JSON.parse(fs.readFileSync(m[0], 'utf8')); } catch { /* ignore */ } }
  return { verdict: v, file: m?.[0], raw, output: (r.stdout + r.stderr).trim().split('\n').slice(-3).join('\n') };
}

// Read a numeric metric out of a verdict file, whatever its exact shape.
export function metricFromVerdict(raw, metric) {
  if (!raw) return undefined;
  let found;
  const visit = (o) => {
    if (found !== undefined || !o || typeof o !== 'object') return;
    if (o.metric === metric && (typeof o.value === 'number' || typeof o.actual === 'number')) { found = o.value ?? o.actual; return; }
    for (const v of Object.values(o)) visit(v);
  };
  visit(raw);
  return found;
}

export async function balance(cwd) {
  const r = await runKane(['balance', '--json'], { cwd, killAfterMs: 30000 });
  const m = (r.stdout || '').match(/"?(?:balance|credits|available)"?\s*[:=]\s*([\d.]+)/i) || (r.stdout || '').match(/([\d,]+(?:\.\d+)?)\s*credits/i);
  return m ? Number(m[1].replace(/,/g, '')) : undefined;
}
