import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atr, corr, align, ols2, expectedRange, strength, parseNum, reactionStats, seasonalityMonthly, streak, cotStats, fedPath, wordDiff, releaseDates, regime, bias } from './analytics.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('atr and corr', () => {
  const bars = [{ h: 10, l: 9, c: 9.5 }, { h: 11, l: 9, c: 10 }, { h: 10.5, l: 10, c: 10.2 }];
  close(atr(bars, 2), (2 + 0.5) / 2);
  close(corr([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  close(corr([1, 2, 3, 4], [8, 6, 4, 2]), -1);
});

test('align joins on common dates', () => {
  const out = align([{ d: 'a', v: 1 }, { d: 'b', v: 2 }, { d: 'c', v: 3 }], [{ d: 'b', v: 20 }, { d: 'c', v: 30 }]);
  assert.deepEqual(out, [{ d: 'b', v: [2, 20] }, { d: 'c', v: [3, 30] }]);
});

test('ols2 recovers exact coefficients', () => {
  const x1 = [1, 2, 3, 4, 5, 6], x2 = [2, 1, 4, 3, 6, 5];
  const y = x1.map((v, i) => 3 + 2 * v - 0.5 * x2[i]);
  const r = ols2(y, x1, x2);
  close(r.a, 3); close(r.b, 2); close(r.c, -0.5); close(r.r2, 1);
});

test('expected range from implied vol', () => close(expectedRange(4000, 15.874507866387544), 4000 * 0.01));

test('currency strength puts USD as minus the mean', () => {
  const s = strength({ EUR: 1, JPY: -1, GBP: 0 });
  assert.equal(s.find((x) => x.cur === 'USD').v, -0);
  assert.equal(s[0].cur, 'EUR');
});

test('parseNum handles Forex Factory formats', () => {
  assert.equal(parseNum('0.3%'), 0.3);
  assert.equal(parseNum('197K'), 197000);
  assert.equal(parseNum('-1.2M'), -1200000);
  assert.equal(parseNum(''), null);
});

test('reactionStats', () => {
  const r = reactionStats([1, -1, 2, null]);
  assert.equal(r.n, 3); close(r.mean, 2 / 3); assert.equal(r.median, 1); close(r.upPct, 200 / 3);
});

test('monthly seasonality uses month-end closes', () => {
  const daily = [{ d: '2024-01-31', v: 100 }, { d: '2024-02-29', v: 110 }, { d: '2025-01-31', v: 100 }, { d: '2025-02-28', v: 90 }];
  const feb = seasonalityMonthly(daily)[1];
  assert.equal(feb.n, 2); close(feb.mean, 0); assert.equal(feb.upPct, 50);
});

test('streak counts consecutive closes', () => {
  assert.equal(streak([1, 2, 3, 4]), 3);
  assert.equal(streak([5, 4, 3, 4, 3, 2]), -2);
});

test('cotStats flags extremes and divergences', () => {
  const net = Array.from({ length: 160 }, (_, i) => i);
  const s = cotStats(net.map((v, i) => (i > 155 ? 150 - i : v)), Array.from({ length: 20 }, (_, i) => 100 + i));
  assert.equal(s.divergence, 'bajista');
  assert.equal(cotStats(net, []).extreme, 'largo');
});

test('fedPath reads the month after each meeting', () => {
  const p = fedPath(4.0, ['2026-10-28', '2026-12-09'], { '2026-11': 96.125, '2027-01': 96.375 }, new Date('2026-10-06'));
  close(p[0].rate, 3.875); close(p[0].cutProb, 50);
  close(p[1].cumulative, -0.375); close(p[1].cutProb, 100);
});

test('wordDiff marks removed and added words', () => {
  const d = wordDiff('rates were held steady', 'rates were lowered');
  assert.deepEqual(d.filter((x) => x.op !== '=').map((x) => x.op + x.w), ['-held', '-steady', '+lowered']);
});

test('releaseDates keeps past dates only', () => {
  const html = '<td>January 10, 2025</td><td>December 16, 2099</td>';
  assert.deepEqual(releaseDates(html, new Date('2026-01-01')), ['2025-01-10']);
});

test('regime and bias labels', () => {
  assert.equal(regime({ vixRatio: 1.1, vix: 30, hyChg20: 0.8, spxVs200: -2, move: 130, cuAuChg20: -3 }).label, 'RISK-OFF');
  const b = bias({ dxy5: -1, ry5: -0.1, price: 10, sma20: 9, sma50: 8, regime: 'RISK-OFF', etf5: 5, cot: 50, surprise: null });
  assert.equal(b.score, 5); assert.equal(b.label, 'COMPRADOR');
});

import { zonedToUtc, eventMoves } from './analytics.js';
test('zonedToUtc handles DST in New York', () => {
  assert.equal(new Date(zonedToUtc('2026-07-10', '08:30') * 1000).toISOString(), '2026-07-10T12:30:00.000Z');
  assert.equal(new Date(zonedToUtc('2026-01-09', '08:30') * 1000).toISOString(), '2026-01-09T13:30:00.000Z');
});
test('eventMoves measures from the last close before the release', () => {
  const T = zonedToUtc('2026-07-10', '08:30');
  const bars = [-2, -1, 0, 1, 2].map((k, i) => ({ t: T - 1800 + k * 3600, c: 100 + i }));
  const m = eventMoves(bars, T, 3600);
  // last bar ending <= 08:30 closes at 101 (07:30-08:00 ET bar ends 07:30+1h); first bar ending >= 09:30 closes at 103
  close(m.r60, (103 / 101 - 1) * 100);
});
