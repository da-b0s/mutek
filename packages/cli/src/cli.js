// Command-line entry. Subcommands are loaded lazily so `tripwire proxy` starts instantly.
import { parseArgs } from 'node:util';

const HELP = `tripwire: break the app on purpose to find out whether a green Kane suite means anything

Usage:
  tripwire proxy   --target <url> [--port 8080]          run the fault-injecting proxy in front of an app
  tripwire run     [--tests <glob>] [--max-mutants 40]   baseline, generate mutants, replay, score
  tripwire fix     [--agent claude|codex] [--max-attempts 3]   strengthen tests for every survivor
  tripwire sabotage [--agent claude|codex]                ask the agent for domain-specific mutants
  tripwire report                                         rebuild the HTML report and badge
  tripwire list                                           show the mutant catalogue for the last baseline
  tripwire check   [--threshold 80]                      exit 1 if the score is below the threshold (for hooks)
  tripwire coverage [--criteria ACCEPTANCE.md]            acceptance criteria: owed, proven, or proven but unguarded
  tripwire doctor  [--kill]                              check kane-cli, login, and leftover Kane browsers

Run "tripwire <command> --help" for the options of one command.`;

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
