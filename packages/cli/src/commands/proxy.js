import { createProxy } from '../proxy.js';

export default async function proxy(argv, parseArgs) {
  const { values } = parseArgs({
    args: argv,
    options: {
      target: { type: 'string', default: process.env.TRIPWIRE_TARGET || 'http://localhost:3000' },
      port: { type: 'string', default: process.env.TRIPWIRE_PORT || '8080' },
      record: { type: 'boolean', default: false },
      quiet: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' }
    }
  });
  if (values.help) {
    console.log('tripwire proxy --target <app url> [--port 8080] [--record] [--quiet]\n\nControl API: POST /_tw/arm, POST /_tw/disarm, POST /_tw/reset, GET /_tw/traffic, GET /_tw/dom, GET /_tw/hit');
    return 0;
  }
  const p = createProxy({ target: values.target, port: Number(values.port), log: values.quiet ? () => {} : (m) => console.log(`[tripwire] ${m}`) });
  p.state.record = values.record;
  const port = await p.listen();
  console.log(`tripwire proxy on http://localhost:${port} -> ${values.target}${values.record ? ' (recording)' : ''}`);
  await new Promise((resolve) => {
    process.on('SIGINT', resolve);
    process.on('SIGTERM', resolve);
  });
  await p.close();
  return 0;
}
