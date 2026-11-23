// mutek doctor: environment checks that have bitten real runs.
import { findOrphanKaneBrowsers, killKaneBrowser } from '../orphans.js';
import { runKane } from '../kane.js';

export default async function doctor(argv, parseArgs) {
  const { values } = parseArgs({ args: argv, options: { kill: { type: 'boolean' }, 'min-age': { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { console.log('mutek doctor [--kill] [--min-age 120]\n\nChecks kane-cli and lists Kane Chrome browsers left over from earlier runs (older than --min-age minutes). --kill stops them.'); return 0; }
  let problems = 0;
  const v = await runKane(['--version'], { killAfterMs: 30000 });
  if (v.code !== 0) { console.log('✗ kane-cli not found: npm install -g @testmuai/kane-cli'); problems++; }
  else console.log(`✓ kane-cli ${v.stdout.trim().split('\n').pop()}`);
  if (/runtime not found|runtime package missing/i.test(v.stderr + v.stdout)) {
    console.log('✗ kane-cli is missing its platform packages (a download probably failed). Reinstall: npm install -g @testmuai/kane-cli');
    problems++;
  }
  const w = await runKane(['whoami'], { killAfterMs: 30000 });
  if (!/Authenticated|valid/i.test(w.stdout)) { console.log('✗ not logged in: kane-cli login'); problems++; } else console.log('✓ logged in to Kane');
  const orphans = findOrphanKaneBrowsers(Number(values['min-age'] || 120));
  if (!orphans.length) console.log('✓ no leftover Kane browsers');
  else {
    problems++;
    console.log(`✗ ${orphans.length} Kane browser(s) left over from earlier runs (they can change a shared app's state):`);
    for (const o of orphans) console.log(`    pid ${o.pid}, ${Math.round(o.ageMinutes / 60)} h old, profile ${o.profile}`);
    if (values.kill) { for (const o of orphans) killKaneBrowser(o.profile); console.log('  stopped.'); problems--; }
    else console.log('  stop them with: mutek doctor --kill');
  }
  return problems ? 1 : 0;
}
