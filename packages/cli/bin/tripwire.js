#!/usr/bin/env node
// tripwire: mutation testing for Kane CLI suites.
import { main } from '../src/cli.js';

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code ?? 0; },
  (err) => { console.error(`tripwire: ${err.message}`); if (process.env.TRIPWIRE_DEBUG) console.error(err.stack); process.exitCode = 2; }
);
