import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const H = await loadTypeScript(new URL('../src/overview/overviewHelp.ts', import.meta.url));
const source = readFileSync(new URL('../src/overview/LabOverview.tsx', import.meta.url), 'utf8');
const keys = new Set(Object.keys(H.OVERVIEW_HELP));

// Every static help key used by the overview page must have a written explanation.
const used = new Set([...source.matchAll(/['"`](ov\.[a-z0-9_]+)['"`]/g)].map(m => m[1]));
const missing = [...used].filter(k => k !== 'ov.state_' && !keys.has(k)); // 'ov.state_' is a prefix; each state is checked below
assert.deepEqual(missing, [], `help keys used but not written: ${missing.join(', ')}`);
console.log(`PASS ${used.size} help keys used on the overview all have explanations`);

// Keys built at run time: one per visual state and per signal line.
for (const s of ['offline', 'standby', 'ready', 'active', 'valid', 'stable', 'warning', 'fault', 'booting', 'settling', 'maintenance', 'selected']) {
  assert.ok(keys.has(`ov.state_${s}`), `missing ov.state_${s}`);
}
console.log('PASS every status word has an explanation');

// Entries are complete and every "related" link resolves.
for (const [k, e] of Object.entries(H.OVERVIEW_HELP)) {
  assert.ok(e.title && e.title.trim().length > 1, `${k} needs a title`);
  assert.ok(e.desc && e.desc.trim().length > 15, `${k} needs a real description`);
  for (const r of e.related || []) assert.ok(keys.has(r), `${k} relates to unknown key ${r}`);
}
console.log(`PASS ${keys.size} entries are complete and related links resolve`);

assert.match(H.getHelp('ov.does_not_exist').desc, /No explanation/);
console.log('PASS unknown keys fall back safely');
