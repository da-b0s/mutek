import path from 'node:path';
import { loadConfig } from '../config.js';
import { writeReport } from '../report.js';

export default async function report(argv, parseArgs) {
  const { values } = parseArgs({ args: argv, options: { dir: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { console.log('mutek report [--dir .mutek]   rebuild .mutek/report/index.html and badge.svg from the ledger'); return 0; }
  const dir = path.resolve(values.dir || loadConfig().dir);
  console.log(writeReport(dir));
  return 0;
}
