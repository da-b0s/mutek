// Calls the coding agent headlessly. The prompt goes in on stdin, so no shell quoting is involved.
import { spawn } from 'node:child_process';

const AGENTS = {
  claude: { cmd: 'claude', args: ['-p', '--permission-mode', 'acceptEdits', '--output-format', 'text'] },
  codex: { cmd: 'codex', args: ['exec', '--full-auto', '-'] }
};

export function agentCommand(name) {
  if (process.env.TRIPWIRE_AGENT_CMD) return { cmd: process.env.TRIPWIRE_AGENT_CMD, args: [], raw: true };
  const a = AGENTS[name];
  if (!a) throw new Error(`unknown agent "${name}" (use claude or codex, or set TRIPWIRE_AGENT_CMD)`);
  return a;
}

export function runAgent(name, prompt, { cwd = process.cwd(), timeoutMs = 600000 } = {}) {
  const { cmd, args, raw } = agentCommand(name);
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' || raw;
    const child = spawn(shell ? [cmd, ...args].join(' ') : cmd, shell ? [] : args, { cwd, shell, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, TRIPWIRE_AGENT: '1' } });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout: out, stderr: err }); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: 127, stdout: out, stderr: String(e) }); });
    child.stdin.end(prompt);
  });
}
