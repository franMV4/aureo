// Pure analytics for the 15 modules. No I/O; shared by the worker, the backfill and the backtest.
import { cotIndex } from './lib.js';

export const last = (a) => a[a.length - 1];
export const pct = (from, to) => (from ? ((to - from) / from) * 100 : null);
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
export const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
export const median = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
export const sma = (a, n) => (a.length >= n ? mean(a.slice(-n)) : NaN);
export const changes = (a) => a.slice(1).map((x, i) => pct(a[i], x));
export const diffs = (a) => a.slice(1).map((x, i) => x - a[i]);

// Average true range over n bars of {h,l,c}
export function atr(bars, n = 14) {
  const tr = bars.slice(1).map((b, i) => Math.max(b.h - b.l, Math.abs(b.h - bars[i].c), Math.abs(b.l - bars[i].c)));
  return sma(tr, n);
}

export function corr(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return NaN;
  const a = x.slice(-n), b = y.slice(-n), ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : NaN;
}

// Join date-keyed series [{d,v}] on common dates, oldest first.
export function align(...series) {
  const maps = series.map((s) => new Map(s.map((o) => [o.d, o.v])));
  return series[0].map((o) => o.d).filter((d) => maps.every((m) => m.get(d) != null)).map((d) => ({ d, v: maps.map((m) => m.get(d)) }));
}

// y = a + b*x1 + c*x2 by least squares (3x3 normal equations, Cramer's rule).
export function ols2(y, x1, x2) {
  const n = y.length;
  let s1 = 0, s2 = 0, s11 = 0, s22 = 0, s12 = 0, sy = 0, s1y = 0, s2y = 0;
  for (let i = 0; i < n; i++) { s1 += x1[i]; s2 += x2[i]; s11 += x1[i] ** 2; s22 += x2[i] ** 2; s12 += x1[i] * x2[i]; sy += y[i]; s1y += x1[i] * y[i]; s2y += x2[i] * y[i]; }
  const M = [[n, s1, s2], [s1, s11, s12], [s2, s12, s22]], V = [sy, s1y, s2y];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  const col = (k) => det(M.map((r, i) => r.map((v, j) => (j === k ? V[i] : v))));
  const [a, b, c] = [col(0) / D, col(1) / D, col(2) / D];
  const fit = y.map((_, i) => a + b * x1[i] + c * x2[i]);
  const resid = y.map((v, i) => v - fit[i]);
  const my = mean(y);
  const r2 = 1 - resid.reduce((s, r) => s + r * r, 0) / y.reduce((s, v) => s + (v - my) ** 2, 0);
  return { a, b, c, fit, resid, r2 };
}

// Expected one-day move from annualised implied vol (GVZ, in %).
export const expectedRange = (price, vol) => (price * vol) / 100 / Math.sqrt(252);

// Currency strength: input = % change of each currency vs USD; USD = minus their mean.
export function strength(vsUsd) {
  const out = { USD: -mean(Object.values(vsUsd)) };
  for (const [k, v] of Object.entries(vsUsd)) out[k] = v + out.USD;
  return Object.entries(out).map(([cur, v]) => ({ cur, v })).sort((a, b) => b.v - a.v);
}

// Numbers as Forex Factory writes them: "0.3%", "197K", "-1.2M", "4.25|4.50"
export function parseNum(s) {
  if (s == null || s === '') return null;
  const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const k = /\d\s*K/i.test(s) ? 1e3 : /\d\s*M/i.test(s) ? 1e6 : /\d\s*B/i.test(s) ? 1e9 : 1;
  return Number(m[0]) * k;
}

export function reactionStats(moves) {
  const a = moves.filter((x) => x != null && isFinite(x));
  if (!a.length) return { n: 0 };
  return { n: a.length, mean: mean(a), median: median(a), absMean: mean(a.map(Math.abs)), absMedian: median(a.map(Math.abs)), upPct: (a.filter((x) => x > 0).length / a.length) * 100 };
}

// Monthly seasonality from daily {d,v} closes: mean return and % of up years per calendar month.
export function seasonalityMonthly(daily) {
  const endOfMonth = new Map();
  for (const o of daily) endOfMonth.set(o.d.slice(0, 7), o.v);
  const keys = [...endOfMonth.keys()];
  const rets = keys.slice(1).map((k, i) => ({ m: +k.slice(5, 7), r: pct(endOfMonth.get(keys[i]), endOfMonth.get(k)) }));
  return Array.from({ length: 12 }, (_, i) => {
    const r = rets.filter((x) => x.m === i + 1).map((x) => x.r);
    return { month: i + 1, n: r.length, mean: mean(r), upPct: r.length ? (r.filter((x) => x > 0).length / r.length) * 100 : NaN };
  });
}

export function seasonalityWeekday(daily) {
  const rets = daily.slice(1).map((o, i) => ({ w: new Date(o.d + 'T12:00:00Z').getUTCDay(), r: pct(daily[i].v, o.v) }));
  return [1, 2, 3, 4, 5].map((w) => { const r = rets.filter((x) => x.w === w).map((x) => x.r); return { weekday: w, n: r.length, mean: mean(r), upPct: (r.filter((x) => x > 0).length / r.length) * 100, absMean: mean(r.map(Math.abs)) }; });
}

// Hourly profile from intraday bars {t,o,h,l,c}: mean absolute % move and mean range per UTC hour.
export function seasonalityHourly(bars) {
  const by = Array.from({ length: 24 }, () => []);
  for (const b of bars) if (b.o && b.c) by[new Date(b.t * 1000).getUTCHours()].push({ r: pct(b.o, b.c), rg: ((b.h - b.l) / b.o) * 100 });
  return by.map((a, h) => ({ hour: h, n: a.length, absMean: mean(a.map((x) => Math.abs(x.r))), range: mean(a.map((x) => x.rg)) }));
}

// Current streak of up (+n) or down (-n) closes.
export function streak(values) {
  let n = 0;
  for (let i = values.length - 1; i > 0; i--) {
    const s = Math.sign(values[i] - values[i - 1]);
    if (!s || (n && Math.sign(n) !== s)) break;
    n += s;
  }
  return n;
}

// COT summary for one market: speculator net series (oldest first) + weekly prices aligned.
export function cotStats(net, prices) {
  const z = (net.at(-1) - mean(net.slice(-156))) / std(net.slice(-156));
  const idx156 = cotIndex(net, 156);
  let divergence = null;
  if (prices.length >= 13 && net.length >= 5) {
    const p = prices.slice(-13), hi = Math.max(...p), lo = Math.min(...p);
    const dn = net.at(-1) - net.at(-5);
    if (p.at(-1) >= hi && dn < 0) divergence = 'bajista';
    if (p.at(-1) <= lo && dn > 0) divergence = 'alcista';
  }
  return { net: net.at(-1), change: net.at(-1) - (net.at(-2) ?? net.at(-1)), idx26: cotIndex(net, 26), idx156, z, extreme: idx156 >= 80 ? 'largo' : idx156 <= 20 ? 'corto' : null, divergence };
}

// Fed path from 30-day fed funds futures. meetings = ['2026-10-28', ...]; zq = {'2026-11': price, ...}
// Implied rate after each meeting = 100 - price of the first month fully after it (no FOMC meets in consecutive months).
export function fedPath(effr, meetings, zq, now = new Date()) {
  const out = [];
  for (const m of meetings) {
    if (new Date(m + 'T18:00:00Z') < now) continue;
    const d = new Date(m + 'T00:00:00Z');
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
    if (zq[next] == null) continue;
    const rate = 100 - zq[next];
    const prev = out.length ? out.at(-1).rate : effr;
    const step = rate - prev;
    out.push({ meeting: m, rate, change: step, cumulative: rate - effr, cutProb: Math.max(0, Math.min(100, (-step / 0.25) * 100)), hikeProb: Math.max(0, Math.min(100, (step / 0.25) * 100)) });
  }
  return out;
}

// Word-level diff (LCS). Returns [{op:'=', w}, {op:'-', w}, {op:'+', w}]
export function wordDiff(a, b) {
  const A = a.split(/\s+/).filter(Boolean), B = b.split(/\s+/).filter(Boolean);
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ op: '=', w: A[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ op: '-', w: A[i++] });
    else out.push({ op: '+', w: B[j++] });
  }
  while (i < n) out.push({ op: '-', w: A[i++] });
  while (j < m) out.push({ op: '+', w: B[j++] });
  return out;
}

// Release dates from a FRED release-calendar page (past dates only).
export function releaseDates(html, now = new Date()) {
  const txt = html.replace(/<[^>]+>/g, ' ');
  const re = /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/g;
  const months = 'January February March April May June July August September October November December'.split(' ');
  const out = new Set();
  for (const [, mo, d, y] of txt.matchAll(re)) {
    const iso = `${y}-${String(months.indexOf(mo) + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (new Date(iso + 'T23:59:00Z') < now) out.add(iso);
  }
  return [...out].sort();
}

// --- Scoring ----------------------------------------------------------------

const vote = (cond1, condM1) => (cond1 ? 1 : condM1 ? -1 : 0);

// Market regime (M2). Inputs may be null when a source is missing; missing parts vote 0.
export function regime(x) {
  const parts = [
    { k: 'VIX/VIX3M', v: x.vixRatio, vote: x.vixRatio == null ? 0 : vote(x.vixRatio < 0.9, x.vixRatio > 1), why: x.vixRatio > 1 ? 'curva del VIX invertida: estrés a corto plazo' : x.vixRatio < 0.9 ? 'curva del VIX en contango sano' : 'curva del VIX plana' },
    { k: 'VIX', v: x.vix, vote: x.vix == null ? 0 : vote(x.vix < 15, x.vix > 25), why: x.vix > 25 ? 'volatilidad alta' : x.vix < 15 ? 'volatilidad baja' : 'volatilidad normal' },
    { k: 'Crédito HY', v: x.hyChg20, vote: x.hyChg20 == null ? 0 : vote(x.hyChg20 < -0.25, x.hyChg20 > 0.5), why: x.hyChg20 > 0.5 ? 'el diferencial high yield se amplía' : x.hyChg20 < -0.25 ? 'el diferencial high yield se estrecha' : 'crédito estable' },
    { k: 'S&P vs media 200', v: x.spxVs200, vote: x.spxVs200 == null ? 0 : vote(x.spxVs200 > 0, x.spxVs200 < 0), why: x.spxVs200 > 0 ? 'S&P 500 sobre su media de 200 sesiones' : 'S&P 500 bajo su media de 200 sesiones' },
    { k: 'MOVE', v: x.move, vote: x.move == null ? 0 : vote(x.move < 90, x.move > 120), why: x.move > 120 ? 'volatilidad de bonos alta' : x.move < 90 ? 'volatilidad de bonos baja' : 'volatilidad de bonos normal' },
    { k: 'Cobre/oro 20d', v: x.cuAuChg20, vote: x.cuAuChg20 == null ? 0 : vote(x.cuAuChg20 > 2, x.cuAuChg20 < -2), why: x.cuAuChg20 > 2 ? 'el cobre gana al oro: apetito cíclico' : x.cuAuChg20 < -2 ? 'el oro gana al cobre: defensa' : 'cobre/oro sin dirección' },
  ];
  const score = parts.reduce((s, p) => s + p.vote, 0);
  return { score, label: score >= 2 ? 'RISK-ON' : score <= -2 ? 'RISK-OFF' : 'NEUTRO', parts };
}

// Gold bias (M1): seven components voting -1/0/+1 for gold.
export function bias(x) {
  const c = [
    { k: 'Dólar', vote: x.dxy5 == null ? 0 : vote(x.dxy5 < -0.25, x.dxy5 > 0.25), why: x.dxy5 == null ? 'sin dato' : `DXY ${x.dxy5 >= 0 ? '+' : ''}${x.dxy5.toFixed(2)} % en 5 sesiones` },
    { k: 'Tipos reales', vote: x.ry5 == null ? 0 : vote(x.ry5 <= -0.05, x.ry5 >= 0.05), why: x.ry5 == null ? 'sin dato' : `tipo real 10 años ${x.ry5 >= 0 ? '+' : ''}${Math.round(x.ry5 * 100)} pb en 5 sesiones` },
    { k: 'Tendencia', vote: x.price == null ? 0 : vote(x.price > x.sma20 && x.price > x.sma50, x.price < x.sma20 && x.price < x.sma50), why: x.price > x.sma20 && x.price > x.sma50 ? 'precio sobre medias de 20 y 50' : x.price < x.sma20 && x.price < x.sma50 ? 'precio bajo medias de 20 y 50' : 'precio entre medias' },
    { k: 'Régimen', vote: x.regime == null ? 0 : vote(x.regime === 'RISK-OFF', x.regime === 'RISK-ON' && x.ry5 > 0), why: x.regime === 'RISK-OFF' ? 'risk-off: demanda de refugio' : x.regime === 'RISK-ON' && x.ry5 > 0 ? 'risk-on con tipos reales subiendo' : 'régimen sin efecto claro' },
    { k: 'Flujos ETF', vote: x.etf5 == null ? 0 : vote(x.etf5 > 1, x.etf5 < -1), why: x.etf5 == null ? 'sin dato' : `GLD ${x.etf5 >= 0 ? '+' : ''}${x.etf5.toFixed(1)} t en 5 sesiones` },
    { k: 'Posicionamiento', vote: x.cot == null ? 0 : vote(x.cot < 20, x.cot > 80), why: x.cot == null ? 'sin dato' : `COT Index 3 años ${Math.round(x.cot)}${x.cot > 80 ? ': saturado' : x.cot < 20 ? ': poco cargado' : ''}` },
    { k: 'Sorpresa macro', vote: x.surprise == null ? 0 : vote(x.surprise < -0.3, x.surprise > 0.3), why: x.surprise == null ? 'aún sin datos suficientes' : `índice de sorpresas EE. UU. ${x.surprise >= 0 ? '+' : ''}${x.surprise.toFixed(2)}` },
  ];
  const score = c.reduce((s, p) => s + p.vote, 0);
  return { score, label: score >= 3 ? 'COMPRADOR' : score <= -3 ? 'VENDEDOR' : 'NEUTRO', components: c };
}

// "2026-10-14" + "08:30" in America/New_York -> epoch seconds (DST-correct via Intl).
const zoneFmt = new Map(); // Intl formatters are slow to build; one per time zone (Worker CPU limit)
export function zonedToUtc(dateIso, hhmm, tz = 'America/New_York') {
  if (!zoneFmt.has(tz)) zoneFmt.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
  const [y, m, d] = dateIso.split('-').map(Number), [H, M] = hhmm.split(':').map(Number);
  let t = Date.UTC(y, m - 1, d, H, M);
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(zoneFmt.get(tz).formatToParts(t).map((x) => [x.type, x.value]));
    t += Date.UTC(y, m - 1, d, H, M) - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return t / 1000;
}

// Gold move around a release from bars {t,o,h,l,c} of `step` seconds: from the last close before T
// to the first close at least `after` seconds later, and to the last close of that New York day.
export function eventMoves(bars, T, step) {
  const before = bars.filter((b) => b.t + step <= T).at(-1);
  if (!before || T - (before.t + step) > 3 * step) return null;
  const at = (s) => bars.find((b) => b.t + step >= T + s);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(T * 1000);
  const sameDay = bars.filter((b) => b.t >= T && new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(b.t * 1000) === day).at(-1);
  const p0 = before.c;
  const r = (b) => (b ? pct(p0, b.c) : null);
  return { r15: step <= 900 ? r(at(900)) : null, r60: r(at(3600)), rday: r(sameDay) };
}
