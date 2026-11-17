// Turns what the proxy recorded during one baseline test run into that test's profile entry.
export function profileEntry(test, traffic, dom) {
  const pagesByUrl = new Map();
  const clicks = [];
  for (const ev of dom) {
    if (ev.kind === 'page') {
      // keep the richest snapshot per URL (the page after it finished rendering), but merge controls
      const prev = pagesByUrl.get(ev.url);
      if (!prev) pagesByUrl.set(ev.url, { url: ev.url, controls: ev.controls || [], text: ev.text || '' });
      else {
        const seen = new Set(prev.controls.map((c) => `${c.role}|${c.text}|${c.count}`));
        for (const c of ev.controls || []) if (!seen.has(`${c.role}|${c.text}|${c.count}`)) prev.controls.push(c);
        if ((ev.text || '').length) prev.text = prev.text.includes(ev.text) ? prev.text : `${prev.text}\n${ev.text}`.slice(-60000);
      }
    } else if (ev.kind === 'click' && ev.control) clicks.push(ev.control);
  }
  return {
    test,
    traffic: traffic.filter((e) => !e.path.startsWith('/_tw/')),
    pages: [...pagesByUrl.values()],
    clicks
  };
}

// Which baseline tests touched which routes and controls (written to .tripwire/traffic.json).
export function summarize(profile) {
  return profile.tests.map((t) => ({
    test: t.test,
    requests: t.traffic.length,
    routes: [...new Set(t.traffic.map((e) => `${e.method} ${e.path}`))],
    pages: t.pages.map((p) => p.url),
    clicks: t.clicks.map((c) => `${c.role}:${c.text}`)
  }));
}
