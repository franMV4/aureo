// Gold factor balance: six factors scored -2..+2 for the next weeks. Same code runs live and in the backtest.
// Inputs only use data known on day d. COT a la contra, valor macro y estacionalidad se quitaron (2026-10-14):
// perdían frente a la base dentro y fuera de muestra.
import { pct, mean } from './analytics.js';
import { ema, rsi } from './quant.js';

// Index of the last row with r.d <= d (rows sorted by d), -1 if none.
export function upto(rows, d) {
  let lo = 0, hi = rows.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (rows[m].d <= d) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
const back = (rows, i, k) => (i - k >= 0 ? rows[i - k].v : null);
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// S = { gc, dxy, ry, vix, vix3m, gld } — arrays of {d, v}, oldest first.
export function factorInputs(S, d) {
  const i = upto(S.gc, d);
  if (i < 210) return null;
  const closes = S.gc.slice(Math.max(0, i - 400), i + 1).map((r) => r.v);
  const price = closes.at(-1);
  const [e20, e50, e200] = [20, 50, 200].map((n) => ema(closes, n).at(-1));

  const at = (rows, k = 0) => { const j = upto(rows, d); return j < 0 || (k === 0 && rows[j].d < addDays(d, -7)) ? null : back(rows, j, k); };
  const chg = (rows, k) => { const a = at(rows), b = at(rows, k); return a != null && b != null ? pct(b, a) : null; };
  const dif = (rows, k) => { const a = at(rows), b = at(rows, k); return a != null && b != null ? a - b : null; };

  const vix = at(S.vix), vix3m = at(S.vix3m);
  return {
    price, e20, e50, e200,
    rsi: rsi(closes.slice(-120)), roc20: pct(closes.at(-21), price),
    dxy5: chg(S.dxy, 5), ry5: dif(S.ry, 5) == null ? null : dif(S.ry, 5) * 100,
    vix, vixRatio: vix && vix3m ? vix / vix3m : null, vix5: chg(S.vix, 5),
    etf5: dif(S.gld, 5),
  };
}

const clamp = (v) => Math.max(-2, Math.min(2, v));
const f1 = (v, d = 1) => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d).replace('.', ',')}`);
const steps = (v, [a, b]) => (v == null ? null : v >= b ? 2 : v >= a ? 1 : v <= -b ? -2 : v <= -a ? -1 : 0);

export const FACTORS = [
  ['trend', 'Tendencia', 'Precio frente a sus medias exponenciales de 20, 50 y 200 sesiones.'],
  ['momentum', 'Momentum', 'RSI de 14 sesiones y variación de las últimas 20.'],
  ['dollar', 'Dólar', 'Variación del DXY en 5 sesiones. Un dólar que baja empuja al oro.'],
  ['rates', 'Tipos reales', 'Variación del bono ligado a la inflación a 10 años (TIPS) en 5 sesiones.'],
  ['risk', 'Riesgo', 'Curva del VIX (VIX/VIX3M) y su salto en 5 sesiones. El estrés atrae refugio.'],
  ['etf', 'Flujo ETF', 'Toneladas que entran o salen del ETF GLD en 5 sesiones.'],
];

export function scoreFactors(x) {
  const out = {
    trend: x.e200 == null || isNaN(x.e200) ? null : (() => {
      const pts = [x.price > x.e20, x.price > x.e50, x.price > x.e200, x.e20 > x.e50].reduce((s, b) => s + (b ? 1 : -1), 0);
      return { score: clamp(Math.round(pts / 2)), why: `precio ${x.price > x.e200 ? 'sobre' : 'bajo'} la EMA 200, EMA 20 ${x.e20 > x.e50 ? 'sobre' : 'bajo'} la 50` };
    })(),
    momentum: isNaN(x.rsi) ? null : { score: (x.rsi > 60 ? 1 : x.rsi < 40 ? -1 : 0) + (x.roc20 > 3 ? 1 : x.roc20 < -3 ? -1 : 0), why: `RSI ${Math.round(x.rsi)}, ${f1(x.roc20)} % en 20 sesiones` },
    dollar: x.dxy5 == null ? null : { score: -steps(x.dxy5, [0.3, 0.8]), why: `DXY ${f1(x.dxy5, 2)} % en 5 sesiones` },
    rates: x.ry5 == null ? null : { score: -steps(x.ry5, [5, 12]), why: `TIPS 10 años ${f1(x.ry5, 0)} pb en 5 sesiones` },
    risk: x.vixRatio == null ? null : {
      score: clamp((x.vixRatio > 1 ? 1 : 0) + (x.vix5 > 20 ? 1 : 0) - (x.vixRatio < 0.85 && x.vix < 15 ? 1 : 0)),
      why: `VIX ${x.vix.toFixed(1).replace('.', ',')}, curva ${x.vixRatio > 1 ? 'invertida' : 'en contango'} (${x.vixRatio.toFixed(2).replace('.', ',')})`,
    },
    etf: x.etf5 == null ? null : { score: steps(x.etf5, [1.5, 5]), why: `GLD ${f1(x.etf5)} t en 5 sesiones` },
  };
  const list = FACTORS.map(([k, label, what]) => ({ k, label, what, ...(out[k] ?? { score: 0, why: 'sin dato', missing: true }) }));
  return { list, total: list.reduce((s, f) => s + f.score, 0), max: list.length * 2 };
}

// Hit rate of a signed score against forward returns: when score > 0 the gold should rise, < 0 fall.
// r1/r5 use every day; r20 uses one day in twenty (rows carry i, their position) so no two 20-day windows overlap.
export function hitStats(rows, key) {
  const act = rows.filter((r) => r.s[key] !== 0 && r.r1 != null);
  if (!act.length) return null;
  const share = (a, k) => a.filter((r) => r[k] > 0).length / a.length;
  const one = (a, all, k) => {
    if (!a.length) return { hit: null, base: null, edge: null };
    const pos = a.filter((r) => r.s[key] > 0).length / a.length, u = share(all, k);
    const hit = a.filter((r) => Math.sign(r[k]) === Math.sign(r.s[key])).length / a.length, base = pos * u + (1 - pos) * (1 - u);
    return { hit: hit * 100, base: base * 100, edge: (hit - base) * 100 };
  };
  const h1 = one(act, rows, 'r1'), h5 = one(act, rows, 'r5');
  const all20 = rows.filter((r) => r.r20 != null && r.i % 20 === 0), h20 = one(all20.filter((r) => r.s[key] !== 0), all20, 'r20');
  return {
    n: act.length, active: act.length / rows.length, n20: all20.filter((r) => r.s[key] !== 0).length,
    hit1: h1.hit, base1: h1.base, edge1: h1.edge, hit5: h5.hit, base5: h5.base, edge5: h5.edge, hit20: h20.hit, base20: h20.base, edge20: h20.edge,
    avg5: mean(act.map((r) => r.r5 * Math.sign(r.s[key]))),
  };
}

// Verdict: a factor (or the total) counts as a signal only if it beats the base in and out of sample.
// Macro factors act over weeks, so a 20-session edge of 5 points in both periods also counts.
export const isSignal = (is, oos) => !!(is && oos && ((oos.n >= 150 && is.edge1 >= 1 && oos.edge1 >= 2 && oos.edge5 >= 1) || (oos.n20 >= 30 && is.edge20 >= 5 && oos.edge20 >= 5)));
