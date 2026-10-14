// Updates FRED series into D1 from Node, for when the Worker has no FRED_KEY (FRED's CSV endpoint drops Worker connections).
// usage: node scripts/sync.mjs [--remote]
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { FRED } from '../config.js';
import { fred } from '../sources.js';

const remote = process.argv.includes('--remote');
const from = new Date(Date.now() - 70 * 864e5).toISOString().slice(0, 10);
const sql = [];
for (const id of Object.keys(FRED)) {
  try {
    const rows = await fred(id, from);
    if (rows.length) sql.push(`INSERT OR REPLACE INTO obs (series, d, v) VALUES ${rows.map((r) => `('f:${id}', '${r.d}', ${r.v})`).join(',')};`);
    console.log(id, rows.length);
  } catch (e) { console.log('FALLO', id, e.message); }
}
sql.push(`INSERT OR REPLACE INTO source_health (source, ok_at, fails) VALUES ('fred (sync)', ${Date.now()}, 0);`);
mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/sync.sql', sql.join('\n'));
execSync(`npx wrangler d1 execute DB ${remote ? '--remote' : '--local'} --file .wrangler/sync.sql`, { stdio: 'inherit' });
