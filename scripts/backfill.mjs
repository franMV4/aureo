// One-off history load into D1. Fetches from Node (no Worker CPU limits), writes SQL, runs it with wrangler.
// usage: node scripts/backfill.mjs [--remote] [--from=N]
// Writes in chunks of ~15.000 rows, each its own transaction: D1's free plan writes 100.000 rows a day, so a
// big first load may stop halfway; rerun the next day with --from=<chunk it printed> to carry on.
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { YAHOO, FRED, RELEASES, FOMC } from '../config.js';
import { yahooDaily, yahooBars, fred, gldHoldings, cotHistory, COT_MARKETS, fredReleaseDates, fomcStatements } from '../sources.js';
import { zonedToUtc, eventMoves, seasonalityHourly } from '../analytics.js';

const remote = process.argv.includes('--remote');
const from = Number(process.argv.find((a) => a.startsWith('--from='))?.slice(7) ?? 0);
const q = (v) => (v == null || (typeof v === 'number' && !isFinite(v)) ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sql = [], weight = []; // weight = rows each statement writes
function insert(table, cols, rows) {
  for (let i = 0; i < rows.length; i += 150) {
    weight.push(Math.min(150, rows.length - i));
    sql.push(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES ${rows.slice(i, i + 150).map((r) => `(${r.map(q).join(',')})`).join(',')};`);
  }
}
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const safe = async (name, fn) => { try { return await fn(); } catch (e) { log('FALLO', name, e.message); return null; } };

// 1. Yahoo daily
for (const y of YAHOO) {
  const rows = await safe(y.s, () => yahooDaily(y.s, y.long ? '2006-01-01' : '5y'));
  if (rows) { insert('obs', ['series', 'd', 'v', 'o', 'h', 'l'], rows.map((r) => [`y:${y.s}`, r.d, r.v, r.o, r.h, r.l])); log('yahoo', y.s, rows.length); }
}

// 2. FRED (macro releases from 2010 to measure their typical size; markets from 2016)
for (const id of Object.keys(FRED)) {
  const monthly = RELEASES.some((r) => r.fred === id);
  const rows = await safe(id, () => fred(id, monthly ? '2010-01-01' : '2016-01-01'));
  if (rows) { insert('obs', ['series', 'd', 'v'], rows.map((r) => [`f:${id}`, r.d, r.v])); log('fred', id, rows.length); }
}

// 3. GLD tonnes
const gld = await safe('gld', gldHoldings);
if (gld) { insert('obs', ['series', 'd', 'v'], gld.filter((r) => r.d >= '2016-01-01').map((r) => ['gld:tonnes', r.d, r.v])); log('gld', gld.length); }

// 4. COT, 10 markets, 5 years
for (const m of COT_MARKETS) {
  const rows = await safe(`cot ${m.id}`, () => cotHistory(m, 260));
  if (rows) { insert('cot', ['market', 'd', 'net', 'comm', 'oi'], rows.map((r) => [m.id, r.d, r.net, r.comm, r.oi])); log('cot', m.id, rows.length); }
}

// 5. Historical releases + gold reaction from 2 years of hourly bars
const bars = await safe('GC 60m', () => yahooBars('GC=F', '730d', '60m'));
if (bars?.length) {
  const first = bars[0].t;
  const events = [];
  const years = [2024, 2025, 2026];
  for (const r of RELEASES.filter((x) => !x.noHist)) {
    let dates = [];
    if (r.kind === 'fomc') dates = FOMC.filter((d) => new Date(d) < new Date());
    else for (const y of years) dates.push(...((await safe(`release ${r.rid} ${y}`, () => fredReleaseDates(r.rid, y))) ?? []));
    for (const d of dates) {
      const T = zonedToUtc(d, r.et);
      if (T < first) continue;
      const m = eventMoves(bars, T, 3600);
      if (m) events.push([`${r.kind}:${d}`, T * 1000, 'USD', r.name, 'High', r.kind, m.r15, m.r60, m.rday]);
    }
    log('releases', r.kind, dates.length);
  }
  insert('events', ['id', 't', 'country', 'title', 'impact', 'kind', 'r15', 'r60', 'rday'], events);
  weight.push(1);
  sql.push(`INSERT OR REPLACE INTO kv (k, v, t) VALUES ('season:hourly', ${q(JSON.stringify(seasonalityHourly(bars)))}, ${Date.now()});`);
  log('events', events.length, 'bars', bars.length);
}

// 6. Last two FOMC statements
const st = await safe('fomc', () => fomcStatements(2));
if (st?.length) weight.push(1), sql.push(`INSERT OR REPLACE INTO kv (k, v, t) VALUES ('stmt:fomc', ${q(JSON.stringify(st))}, ${Date.now()});`);

mkdirSync('.wrangler', { recursive: true });
const chunks = [[]];
let rows = 0;
sql.forEach((st, i) => { if (rows + weight[i] > 15000 && chunks.at(-1).length) { chunks.push([]); rows = 0; } chunks.at(-1).push(st); rows += weight[i]; });
log('SQL', sql.length, 'sentencias,', weight.reduce((a, b) => a + b, 0), 'filas en', chunks.length, 'trozos');
const run = (file) => execSync(`npx wrangler d1 execute DB ${remote ? '--remote' : '--local'} --yes --file ${file}`, { stdio: 'inherit' });
run('schema.sql');
for (let k = from; k < chunks.length; k++) {
  writeFileSync(`.wrangler/backfill-${k}.sql`, chunks[k].join('\n'));
  try { run(`.wrangler/backfill-${k}.sql`); log(`trozo ${k + 1} de ${chunks.length} cargado`); }
  catch {
    log(`Se paró en el trozo ${k} (lo normal: el límite diario de escrituras de D1). Mañana sigue con:`);
    log(`  npm run backfill -- ${remote ? '--remote ' : ''}--from=${k}`);
    process.exit(1);
  }
}
log('hecho');
