// Kane launches a private headless Chrome (profile folder "kane-clean-*") per run. When a run is
// killed from outside (a closed terminal, a sleeping laptop) that Chrome can outlive it, keep pages
// open, and change a shared app's state under the next run. Found in practice: three such browsers,
// up to two days old, broke a green baseline.
import { execFileSync } from 'node:child_process';

const isWin = process.platform === 'win32';

// [{ pid, ageMinutes, profile }] for Kane Chrome root processes older than minAgeMinutes.
export function findOrphanKaneBrowsers(minAgeMinutes = 120) {
  try {
    if (isWin) {
      const ps = "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'kane-clean-' -and $_.CommandLine -match 'remote-debugging-port' } | ForEach-Object { '{0}|{1}|{2}' -f $_.ProcessId, [int]((Get-Date) - $_.CreationDate).TotalMinutes, $_.CommandLine }";
      const out = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });
      return parse(out.split(/\r?\n/).filter(Boolean).map((l) => { const [pid, age, ...cmd] = l.split('|'); return { pid: Number(pid), ageMinutes: Number(age), cmd: cmd.join('|') }; }), minAgeMinutes);
    }
    const out = execFileSync('ps', ['-eo', 'pid=,etimes=,args='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });
    const rows = out.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
      .filter((m) => /kane-clean-/.test(m[3]) && /remote-debugging-port/.test(m[3]))
      .map((m) => ({ pid: Number(m[1]), ageMinutes: Math.round(Number(m[2]) / 60), cmd: m[3] }));
    return parse(rows, minAgeMinutes);
  } catch {
    return [];
  }
}

function parse(rows, minAgeMinutes) {
  return rows.filter((r) => r.ageMinutes >= minAgeMinutes).map((r) => ({ pid: r.pid, ageMinutes: r.ageMinutes, profile: (r.cmd.match(/kane-clean-[\w-]+/) || [''])[0] }));
}

// Stop a Kane Chrome and every process sharing its private profile.
export function killKaneBrowser(profile) {
  if (!/^kane-clean-[\w-]+$/.test(profile)) throw new Error(`refusing to stop a non-Kane profile: ${profile}`);
  if (isWin) {
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${profile}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 20000 });
  } else {
    execFileSync('pkill', ['-f', profile], { stdio: 'ignore' });
  }
}
