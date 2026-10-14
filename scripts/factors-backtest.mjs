// Backtest of each factor and of the total, with the same code as the live page (factors.js).
// In-sample 2008–2020, out-of-sample 2021–today, at 1, 5 and 20 sessions (20 without overlap). Writes D1 kv 'factors:backtest'.
// usage: node scripts/factors-backtest.mjs [--remote]
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { yahooDaily, fred, gldHoldings } from '../sources.js';
import { pct, mean } from '../analytics.js';
import { factorInputs, scoreFactors, hitStats, isSignal, FACTORS } from '../factors.js';

export const TOTAL_MIN = 2; // |total| from which the balance counts as leaning one way (of ±12; was 3 of ±18)

const from = '2006-01-01';
const [gc, dxy, vix, vix3m] = await Promise.all(['GC=F', 'DX-Y.NYB', '^VIX', '^VIX3M'].map((s) => yahooDaily(s, from)));
const ry = await fred('DFII10', from);
const gld = await gldHoldings();
console.log('datos', { gc: gc.length, dxy: dxy.length, ry: ry.length, gld: gld.length });

const S = { gc, dxy, ry, vix, vix3m, gld };
const rows = [];
for (let i = 0; i < gc.length - 5; i++) {
  const d = gc[i].d;
  if (d < '2008-01-01') continue;
  const x = factorInputs(S, d);
  if (!x) continue;
  const f = scoreFactors(x);
  const s = Object.fromEntries(f.list.map((p) => [p.k, p.score]));
  s.total = f.total >= TOTAL_MIN ? 1 : f.total <= -TOTAL_MIN ? -1 : 0;
  rows.push({ i: rows.length, d, s, t: f.total, r1: pct(gc[i].v, gc[i + 1].v), r5: pct(gc[i].v, gc[i + 5].v), r20: gc[i + 20] ? pct(gc[i].v, gc[i + 20].v) : null });
}

const IS = rows.filter((r) => r.d <= '2020-12-31'), OOS = rows.filter((r) => r.d >= '2021-01-01');
const evalKey = (k) => { const is = hitStats(IS, k), oos = hitStats(OOS, k); return { is, oos, signal: isSignal(is, oos) }; };
const result = {
  generated: Date.now(),
  period: `${rows[0].d.slice(0, 4)}–${rows.at(-1).d.slice(0, 4)}`, days: rows.length, split: '2021-01-01', totalMin: TOTAL_MIN,
  factors: Object.fromEntries(FACTORS.map(([k]) => [k, evalKey(k)])),
  total: evalKey('total'),
  byTotal: [...new Set(rows.map((r) => r.t))].sort((a, b) => a - b).map((t) => {
    const x = OOS.filter((r) => r.t === t);
    return { t, n: x.length, up: x.length ? (x.filter((r) => r.r1 > 0).length / x.length) * 100 : null, avg5: x.length ? mean(x.map((r) => r.r5)) : null };
  }).filter((x) => x.n >= 5),
  baseUp: { is: (IS.filter((r) => r.r1 > 0).length / IS.length) * 100, oos: (OOS.filter((r) => r.r1 > 0).length / OOS.length) * 100 },
};

const pp = (v) => (v == null ? '   —' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`.padStart(5));
console.log(`\n${'factor'.padEnd(12)} ${'n IS'.padStart(5)} ${'edge1'.padStart(6)} ${'n OOS'.padStart(6)} ${'edge1'.padStart(6)} ${'edge5'.padStart(6)}  veredicto`);
for (const [k, v] of [...Object.entries(result.factors), ['total', result.total]]) {
  console.log(`${k.padEnd(12)} ${String(v.is?.n ?? 0).padStart(5)} ${pp(v.is?.edge1)}  ${String(v.oos?.n ?? 0).padStart(6)} ${pp(v.oos?.edge1)}  ${pp(v.oos?.edge5)}  20s ${String(v.oos?.n20 ?? 0).padStart(3)} ${pp(v.oos?.edge20)}   ${v.signal ? 'SEÑAL' : 'contexto'}`);
}

mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/factors.sql', `INSERT OR REPLACE INTO kv (k, v, t) VALUES ('factors:backtest', '${JSON.stringify(result).replace(/'/g, "''")}', ${Date.now()});`);
execSync(`npx wrangler d1 execute DB ${process.argv.includes('--remote') ? '--remote' : '--local'} --file .wrangler/factors.sql`, { stdio: 'inherit' });
