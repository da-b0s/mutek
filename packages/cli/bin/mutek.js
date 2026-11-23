#!/usr/bin/env node
// mutek: mutation testing for Kane CLI suites.
import { main } from '../src/cli.js';

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code ?? 0; },
  (err) => { console.error(`mutek: ${err.message}`); if (process.env.MUTEK_DEBUG) console.error(err.stack); process.exitCode = 2; }
);
