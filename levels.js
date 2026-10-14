// Key price levels for the session and rule-based scenarios. Pure functions, no I/O.
import { touchProb } from './quant.js';

// Swing highs/lows: a bar whose high (low) is the extreme of the k bars on each side.
export function swings(bars, k = 3) {
  const out = [];
  for (let i = k; i < bars.length - k; i++) {
    const w = bars.slice(i - k, i + k + 1);
    if (bars[i].h === Math.max(...w.map((b) => b.h))) out.push({ p: bars[i].h, kind: 'high', d: bars[i].d });
    if (bars[i].l === Math.min(...w.map((b) => b.l))) out.push({ p: bars[i].l, kind: 'low', d: bars[i].d });
  }
  return out;
}

// Group nearby prices; touches = how many swing points formed the zone.
export function clusterSwings(points, tol) {
  const s = [...points].sort((a, b) => a.p - b.p), out = [];
  for (const pt of s) {
    const c = out.at(-1);
    if (c && pt.p - c.hi <= tol) { c.pts.push(pt); c.hi = pt.p; }
    else out.push({ pts: [pt], hi: pt.p });
  }
  return out.map((c) => ({ p: c.pts.reduce((s, x) => s + x.p, 0) / c.pts.length, touches: c.pts.length, last: c.pts.map((x) => x.d).sort().at(-1) }));
}

// Merge levels closer than tol into one, keeping every origin label.
export function mergeLevels(levels, tol) {
  const s = [...levels].sort((a, b) => a.p - b.p), out = [];
  for (const l of s) {
    const c = out.at(-1);
    if (c && l.p - c.p <= tol) { c.labels.push(...l.labels); c.weight += l.weight; c.p = (c.p * (c.labels.length - l.labels.length) + l.p * l.labels.length) / c.labels.length; }
    else out.push({ p: l.p, labels: [...l.labels], weight: l.weight });
  }
  return out;
}

const round = (step, from, to) => { const out = []; for (let v = Math.ceil(from / step) * step; v <= to; v += step) out.push(v); return out; };

// daily: [{d,o,h,l,v}] up to the last complete session; today: {open, asiaHigh, asiaLow, asiaDone};
// prevWeek / prevMonth: {h, l}; vwap / prevVwap: volume-weighted price of this and the previous session.
export function dayLevels({ daily, today, price, atr, weekOpen, monthOpen, prevWeek, prevMonth, vwap, prevVwap }) {
  const prev = daily.at(-1), tol = 0.15 * atr, L = [];
  const add = (p, label, weight) => p != null && isFinite(p) && L.push({ p, labels: [label], weight });
  add(prev.h, 'Máximo de ayer', 2);
  add(prev.l, 'Mínimo de ayer', 2);
  add(prev.v, 'Cierre de ayer', 1);
  add(prevWeek?.h, 'Máximo semana anterior', 2);
  add(prevWeek?.l, 'Mínimo semana anterior', 2);
  add(prevMonth?.h, 'Máximo mes anterior', 1.5);
  add(prevMonth?.l, 'Mínimo mes anterior', 1.5);
  add(weekOpen, 'Apertura semanal', 1);
  add(monthOpen, 'Apertura mensual', 1);
  add(vwap, 'VWAP de la sesión', 1.5);
  add(prevVwap, 'VWAP de ayer', 1);
  if (today?.asiaHigh != null) {
    add(today.asiaHigh, today.asiaDone ? 'Máximo de Asia' : 'Máximo de Asia (en curso)', 1.5);
    add(today.asiaLow, today.asiaDone ? 'Mínimo de Asia' : 'Mínimo de Asia (en curso)', 1.5);
  }
  for (const z of clusterSwings(swings(daily.slice(-180).map((b) => ({ d: b.d, h: b.h, l: b.l }))), 0.5 * atr)) {
    if (z.touches >= 2 && Math.abs(z.p - price) <= 3 * atr) add(z.p, `Zona de giro (${z.touches} toques)`, Math.min(3, z.touches));
  }
  // in gold the 100 $ handles matter more than the 50s
  for (const v of round(50, price - 1.5 * atr, price + 1.5 * atr)) add(v, v % 100 ? 'Número redondo (50)' : 'Número redondo (100)', v % 100 ? 0.5 : 1);
  // more than 3 ATR away is not a level for today
  return mergeLevels(L.filter((l) => Math.abs(l.p - price) <= 3 * atr), tol).map((l) => ({ ...l, side: l.p > price ? 'R' : 'S', dist: l.p - price, strong: l.weight >= 2.5 })).sort((a, b) => b.p - a.p);
}

// How the classic levels behaved since 2006 on daily bars: share of days that touched them and,
// of those, share that closed beyond. Previous week = the calendar week before the day's.
export function levelStats(daily) {
  const wk = (d) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const weeks = new Map();
  for (const b of daily) { const k = wk(b.d), w = weeks.get(k); weeks.set(k, w ? { h: Math.max(w.h, b.h), l: Math.min(w.l, b.l) } : { h: b.h, l: b.l }); }
  const keys = [...weeks.keys()];
  const c = { pdh: [0, 0], pdl: [0, 0], pwh: [0, 0], pwl: [0, 0] };
  let n = 0;
  const count = (k, touched, beyond) => { if (touched) { c[k][0]++; if (beyond) c[k][1]++; } };
  for (let i = 1; i < daily.length; i++) {
    const b = daily[i], p = daily[i - 1], pw = weeks.get(keys[keys.indexOf(wk(b.d)) - 1]);
    if (b.h == null || p.h == null || !pw) continue;
    n++;
    count('pdh', b.h >= p.h, b.v > p.h); count('pdl', b.l <= p.l, b.v < p.l);
    count('pwh', b.h >= pw.h, b.v > pw.h); count('pwl', b.l <= pw.l, b.v < pw.l);
  }
  const out = (k) => ({ touch: (c[k][0] / n) * 100, beyond: c[k][0] ? (c[k][1] / c[k][0]) * 100 : null });
  return { n, from: daily[1]?.d, pdh: out('pdh'), pdl: out('pdl'), pwh: out('pwh'), pwl: out('pwl') };
}

// Breakout and breakdown scenarios. sigma = 1-day stdev in $, dayLeft = fraction of the session left.
// A trigger needs real weight (>= 3) and room (>= 0.3 ATR away); the target must pay at least 1.5 R.
export function scenarios({ price, levels, atr, sigma, dayLeft }) {
  const sT = sigma * Math.sqrt(Math.max(dayLeft, 0.05)), risk = 0.25 * atr;
  const above = levels.filter((l) => l.p > price).sort((a, b) => a.p - b.p);
  const below = levels.filter((l) => l.p < price).sort((a, b) => b.p - a.p);
  const make = (dir, arr) => {
    const trig = arr.find((l) => l.weight >= 3 && Math.abs(l.p - price) >= 0.3 * atr);
    if (!trig) return null;
    // ponytail: with no mapped level far enough beyond the trigger, aim 1.5 R past it
    const tgt = arr.find((l) => (l.p - trig.p) * dir >= 1.5 * risk && l.weight >= 1) ?? { p: trig.p + dir * 1.5 * risk, labels: ['1,5 R más allá'] };
    const inv = trig.p - dir * risk;
    return {
      dir, trigger: trig.p, triggerWhy: trig.labels, target: tgt.p, targetWhy: tgt.labels, invalid: inv,
      rr: Math.abs(tgt.p - trig.p) / risk,
      pTrigger: touchProb(trig.p - price, sT) * 100,
      // once triggered, a driftless walk reaches the target before the stop with (trigger - stop) / (target - stop)
      pWin: (risk / Math.abs(tgt.p - inv)) * 100,
    };
  };
  const up = make(1, above), down = make(-1, below);
  return { up, down, range: up && down ? { lo: down.trigger, hi: up.trigger, width: up.trigger - down.trigger } : null, sigmaLeft: sT };
}

// A journal plan judged as a trade on 15-minute futures bars from the moment it was written.
// entry/invalid are spot prices; basis (futures - spot when saved) moves them onto the bars.
// Fills at the entry when a bar trades through it; then the stop (-1 R) or +2 R, whichever comes first
// (both in one bar counts as the stop); still open at the end of the session: closed at the last price.
export function tradeR({ bias, entry, invalid, basis = 0, bars }) {
  if (!bias || entry == null || invalid == null || (entry - invalid) * bias <= 0) return null;
  const E = entry + basis, I = invalid + basis, risk = Math.abs(E - I), T = E + bias * 2 * risk;
  let i = bars.findIndex((b) => b.l <= E && b.h >= E);
  if (i < 0) return { entered: false };
  let best = 0;
  for (; i < bars.length; i++) {
    const b = bars[i];
    if (bias > 0 ? b.l <= I : b.h >= I) return { entered: true, r: -1, hit1: best >= 1 };
    best = Math.max(best, ((bias > 0 ? b.h : b.l) - E) * bias / risk);
    if (best >= 2) return { entered: true, r: 2, hit1: true };
  }
  return { entered: true, r: ((bars.at(-1).c - E) * bias) / risk, hit1: best >= 1 };
}
