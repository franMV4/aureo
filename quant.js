// Pure quant toolkit: indicators, volatility models (GARCH, GJR, HMM), risk and projections. No I/O.
import { mean, std, sma } from './analytics.js';

export const logRets = (closes) => closes.slice(1).map((c, i) => Math.log(c / closes[i]));

// Full EMA series (NaN until there are n values).
export function ema(values, n) {
  const out = new Array(values.length).fill(NaN);
  if (values.length < n) return out;
  const k = 2 / (n + 1);
  let e = mean(values.slice(0, n));
  out[n - 1] = e;
  for (let i = n; i < values.length; i++) out[i] = e = values[i] * k + e * (1 - k);
  return out;
}

// Wilder RSI, last value.
export function rsi(closes, n = 14) {
  if (closes.length <= n) return NaN;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}

// Wilder ADX on {h,l,c} bars, last value.
export function adx(bars, n = 14) {
  if (bars.length < 2 * n + 1) return NaN;
  let trS = 0, pS = 0, mS = 0;
  const dx = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i], p = bars[i - 1];
    const up = b.h - p.h, dn = p.l - b.l;
    const pdm = up > dn && up > 0 ? up : 0, mdm = dn > up && dn > 0 ? dn : 0;
    const tr = Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
    if (i <= n) { trS += tr; pS += pdm; mS += mdm; if (i < n) continue; }
    else { trS += tr - trS / n; pS += pdm - pS / n; mS += mdm - mS / n; }
    const pdi = (100 * pS) / trS, mdi = (100 * mS) / trS;
    dx.push(pdi + mdi ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0);
  }
  let a = mean(dx.slice(0, n));
  for (let i = n; i < dx.length; i++) a = (a * (n - 1) + dx[i]) / n;
  return a;
}

export function bollinger(closes, n = 20, k = 2) {
  const w = closes.slice(-n), m = mean(w), s = std(w);
  return { mid: m, up: m + k * s, low: m - k * s, pctB: s ? (closes.at(-1) - (m - k * s)) / (2 * k * s) : NaN };
}

// Normal CDF (Abramowitz-Stegun 26.2.17, error < 7.5e-8).
export function phi(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

// Probability that a driftless random walk with stdev `sigma` over the horizon touches a level `dist` away (reflection principle).
export const touchProb = (dist, sigma) => (sigma > 0 ? Math.min(1, 2 * (1 - phi(Math.abs(dist) / sigma))) : 0);

// ---------- optimisation ----------
// ponytail: plain Nelder-Mead, enough for 2-3 parameter likelihoods
function nelderMead(f, x0, step = 0.1, iters = 400) {
  const n = x0.length;
  let s = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + step : v)))].map((x) => ({ x, f: f(x) }));
  for (let it = 0; it < iters; it++) {
    s.sort((a, b) => a.f - b.f);
    const c = x0.map((_, j) => mean(s.slice(0, n).map((p) => p.x[j])));
    const w = s[n];
    const at = (t) => { const x = c.map((v, j) => v + t * (w.x[j] - v)); return { x, f: f(x) }; };
    const r = at(-1);
    if (r.f < s[0].f) { const e = at(-2); s[n] = e.f < r.f ? e : r; }
    else if (r.f < s[n - 1].f) s[n] = r;
    else { const k = at(0.5); if (k.f < w.f) s[n] = k; else s = s.map((p, i) => (i ? (() => { const x = p.x.map((v, j) => s[0].x[j] + 0.5 * (v - s[0].x[j])); return { x, f: f(x) }; })() : p)); }
  }
  return s.sort((a, b) => a.f - b.f)[0];
}
const sig = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));

// ---------- GARCH(1,1) and GJR-GARCH(1,1), Gaussian, variance targeting ----------
// r = daily returns in %. Returns parameters, the conditional vol path and the next-day forecast.
export function garch(r, { gjr = false } = {}) {
  const m = mean(r), e = r.map((x) => x - m), v = mean(e.map((x) => x * x));
  // gamma in (-a, 0.4): positive = falls raise vol more (equities), negative = rises do (often gold)
  const unpack = (p) => {
    const a = 0.3 * sig(p[0]), b = sig(p[1]), g = gjr ? -a + (a + 0.4) * sig(p[2]) : 0;
    return { a, b, g, pers: a + b + g / 2 };
  };
  const path = ({ a, b, g, pers }) => {
    const w = v * (1 - pers), s2 = new Array(e.length + 1);
    s2[0] = v;
    for (let t = 0; t < e.length; t++) s2[t + 1] = w + (a + (e[t] < 0 ? g : 0)) * e[t] * e[t] + b * s2[t];
    return s2;
  };
  const nll = (p) => {
    const q = unpack(p);
    if (q.pers >= 0.999) return 1e12;
    const s2 = path(q);
    let L = 0;
    for (let t = 0; t < e.length; t++) L += Math.log(s2[t]) + (e[t] * e[t]) / s2[t];
    return 0.5 * L;
  };
  const best = nelderMead(nll, gjr ? [logit(0.05 / 0.3), logit(0.9), logit(0.05 / 0.45)] : [logit(0.05 / 0.3), logit(0.9)], 0.5);
  const q = unpack(best.x), s2 = path(q);
  return { ...q, omega: v * (1 - q.pers), longRun: Math.sqrt(v), mean: m, nll: best.f, vol: s2.slice(1).map(Math.sqrt), next: Math.sqrt(s2.at(-1)), halfLife: Math.log(0.5) / Math.log(q.pers) };
}

// Variance term structure: sigma (in %) of the cumulative return over 1..h days.
export function garchHorizon(g, h) {
  const out = [];
  let cum = 0;
  for (let k = 1; k <= h; k++) {
    cum += g.longRun ** 2 + g.pers ** (k - 1) * (g.next ** 2 - g.longRun ** 2);
    out.push(Math.sqrt(cum));
  }
  return out;
}

// ---------- Gaussian HMM (Baum-Welch with scaling) ----------
export function hmm(r, K = 3, iters = 40) {
  const T = r.length, s0 = std(r);
  let mu = Array(K).fill(mean(r)), sd = [0.6, 1, 1.8].slice(0, K).map((f) => f * s0);
  let A = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => (i === j ? 0.95 : 0.05 / (K - 1))));
  let pi = Array(K).fill(1 / K);
  const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * 2.5066283);
  let alpha, ll = 0;
  for (let it = 0; it < iters; it++) {
    const B = r.map((x) => mu.map((m, j) => pdf(x, m, sd[j]) + 1e-300));
    alpha = []; const c = []; ll = 0;
    for (let t = 0; t < T; t++) {
      const a = mu.map((_, j) => (t ? alpha[t - 1].reduce((s, p, i) => s + p * A[i][j], 0) : pi[j]) * B[t][j]);
      c[t] = a.reduce((s, x) => s + x, 0);
      alpha.push(a.map((x) => x / c[t]));
      ll += Math.log(c[t]);
    }
    const beta = Array(T);
    beta[T - 1] = Array(K).fill(1);
    for (let t = T - 2; t >= 0; t--) beta[t] = mu.map((_, i) => A[i].reduce((s, a, j) => s + a * B[t + 1][j] * beta[t + 1][j], 0) / c[t + 1]);
    const gamma = alpha.map((a, t) => { const g = a.map((x, i) => x * beta[t][i]); const z = g.reduce((s, x) => s + x, 0); return g.map((x) => x / z); });
    const xi = Array.from({ length: K }, () => Array(K).fill(0));
    for (let t = 0; t < T - 1; t++) for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) xi[i][j] += (alpha[t][i] * A[i][j] * B[t + 1][j] * beta[t + 1][j]) / c[t + 1];
    pi = gamma[0];
    A = xi.map((row) => { const z = row.reduce((s, x) => s + x, 0); return row.map((x) => x / z); });
    for (let j = 0; j < K; j++) {
      const w = gamma.reduce((s, g) => s + g[j], 0);
      mu[j] = gamma.reduce((s, g, t) => s + g[j] * r[t], 0) / w;
      sd[j] = Math.max(1e-3, Math.sqrt(gamma.reduce((s, g, t) => s + g[j] * (r[t] - mu[j]) ** 2, 0) / w));
    }
  }
  const order = sd.map((s, i) => i).sort((a, b) => sd[a] - sd[b]);
  const now = alpha.at(-1);
  return {
    ll,
    states: order.map((i) => ({ mu: mu[i], sd: sd[i], p: now[i], stay: A[i][i], days: 1 / (1 - A[i][i]) })),
    A: order.map((i) => order.map((j) => A[i][j])),
    path: alpha.map((a) => order.indexOf(a.indexOf(Math.max(...a)))),
    current: order.indexOf(now.indexOf(Math.max(...now))),
  };
}

// ---------- risk ----------
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
export { quantile };

export function riskStats(r) {
  const neg = r.filter((x) => x < 0);
  const v95 = -quantile(r, 0.05), v99 = -quantile(r, 0.01);
  const es = (v) => -mean(r.filter((x) => x <= -v));
  const m = mean(r), s = std(r), dd = Math.sqrt(mean(neg.map((x) => x * x)));
  const n = r.length, sk = mean(r.map((x) => ((x - m) / s) ** 3)), ku = mean(r.map((x) => ((x - m) / s) ** 4)) - 3;
  return { n, mean: m, sd: s, var95: v95, var99: v99, es95: es(v95), es99: es(v99), sharpe: (m / s) * Math.sqrt(252), sortino: (m / dd) * Math.sqrt(252), skew: sk, kurt: ku };
}

export function drawdowns(closes) {
  let peak = -Infinity, max = 0;
  const series = closes.map((c) => { peak = Math.max(peak, c); const d = (c / peak - 1) * 100; max = Math.min(max, d); return d; });
  return { series, max, current: series.at(-1) };
}

export function histogram(r, bins = 31) {
  const lo = quantile(r, 0.005), hi = quantile(r, 0.995), w = (hi - lo) / bins, m = mean(r), s = std(r);
  const out = Array.from({ length: bins }, (_, i) => ({ x: lo + (i + 0.5) * w, n: 0, normal: r.length * (phi((lo + (i + 1) * w - m) / s) - phi((lo + i * w - m) / s)) }));
  for (const x of r) out[Math.min(bins - 1, Math.max(0, Math.floor((x - lo) / w)))].n++;
  return out;
}

// One-step AR(1) on returns vs a zero forecast (random walk), fit on the first 70 %, scored on the rest.
export function ar1Test(r) {
  const cut = Math.floor(r.length * 0.7), a = r.slice(0, cut);
  const m = mean(a);
  let num = 0, den = 0;
  for (let i = 1; i < a.length; i++) { num += (a[i] - m) * (a[i - 1] - m); den += (a[i - 1] - m) ** 2; }
  const phi1 = num / den;
  let ar = 0, rw = 0, n = 0;
  for (let i = cut; i < r.length; i++) { ar += (r[i] - (m + phi1 * (r[i - 1] - m))) ** 2; rw += r[i] ** 2; n++; }
  return { phi: phi1, mseAR: ar / n, mseRW: rw / n, beats: ar < rw * 0.99 };
}

// Price fan from a vol term structure (sigma in % per horizon): lognormal percentiles.
export function fan(price, sigmas) {
  const z = { p5: -1.645, p25: -0.674, p50: 0, p75: 0.674, p95: 1.645 };
  return sigmas.map((s, i) => Object.fromEntries([['h', i + 1], ...Object.entries(z).map(([k, q]) => [k, price * Math.exp((q * s) / 100)])]));
}

// GARCH sigma (%) of the h-day move starting after bar t of the returns `g` was fitted on.
export const garchSigmaAt = (g) => { const L2 = g.longRun ** 2; return (t, h) => Math.sqrt(h * L2 + ((g.vol[t] ** 2 - L2) * (1 - g.pers ** h)) / (1 - g.pers)); };

// Track record of a fan: share of real h-day moves over the newest 30 % of `r` that ended inside the 90 % and 50 %
// bands, each built with the sigma known on its start day. sigmaAt(t, h) -> sigma in %, or null to skip that day.
// ponytail: GARCH parameters come from the whole sample; refit on the oldest 70 % if this ever drives decisions
export function fanCheck(r, sigmaAt, hs = [1, 5, 20]) {
  const lr = r.map((x) => Math.log(1 + x / 100) * 100);
  return hs.map((h) => {
    let n = 0, in90 = 0, in50 = 0;
    for (let t = Math.floor(lr.length * 0.7); t + h < lr.length; t++) {
      const s = sigmaAt(t, h);
      if (!(s > 0)) continue;
      let cum = 0;
      for (let k = 1; k <= h; k++) cum += lr[t + k];
      const z = Math.abs(cum / s);
      n++; in90 += z <= 1.645; in50 += z <= 0.674;
    }
    return { h, n, in90: n ? (in90 / n) * 100 : null, in50: n ? (in50 / n) * 100 : null };
  });
}

export { sma };
