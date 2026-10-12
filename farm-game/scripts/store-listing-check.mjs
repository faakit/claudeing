// Checks the Google Play listing text in store/listing.<locale>.md: each field within Play's limit, and none of the
// words Play's metadata policy rejects (ranking or price claims, emoji). Run: node scripts/store-listing-check.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'store';
const LIMITS = {
  'App name': 30,
  'Short description': 80,
  'Full description': 4000,
  "What's new": 500,
};
// Play's metadata policy: no performance or ranking claims, no price or promotion words, no emoji in the text.
const BANNED = [
  /\bbest\b/i,
  /#\s?1\b/,
  /\bnumber one\b/i,
  /\btop\b/i,
  /\bfree\b/i,
  /\bsale\b/i,
  /\bdiscount\b/i,
  /\bmelhor(es)?\b/i,
  /\bn[º°o]\.?\s?1\b/i,
  /\bgr[áa]tis\b/i,
  /\bpromo[çc][ãa]o\b/i,
  /\p{Extended_Pictographic}/u,
];

let failed = 0;
for (const file of readdirSync(DIR).filter((f) => /^listing\..+\.md$/.test(f))) {
  const text = readFileSync(join(DIR, file), 'utf8');
  for (const [field, max] of Object.entries(LIMITS)) {
    const at = text.indexOf(`## ${field}`);
    const m = at < 0 ? null : /```text\n([\s\S]*?)\n```/.exec(text.slice(at));
    if (!m) {
      console.log(`FAIL  ${file}: no "${field}" block`);
      failed++;
      continue;
    }
    const body = m[1];
    const n = [...body].length;
    const hits = BANNED.filter((re) => re.test(body)).map(String);
    const ok = n > 0 && n <= max && hits.length === 0;
    if (!ok) failed++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${file}: ${field} ${n}/${max}${hits.length ? ` banned: ${hits.join(' ')}` : ''}`,
    );
  }
}
process.exit(failed ? 1 : 0);
