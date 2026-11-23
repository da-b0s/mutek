// Command-line entry. Subcommands are loaded lazily so `mutek proxy` starts instantly.
import { parseArgs } from 'node:util';

const HELP = `mutek: break the app on purpose to find out whether a green Kane suite means anything

Usage:
  mutek proxy   --target <url> [--port 8080]          run the fault-injecting proxy in front of an app
  mutek run     [--tests <glob>] [--max-mutants 40]   baseline, generate mutants, replay, score
  mutek fix     [--agent claude|codex] [--max-attempts 3]   strengthen tests for every survivor
  mutek sabotage [--agent claude|codex]                ask the agent for domain-specific mutants
  mutek report                                         rebuild the HTML report and badge
  mutek list                                           show the mutant catalogue for the last baseline
  mutek check   [--threshold 80]                      exit 1 if the score is below the threshold (for hooks)
  mutek coverage [--criteria ACCEPTANCE.md]            acceptance criteria: owed, proven, or proven but unguarded
  mutek doctor  [--kill]                              check kane-cli, login, and leftover Kane browsers

Run "mutek <command> --help" for the options of one command.`;

export async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') { console.log(HELP); return 0; }
  if (cmd === '--version' || cmd === '-v') {
    const { readFileSync } = await import('node:fs');
    console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
    return 0;
  }
  switch (cmd) {
    case 'proxy': return (await import('./commands/proxy.js')).default(rest, parseArgs);
    case 'run': return (await import('./commands/run.js')).default(rest, parseArgs);
    case 'fix': return (await import('./commands/fix.js')).default(rest, parseArgs);
    case 'sabotage': return (await import('./commands/sabotage.js')).default(rest, parseArgs);
    case 'report': return (await import('./commands/report.js')).default(rest, parseArgs);
    case 'list': return (await import('./commands/list.js')).default(rest, parseArgs);
    case 'check': return (await import('./commands/check.js')).default(rest, parseArgs);
    case 'coverage': return (await import('./commands/coverage.js')).default(rest, parseArgs);
    case 'doctor': return (await import('./commands/doctor.js')).default(rest, parseArgs);
    default:
      console.error(`Unknown command "${cmd}".\n\n${HELP}`);
      return 2;
  }
}
