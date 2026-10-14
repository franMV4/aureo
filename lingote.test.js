import test from 'node:test';
import assert from 'node:assert/strict';
import { ema, rsi, garch, garchHorizon, hmm, touchProb, phi, riskStats, drawdowns, ar1Test, fanCheck, garchSigmaAt } from './quant.js';
import { upto, scoreFactors, hitStats, isSignal } from './factors.js';
import { swings, clusterSwings, mergeLevels, dayLevels, scenarios, levelStats, tradeR } from './levels.js';

// deterministic pseudo-random normal
function rng(seed = 1) {
  let s = seed;
  const u = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}

test('ema and rsi', () => {
  assert.equal(ema([1, 2, 3, 4, 5], 3).at(-1), 4);
  assert.equal(rsi(Array.from({ length: 30 }, (_, i) => i)), 100);
  const zig = Array.from({ length: 60 }, (_, i) => 100 + (i % 2));
  assert.ok(Math.abs(rsi(zig) - 50) < 2);
});

test('normal cdf and touch probability', () => {
  assert.ok(Math.abs(phi(1.96) - 0.975) < 1e-3);
  assert.ok(Math.abs(touchProb(0, 10) - 1) < 1e-9);
  assert.ok(Math.abs(touchProb(19.6, 10) - 0.05) < 1e-3);
});

test('garch recovers persistence from simulated data', () => {
  const z = rng(7), r = [];
  let s2 = 1;
  for (let t = 0; t < 3000; t++) { const e = Math.sqrt(s2) * z(); r.push(e); s2 = 0.05 + 0.08 * e * e + 0.87 * s2; }
  const g = garch(r);
  assert.ok(Math.abs(g.a - 0.08) < 0.04, `alpha ${g.a}`);
  assert.ok(Math.abs(g.pers - 0.95) < 0.04, `pers ${g.pers}`);
  const h = garchHorizon(g, 10);
  assert.ok(h[9] > h[0] && h.length === 10);
});

test('hmm separates calm and stressed regimes', () => {
  const z = rng(3), r = [];
  for (let i = 0; i < 400; i++) r.push(0.5 * z());
  for (let i = 0; i < 200; i++) r.push(2.5 * z());
  const m = hmm(r, 2, 30);
  assert.ok(m.states[0].sd < 0.8 && m.states[1].sd > 1.8, JSON.stringify(m.states));
  assert.equal(m.current, 1);
});

test('risk stats and drawdown', () => {
  const r = riskStats([-3, -1, 0, 1, 2, 1, -2, 0.5, 1, -0.5]);
  assert.ok(r.var95 > 2 && r.es95 >= r.var95);
  assert.equal(drawdowns([100, 120, 90, 110]).max, -25);
  assert.equal(typeof ar1Test(Array.from({ length: 100 }, rng(5))).beats, 'boolean');
});

test('upto is a binary search on dates', () => {
  const rows = ['2024-01-01', '2024-01-03', '2024-01-05'].map((d) => ({ d }));
  assert.equal(upto(rows, '2024-01-04'), 1);
  assert.equal(upto(rows, '2023-12-31'), -1);
  assert.equal(upto(rows, '2024-02-01'), 2);
});

test('factor scores: bullish setup sums positive, missing data votes 0', () => {
  const f = scoreFactors({ price: 110, e20: 105, e50: 100, e200: 90, rsi: 65, roc20: 4, dxy5: -1, ry5: -15, vix: 22, vixRatio: 1.05, vix5: 25, etf5: 6 });
  assert.equal(f.total, 2 + 2 + 2 + 2 + 2 + 2);
  const g = scoreFactors({ price: 100, e20: NaN, e50: NaN, e200: null, rsi: NaN });
  assert.equal(g.total, 0);
  assert.ok(g.list.every((x) => x.missing));
});

test('hit stats against forward returns', () => {
  const rows = [
    { s: { a: 1 }, r1: 1, r5: 1 }, { s: { a: 1 }, r1: -1, r5: 2 }, { s: { a: -1 }, r1: -1, r5: -1 }, { s: { a: 0 }, r1: 1, r5: 1 },
  ];
  const h = hitStats(rows, 'a');
  assert.equal(h.n, 3);
  assert.ok(Math.abs(h.hit1 - 66.67) < 0.1);
  assert.equal(h.hit5, 100);
  assert.equal(isSignal(h, { ...h, n: 10 }), false);
});

test('levels: swings, clusters, merge and scenarios', () => {
  const bars = [1, 2, 3, 5, 3, 2, 1, 2, 3, 5.1, 3, 2, 1].map((h, i) => ({ d: `2024-01-${String(i + 1).padStart(2, '0')}`, h, l: h - 0.5 }));
  const sw = swings(bars, 3);
  assert.equal(sw.filter((s) => s.kind === 'high').length, 2);
  assert.equal(clusterSwings(sw.filter((s) => s.kind === 'high'), 0.5)[0].touches, 2);
  const m = mergeLevels([{ p: 100, labels: ['a'], weight: 1 }, { p: 100.1, labels: ['b'], weight: 2 }, { p: 105, labels: ['c'], weight: 1 }], 0.5);
  assert.equal(m.length, 2);
  assert.equal(m[0].weight, 3);

  const daily = Array.from({ length: 60 }, (_, i) => ({ d: `d${String(i).padStart(3, '0')}`, o: 100, h: 102 + (i % 7 === 3 ? 3 : 0), l: 98 - (i % 9 === 4 ? 3 : 0), v: 100 }));
  const lv = dayLevels({ daily, today: { open: 100, asiaHigh: 101, asiaLow: 99.2, asiaDone: true }, price: 100.2, atr: 4, weekOpen: 99.5, monthOpen: 97 });
  assert.ok(lv.some((l) => l.side === 'R') && lv.some((l) => l.side === 'S'));
  assert.ok(lv.every((l, i) => !i || lv[i - 1].p > l.p));
  assert.ok(!lv.some((l) => l.labels.some((x) => x.includes('ATR'))));
  const sc = scenarios({ price: 100.2, levels: [{ p: 103, weight: 3, labels: ['a'] }, { p: 100.5, weight: 4, labels: ['too close'] }, { p: 106, weight: 1, labels: ['t'] }, { p: 97, weight: 3, labels: ['b'] }], atr: 4, sigma: 4, dayLeft: 0.5 });
  assert.equal(sc.up.trigger, 103);
  assert.ok(sc.up.target - sc.up.trigger >= 1.5 * (sc.up.trigger - sc.up.invalid) - 1e-9);
  assert.ok(Math.abs(sc.up.pWin - 100 / (1 + sc.up.rr)) < 1e-9);
  assert.equal(sc.down.trigger, 97);
  assert.equal(scenarios({ price: 100.2, levels: [{ p: 100.6, weight: 5, labels: ['x'] }], atr: 4, sigma: 4, dayLeft: 1 }).up, null);
  const st = levelStats([{ d: '2024-01-01', h: 10, l: 8, v: 9 }, { d: '2024-01-08', h: 12, l: 9, v: 11 }, { d: '2024-01-09', h: 9.5, l: 9, v: 9.2 }]);
  assert.equal(st.n, 2);
  assert.equal(st.pwh.touch, 50);
  assert.equal(st.pdh.beyond, 100);
});

test('fan check: on gaussian returns the GARCH bands cover what they promise', () => {
  const n = rng(7), r = Array.from({ length: 8000 }, () => n()); // long: 20-day moves overlap, few are independent
  for (const c of fanCheck(r, garchSigmaAt(garch(r)))) assert.ok(Math.abs(c.in90 - 90) < 5 && Math.abs(c.in50 - 50) < 8, JSON.stringify(c));
});

test('variación cuantitativa: recovers the dollar and rates betas and the parts add up', async () => {
  const { align3, moves, fitBetas, attribute, vqBand } = await import('./vq.js');
  assert.equal(vqBand(3), 'Neutro');
  assert.equal(vqBand(-58), 'Bajista fuerte');
  const n = rng(5); let G = 4000, D = 100, Z = 110;
  const g = [], d = [], z = [];
  for (let i = 0; i < 3000; i++) {
    const t = i * 900, rd = n() * 0.05, rz = n() * 0.03, rg = -0.8 * rd + 1.5 * rz + n() * 0.05;
    D *= 1 + rd / 100; Z *= 1 + rz / 100; G *= 1 + rg / 100;
    g.push({ t, c: G }); d.push({ t, c: D }); if (i !== 10) z.push({ t, c: Z });
  }
  const m = moves(align3(g, d, z));
  assert.equal(m.length, 2998); // bar 10 missing in the note: 9 -> 11 is one 30-min move
  const f = fitBetas(m);
  assert.ok(Math.abs(f.bD + 0.8) < 0.1 && Math.abs(f.bZ - 1.5) < 0.15, JSON.stringify(f));
  const last = attribute(m.slice(0, 40), f).at(-1);
  assert.ok(Math.abs(last.dollar + last.rates + last.own - last.total) < 1e-9);
});

test('GJR: when rises lift volatility more than falls (gold-like), gamma comes out negative', () => {
  const n = rng(11), r = [];
  let s2 = 1;
  for (let i = 0; i < 5000; i++) { const e = Math.sqrt(s2) * n(); r.push(e); s2 = 0.05 + (e > 0 ? 0.12 : 0.02) * e * e + 0.88 * s2; }
  const gj = garch(r, { gjr: true });
  assert.ok(gj.g < -0.03, `gamma ${gj.g}`);
});

test('journal plan judged in R on 15-minute bars', () => {
  const b = (l, h, c) => ({ l, h, c });
  // long 100, stop 98 (risk 2): fills, reaches +1 R, then the stop
  assert.deepEqual(tradeR({ bias: 1, entry: 100, invalid: 98, bars: [b(101, 102, 101), b(99.5, 100.5, 100), b(100, 102.5, 102), b(97, 101, 97.5)] }), { entered: true, r: -1, hit1: true });
  // short with basis: spot 100/102 -> futures 110/112; reaches +2 R (106)
  assert.deepEqual(tradeR({ bias: -1, entry: 100, invalid: 102, basis: 10, bars: [b(109, 111, 110), b(105.5, 110, 106)] }), { entered: true, r: 2, hit1: true });
  // never trades at the entry
  assert.deepEqual(tradeR({ bias: 1, entry: 90, invalid: 88, bars: [b(95, 96, 95)] }), { entered: false });
  // open at the close: R from the last price
  assert.equal(tradeR({ bias: 1, entry: 100, invalid: 98, bars: [b(99, 101, 101)] }).r, 0.5);
  // stop on the wrong side or neutral bias: nothing to judge
  assert.equal(tradeR({ bias: 1, entry: 100, invalid: 101, bars: [] }), null);
  assert.equal(tradeR({ bias: 0, entry: 100, invalid: 98, bars: [] }), null);
});
