// Backtest of the gold bias (M1) over the last 10 years, using the same scoring code as the live site.
// The macro-surprise component has no free history, so it votes 0 here. Writes the result to D1 kv 'backtest'.
// usage: node scripts/backtest.mjs [--remote]
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { yahooDaily, fred, gldHoldings, cotHistory, COT_MARKETS } from '../sources.js';
import { bias, regime, pct, sma, mean } from '../analytics.js';
import { cotIndex } from '../lib.js';

const from = '2015-01-01';
const map = (rows) => new Map(rows.map((r) => [r.d, r.v]));
const [gc, dxy, vix, vix3m, spx, hg, move] = await Promise.all(['GC=F', 'DX-Y.NYB', '^VIX', '^VIX3M', '^GSPC', 'HG=F', '^MOVE'].map((s) => yahooDaily(s, from)));
const [ry, hy] = [await fred('DFII10', from), await fred('BAMLH0A0HYM2', from)];
const gld = await gldHoldings();
const cot = await cotHistory(COT_MARKETS[0], 700);
console.log('datos', gc.length, dxy.length, ry.length, gld.length, cot.length);

const M = { dxy: map(dxy), vix: map(vix), vix3m: map(vix3m), spx: map(spx), hg: map(hg), move: map(move), ry: map(ry), hy: map(hy), gld: map(gld) };
const lastBefore = (rows, d, k = 0) => { const i = rows.findLastIndex((r) => r.d <= d); return i - k >= 0 ? rows[i - k].v : null; };
const days = gc.filter((r) => r.d >= '2016-06-01');
const rows = [];
for (const day of days) {
  const i = gc.indexOf(day);
  if (i < 60 || i >= gc.length - 6) continue;
  const d = day.d, closes = gc.slice(0, i + 1).map((r) => r.v);
  const spxRows = spx.filter((r) => r.d <= d);
  const reg = regime({
    vixRatio: M.vix.get(d) && M.vix3m.get(d) ? M.vix.get(d) / M.vix3m.get(d) : null,
    vix: M.vix.get(d) ?? null,
    hyChg20: lastBefore(hy, d) != null && lastBefore(hy, d, 20) != null ? lastBefore(hy, d) - lastBefore(hy, d, 20) : null,
    spxVs200: spxRows.length >= 200 ? pct(sma(spxRows.map((r) => r.v), 200), spxRows.at(-1).v) : null,
    move: M.move.get(d) ?? null,
    cuAuChg20: (() => { const a = lastBefore(hg, d), b = lastBefore(hg, d, 20), g20 = gc[i - 20]?.v; return a && b && g20 ? pct(b / g20, a / day.v) : null; })(),
  });
  const ry5 = lastBefore(ry, d) != null && lastBefore(ry, d, 5) != null ? lastBefore(ry, d) - lastBefore(ry, d, 5) : null;
  // COT is published on Friday for the Tuesday before: only use reports at least 3 days old
  const known = cot.filter((c) => new Date(c.d).getTime() + 3 * 864e5 <= new Date(d).getTime());
  const b = bias({
    dxy5: lastBefore(dxy, d) && lastBefore(dxy, d, 5) ? pct(lastBefore(dxy, d, 5), lastBefore(dxy, d)) : null,
    ry5, price: day.v, sma20: sma(closes, 20), sma50: sma(closes, 50), regime: reg.label,
    etf5: lastBefore(gld, d) != null && lastBefore(gld, d, 5) != null ? lastBefore(gld, d) - lastBefore(gld, d, 5) : null,
    cot: known.length >= 156 ? cotIndex(known.map((c) => c.net), 156) : null, surprise: null,
  });
  rows.push({ d, score: b.score, label: b.label, r1: pct(day.v, gc[i + 1].v), r5: pct(day.v, gc[i + 5].v) });
}

const hit = (label, k, dir) => { const s = rows.filter((r) => r.label === label); return { n: s.length, pct: (s.filter((r) => Math.sign(r[k]) === dir).length / s.length) * 100, avg: mean(s.map((r) => r[k])) }; };
const buy1 = hit('COMPRADOR', 'r1', 1), sell1 = hit('VENDEDOR', 'r1', -1), buy5 = hit('COMPRADOR', 'r5', 1), sell5 = hit('VENDEDOR', 'r5', -1);
const result = {
  period: `${rows[0].d.slice(0, 4)}–${rows.at(-1).d.slice(0, 4)}`, days: rows.length,
  buyHit: buy1.pct, buyN: buy1.n, buyAvg: buy1.avg, sellHit: sell1.pct, sellN: sell1.n, sellAvg: sell1.avg,
  buyHit5: buy5.pct, sellHit5: sell5.pct,
  base: (rows.filter((r) => r.r1 > 0).length / rows.length) * 100,
  byScore: Array.from({ length: 15 }, (_, k) => k - 7).map((s) => { const x = rows.filter((r) => r.score === s); return { score: s, n: x.length, up: x.length ? (x.filter((r) => r.r1 > 0).length / x.length) * 100 : null, avg5: x.length ? mean(x.map((r) => r.r5)) : null }; }).filter((x) => x.n),
  note: 'Sin el componente de sorpresa macro (no hay histórico gratuito de previsiones).',
};
console.log(JSON.stringify(result, null, 1));
mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/backtest.sql', `INSERT OR REPLACE INTO kv (k, v, t) VALUES ('backtest', '${JSON.stringify(result).replace(/'/g, "''")}', ${Date.now()});`);
execSync(`npx wrangler d1 execute DB ${process.argv.includes('--remote') ? '--remote' : '--local'} --file .wrangler/backtest.sql`, { stdio: 'inherit' });
