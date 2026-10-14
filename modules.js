// The 15 analysis modules. Each returns { data, reading } built from D1 (+ a few live calls).
// Readings are rule-based plain Spanish sentences; thresholds live here so Analysis can tune them in one place.
import { YAHOO, RELEASES, FOMC } from './config.js';
import * as A from './analytics.js';
import { series, kvGet, daysAgo } from './store.js';
import { yahoo, COT_MARKETS } from './sources.js';

const sgn = (v, d = 2, suf = '') => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d).replace('.', ',')}${suf}`);
const num = (v, d = 2) => (v == null || !isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
const vals = (rows) => rows.map((r) => r.v);
const chg = (rows, n) => (rows.length > n ? A.pct(rows.at(-1 - n).v, rows.at(-1).v) : null);
const diffN = (rows, n) => (rows.length > n ? rows.at(-1).v - rows.at(-1 - n).v : null);
const ytd = (rows) => { const y = new Date().getUTCFullYear(); const p = rows.filter((r) => +r.d.slice(0, 4) < y).at(-1); return p ? A.pct(p.v, rows.at(-1).v) : null; };
const at = (rows, d) => rows.filter((r) => r.d <= d).at(-1)?.v ?? null;
const S = (db, k, days) => series(db, `y:${k}`, daysAgo(days));
const F = (db, k, days) => series(db, `f:${k}`, daysAgo(days));
const quote = (rows, extra = {}) => rows.length ? { price: rows.at(-1).v, d: rows.at(-1).d, d1: chg(rows, 1), w1: chg(rows, 5), m1: chg(rows, 21), ytd: ytd(rows), spark: vals(rows.slice(-30)), ...extra } : { error: 'sin datos' };

// M2 — market regime
async function m2(db) {
  const [vix, vix3m, vix9d, move, hy, spx, hg, gc] = await Promise.all([S(db, '^VIX', 400), S(db, '^VIX3M', 400), S(db, '^VIX9D', 60), S(db, '^MOVE', 60), F(db, 'BAMLH0A0HYM2', 120), S(db, '^GSPC', 400), S(db, 'HG=F', 400), S(db, 'GC=F', 400)]);
  const ratio = A.align(vix, vix3m).map((r) => ({ d: r.d, v: r.v[0] / r.v[1] }));
  const cuau = A.align(hg, gc).map((r) => ({ d: r.d, v: (r.v[0] / r.v[1]) * 1000 }));
  const x = {
    vixRatio: ratio.at(-1)?.v ?? null, vix: vix.at(-1)?.v ?? null, hyChg20: diffN(hy, 20), move: move.at(-1)?.v ?? null, cuAuChg20: chg(cuau, 20),
    spxVs200: spx.length >= 200 ? A.pct(A.sma(vals(spx), 200), spx.at(-1).v) : null,
  };
  const r = A.regime(x);
  const why = r.parts.filter((p) => p.vote !== 0).sort((a, b) => Math.abs(b.vote) - Math.abs(a.vote)).map((p) => p.why).slice(0, 3);
  return {
    data: { ...r, ...x, vix9d: vix9d.at(-1)?.v ?? null, vix3m: vix3m.at(-1)?.v ?? null, hy: hy.at(-1)?.v ?? null, ratioSeries: ratio.slice(-250), cuauSeries: cuau.slice(-250) },
    reading: `${r.label} (${sgn(r.score, 0)}): ${why.join('; ') || 'sin señales claras'}.`,
  };
}

// M3 — gold in detail: levels, expected range, sessions, gold in other currencies
async function m3(db) {
  const [gc, si, gvz, eur, jpy, cnh] = await Promise.all([S(db, 'GC=F', 400), S(db, 'SI=F', 400), S(db, '^GVZ', 10), S(db, 'EURUSD=X', 10), S(db, 'JPY=X', 10), S(db, 'CNY=X', 10)]);
  if (gc.length < 20) return { data: null, reading: 'Sin histórico suficiente del oro.' };
  const last = gc.at(-1), prev = gc.at(-2);
  const monday = (() => { const d = new Date(last.d + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const weekOpen = gc.find((r) => r.d >= monday)?.o ?? null;
  const monthOpen = gc.find((r) => r.d.slice(0, 7) === last.d.slice(0, 7))?.o ?? null;
  const weekRows = gc.filter((r) => r.d >= monday && r.d < last.d);
  const atr14 = A.atr(gc.slice(-30).map((r) => ({ h: r.h, l: r.l, c: r.v })), 14);
  const vol = gvz.at(-1)?.v ?? null;
  const expected = vol ? A.expectedRange(last.v, vol) : null;
  const range = last.h != null ? last.h - last.l : null;
  const consumed = expected && range != null ? (range / (2 * expected)) * 100 : null;

  // sessions of the current CME day (starts 22:00 UTC the evening before)
  const now = Date.now() / 1000;
  const start = Math.floor((now - 22 * 3600) / 86400) * 86400 + 22 * 3600;
  const bars = (await db.prepare('SELECT t, o, h, l, c FROM bars WHERE sym = ? AND t >= ? ORDER BY t').bind('GC=F', start).all()).results;
  const sess = [['ASIA', 0, 9], ['LONDRES', 9, 15.5], ['NUEVA YORK', 15.5, 23]].map(([k, a, b]) => {
    const bs = bars.filter((x) => x.t >= start + a * 3600 && x.t < start + b * 3600);
    return { k, from: start + a * 3600, to: start + b * 3600, high: bs.length ? Math.max(...bs.map((x) => x.h)) : null, low: bs.length ? Math.min(...bs.map((x) => x.l)) : null };
  });

  const g = chg(gc, 1);
  const fx = { EUR: chg(eur, 1), JPY: chg(jpy, 1), CNY: chg(cnh, 1) };
  const inCur = {
    USD: g,
    EUR: g != null && fx.EUR != null ? ((1 + g / 100) / (1 + fx.EUR / 100) - 1) * 100 : null,
    JPY: g != null && fx.JPY != null ? ((1 + g / 100) * (1 + fx.JPY / 100) - 1) * 100 : null,
    CNY: g != null && fx.CNY != null ? ((1 + g / 100) * (1 + fx.CNY / 100) - 1) * 100 : null,
  };
  const signs = Object.values(inCur).filter((v) => v != null).map(Math.sign);
  const own = signs.every((s) => s > 0) ? 'El oro sube en las cuatro divisas: es fuerza del propio oro.' : signs.every((s) => s < 0) ? 'El oro baja en las cuatro divisas: es debilidad del propio oro.' : 'El oro no se mueve igual en todas las divisas: lo está moviendo el dólar.';
  const levels = [
    { k: 'Máx. ayer', v: prev.h }, { k: 'Mín. ayer', v: prev.l }, { k: 'Cierre ayer', v: prev.v },
    { k: 'Apertura semanal', v: weekOpen }, { k: 'Apertura mensual', v: monthOpen },
    { k: 'Máx. semana', v: weekRows.length ? Math.max(...weekRows.map((r) => r.h)) : null }, { k: 'Mín. semana', v: weekRows.length ? Math.min(...weekRows.map((r) => r.l)) : null },
  ].filter((l) => l.v != null);
  return {
    data: { own, price: last.v, d: last.d, d1: g, high: last.h, low: last.l, atr14, gvz: vol, expected, consumed, sessions: sess, inCur, goldSilver: si.length ? last.v / si.at(-1).v : null, gsr: (() => { const r = A.align(gc, si).slice(-252).map((x) => x.v[0] / x.v[1]); return r.length ? { min: Math.min(...r), max: Math.max(...r), pct: (r.filter((v) => v <= r.at(-1)).length / r.length) * 100 } : null; })(), levels },
    reading: `${expected ? `Movimiento esperado hoy ±${num(expected, 0)} $ (GVZ ${num(vol, 1)}); rango de hoy ${num(range, 0)} $, ${num(consumed, 0)} % del rango esperado. ` : ''}${own}`,
  };
}

// M4 — gold drivers: how much gold moves per +10 bp of real yield and per +1 % of the dollar (daily returns,
// rolling 60-session regressions). Replaced a fair-value regression on price levels: with trending series its R²
// was inflated and the relation with real yields broke in 2022.
async function m4(db) {
  const [gc, ry, dxy, be] = await Promise.all([S(db, 'GC=F', 1100), F(db, 'DFII10', 1100), S(db, 'DX-Y.NYB', 1100), F(db, 'T10YIE', 60)]);
  const rows = A.align(gc, ry, dxy).map((r) => ({ d: r.d, gold: r.v[0], ry: r.v[1], dxy: r.v[2] }));
  if (rows.length < 300) return { data: null, reading: 'Sin histórico suficiente para el modelo.' };
  const gRet = A.changes(rows.map((r) => r.gold)), dRet = A.changes(rows.map((r) => r.dxy)), yDif = A.diffs(rows.map((r) => r.ry)).map((v) => v * 100);
  const c = (a, b, n, off = 0) => A.corr(a.slice(-n - off, off ? -off : undefined), b.slice(-n - off, off ? -off : undefined));
  const corr = { dxy20: c(gRet, dRet, 20), dxy60: c(gRet, dRet, 60), ry20: c(gRet, yDif, 20), ry60: c(gRet, yDif, 60), ry60prev: c(gRet, yDif, 60, 20) };
  const beta = (end, n = 60) => { const f = A.ols2(gRet.slice(end - n, end), yDif.slice(end - n, end), dRet.slice(end - n, end)); return { ry10: f.b * 10, dxy: f.c, r2: f.r2 }; };
  const N = gRet.length, now = beta(N), prev = beta(N - 60), year = beta(N, 250);
  const series = [];
  for (let e = Math.max(60, N - 500); e <= N; e += 5) series.push({ d: rows[e].d, ...beta(e) });
  const ry5 = diffN(ry, 5);
  const broken = now.ry10 > 0 ? ' Ahora el oro sube cuando suben los tipos reales: la relación clásica está rota.' : '';
  return {
    data: { ry: ry.at(-1)?.v, ry5, be: be.at(-1)?.v, dxy: dxy.at(-1)?.v, dxy5: chg(dxy, 5), betas: { now, prev, year }, corr, betaSeries: series },
    reading: `Tipo real 10 años ${num(ry.at(-1)?.v)} % (${sgn(ry5 * 100, 0, ' pb')} en 5 días). El oro se mueve ${sgn(now.ry10, 2, ' %')} por cada +10 pb de tipo real (hace 3 meses ${sgn(prev.ry10, 2, ' %')}) y ${sgn(now.dxy, 2, ' %')} por cada +1 % del dólar.${broken}`,
  };
}

// M5 — physical flows (GLD tonnes)
const UNAVAILABLE = [
  'Inventarios COMEX: CME bloquea la descarga automática.',
  'Compras de bancos centrales: el World Gold Council exige registro.',
  'Prima de Shanghai: la SGE no publica los datos en abierto.',
  'iShares IAU: no ofrece archivo descargable.',
];
async function m5(db) {
  const t = await series(db, 'gld:tonnes', daysAgo(400));
  if (!t.length) return { data: { unavailable: UNAVAILABLE }, reading: 'Sin datos del ETF GLD.' };
  const d1 = diffN(t, 1), d5 = diffN(t, 5), d20 = diffN(t, 20);
  let outStreak = 0;
  for (let i = t.length - 1; i > 0 && t[i].v < t[i - 1].v; i--) outStreak++;
  return {
    data: { tonnes: t.at(-1).v, d: t.at(-1).d, d1, d5, d20, outStreak, series: t.slice(-250), unavailable: UNAVAILABLE },
    reading: `GLD guarda ${num(t.at(-1).v, 1)} t: ${sgn(d5, 1, ' t')} en 5 sesiones y ${sgn(d20, 1, ' t')} en 20.${outStreak >= 5 ? ` Lleva ${outStreak} sesiones seguidas de salidas: demanda occidental débil.` : d5 > 1 ? ' Entradas netas: demanda de inversión al alza.' : ''}`,
  };
}

// M6 — rates, liquidity and Fed path
const MONTH_CODE = 'FGHJKMNQUVXZ';
async function fedFutures(months) {
  const out = {};
  await Promise.all(months.map(async (ym) => {
    const [y, m] = ym.split('-').map(Number);
    try { out[ym] = (await yahoo(`ZQ${MONTH_CODE[m - 1]}${String(y).slice(2)}.CBT`, '5d', '1d')).meta.regularMarketPrice; } catch { /* contract not listed */ }
  }));
  return out;
}
async function m6(db) {
  const keys = ['DGS3MO', 'DGS2', 'DGS10', 'DGS30', 'T10Y2Y', 'T10Y3M', 'DFII10', 'T10YIE', 'THREEFYTP10', 'SOFR', 'DFF', 'WALCL', 'WTREGEN', 'RRPONTSYD'];
  const s = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await F(db, k, 800)])));
  const lastV = (k) => s[k].at(-1)?.v ?? null;
  const ago = (k, days) => at(s[k], daysAgo(days));
  const curve = ['DGS3MO', 'DGS2', 'DGS10', 'DGS30'].map((k, i) => ({ k: ['3 m', '2 a', '10 a', '30 a'][i], now: lastV(k), m1: ago(k, 30), y1: ago(k, 365) }));
  const liq = s.WALCL.map((w) => { const tga = at(s.WTREGEN, w.d), rrp = at(s.RRPONTSYD, w.d); return tga == null || rrp == null ? null : { d: w.d, v: (w.v - tga - rrp * 1000) / 1e6 }; }).filter(Boolean);
  const liq4 = liq.length > 4 ? liq.at(-1).v - liq.at(-5).v : null, liq13 = liq.length > 13 ? liq.at(-1).v - liq.at(-14).v : null;
  const upcoming = FOMC.filter((d) => new Date(d + 'T18:00:00Z') > new Date()).slice(0, 4);
  const months = upcoming.map((d) => { const x = new Date(d + 'T00:00:00Z'); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1)).toISOString().slice(0, 7); });
  const path = A.fedPath(lastV('DFF'), upcoming, await fedFutures(months));
  const curveTxt = lastV('T10Y2Y') < 0 ? 'invertida' : 'positiva';
  const next = path[0];
  return {
    data: { curve, s2s10: lastV('T10Y2Y'), s3m10: lastV('T10Y3M'), real: lastV('DFII10'), be: lastV('T10YIE'), tp: lastV('THREEFYTP10'), sofr: lastV('SOFR'), effr: lastV('DFF'), liq: liq.slice(-104), liq4, liq13, path, spreadSeries: s.T10Y2Y.slice(-500), fomcNote: upcoming.length < 3 ? 'Faltan fechas del FOMC del año próximo en config.js' : null },
    reading: `Curva 2s10s ${sgn(lastV('T10Y2Y') * 100, 0, ' pb')}, ${curveTxt}.${next ? ` Próxima reunión ${next.meeting.slice(8, 10)}/${next.meeting.slice(5, 7)}: el mercado descuenta ${sgn(next.change * 100, 0, ' pb')} (${next.change < 0 ? `${Math.round(next.cutProb)} % de bajada` : `${Math.round(next.hikeProb)} % de subida`}).` : ''}`,
  };
}

// M7 — dollar and currency strength
async function m7(db) {
  const fx = YAHOO.filter((y) => y.g === 'fx');
  const rows = Object.fromEntries(await Promise.all(fx.map(async (y) => [y.s, await S(db, y.s, 60)])));
  const pairs = fx.map((y) => ({ s: y.s, label: y.label, ...quote(rows[y.s]) }));
  const horizon = (n) => A.strength(Object.fromEntries(fx.filter((y) => y.cur).map((y) => { const c = chg(rows[y.s], n); return [y.cur, y.inv ? -c : c]; }).filter(([, v]) => v != null)));
  const st = { d1: horizon(1), w1: horizon(5), m1: horizon(21) };
  const usdRank = st.w1.findIndex((x) => x.cur === 'USD') + 1;
  return {
    data: { pairs, strength: st },
    reading: `El dólar es la ${usdRank}ª divisa más fuerte de 8 en la semana: ${usdRank <= 2 ? 'viento en contra para el oro' : usdRank >= 7 ? 'viento a favor para el oro' : 'efecto neutro sobre el oro'}.`,
  };
}

// M8 — equities, sectors and breadth
async function m8(db) {
  const sec = YAHOO.filter((y) => y.g === 'sector' && y.kind);
  const [spy, rsp, ...rs] = await Promise.all([S(db, 'SPY', 60), S(db, 'RSP', 60), ...sec.map((y) => S(db, y.s, 60))]);
  const rel = (r, n) => (chg(r, n) ?? NaN) - (chg(spy, n) ?? NaN);
  const sectors = sec.map((y, i) => ({ s: y.s, label: y.label, kind: y.kind, d1: rel(rs[i], 1), w1: rel(rs[i], 5), m1: rel(rs[i], 21) })).sort((a, b) => b.m1 - a.m1);
  const avg = (k) => A.mean(sectors.filter((x) => x.kind === k).map((x) => x.m1));
  const defMinusCyc = avg('defensivo') - avg('ciclico');
  const breadth = { rsp20: chg(rsp, 20), spy20: chg(spy, 20) };
  const narrow = breadth.spy20 > 0 && breadth.rsp20 < breadth.spy20 - 1;
  return {
    data: { sectors, defMinusCyc, breadth },
    reading: `${defMinusCyc > 0 ? 'Los defensivos' : 'Los cíclicos'} lideran el último mes (${sgn(Math.abs(defMinusCyc), 1, ' pp')})${defMinusCyc > 0 ? ': aversión al riesgo' : ': apetito por riesgo'}. ${narrow ? 'Subida estrecha: el S&P igual ponderado se queda atrás.' : 'Amplitud sana: el S&P igual ponderado acompaña.'}`,
  };
}

// M9 — commodities
async function m9(db) {
  const cm = YAHOO.filter((y) => y.g === 'metal' || y.g === 'energy');
  const rows = await Promise.all(cm.map((y) => S(db, y.s, 400)));
  const list = cm.map((y, i) => ({ s: y.s, label: y.label, ...quote(rows[i]) }));
  const [hg, gc, tnx] = [rows[cm.findIndex((y) => y.s === 'HG=F')], rows[cm.findIndex((y) => y.s === 'GC=F')], await S(db, '^TNX', 400)];
  const cuau = A.align(hg, gc).map((r) => ({ d: r.d, v: (r.v[0] / r.v[1]) * 1000 }));
  const a = chg(cuau, 20), b = diffN(tnx, 20);
  const agree = a == null || b == null ? null : Math.sign(a) === Math.sign(b);
  return {
    data: { list, cuau: cuau.slice(-250), tnx: tnx.slice(-250) },
    reading: agree == null ? 'Sin datos de cobre/oro.' : agree ? `Cobre/oro (${sgn(a, 1, ' %')}) y bono a 10 años (${sgn(b * 100, 0, ' pb')}) van en la misma dirección en 20 días: coherentes.` : `Cobre/oro (${sgn(a, 1, ' %')}) y bono a 10 años (${sgn(b * 100, 0, ' pb')}) se separan en 20 días: uno de los dos se equivoca.`,
  };
}

// M10 — calendar extras: historical gold reaction by release, actuals and surprises
async function m10(db) {
  const hist = (await db.prepare('SELECT kind, t, r15, r60, rday, surprise, actual, forecast, title FROM events WHERE kind IS NOT NULL ORDER BY t').all()).results;
  const stats = {};
  for (const r of RELEASES) {
    const ev = hist.filter((e) => e.kind === r.kind && e.t < Date.now());
    // surprise > 0 = stronger economy than expected (weakIfUp releases come already flipped)
    const side = (f) => A.reactionStats(ev.filter((e) => e.surprise != null && f(e.surprise)).map((e) => e.r60));
    stats[r.kind] = { name: r.name, r15: A.reactionStats(ev.map((e) => e.r15)), r60: A.reactionStats(ev.map((e) => e.r60)), rday: A.reactionStats(ev.map((e) => e.rday)), better: side((x) => x > 0), worse: side((x) => x < 0) };
  }
  const recent = hist.filter((e) => e.surprise != null && e.t > Date.now() - 45 * 864e5);
  const surpriseIndex = recent.length ? A.mean(recent.map((e) => e.surprise)) : null;
  const matchers = RELEASES.map((r) => ({ kind: r.kind, re: r.match.source, flags: r.match.flags }));
  const actuals = hist.filter((e) => e.actual != null && e.t > Date.now() - 8 * 864e5).map((e) => ({ title: e.title, kind: e.kind, t: e.t, actual: e.actual, forecast: e.forecast, surprise: e.surprise }));
  const top = Object.entries(stats).filter(([, s]) => s.r60.n >= 8).sort((a, b) => b[1].r60.absMedian - a[1].r60.absMedian)[0];
  return {
    data: { stats, matchers, actuals, surpriseIndex, surprises: recent.slice(-10) },
    reading: `${top ? `El dato que más mueve al oro es ${top[1].name}: ±${num(top[1].r60.absMedian)} % típico (mediana) en la hora siguiente (${top[1].r60.n} publicaciones).` : 'Aún pocas publicaciones registradas.'} ${surpriseIndex == null ? 'Índice de sorpresas: se llena con cada dato publicado.' : `Índice de sorpresas EE. UU. ${sgn(surpriseIndex)}: los datos salen ${surpriseIndex > 0 ? 'mejor' : 'peor'} de lo esperado.`}`,
  };
}

// M11 — COT across 10 markets
async function m11(db) {
  const out = [];
  for (const m of COT_MARKETS) {
    const rows = (await db.prepare('SELECT d, net, comm, oi FROM cot WHERE market = ? ORDER BY d').bind(m.id).all()).results;
    if (rows.length < 30) { out.push({ id: m.id, name: m.name, error: 'sin datos' }); continue; }
    const px = await S(db, m.px, 400);
    const prices = rows.slice(-13).map((r) => at(px, r.d)).filter((v) => v != null).map((v) => (m.invert ? 1 / v : v));
    const st = A.cotStats(rows.map((r) => r.net), prices);
    out.push({ id: m.id, name: m.name, d: rows.at(-1).d, oi: rows.at(-1).oi, pctOi: (st.net / rows.at(-1).oi) * 100, ...st, kind: m.kind === 'd' ? 'Managed Money' : 'Leveraged Funds', hist: rows.slice(-52).map((r) => r.net) });
  }
  const ext = out.filter((x) => x.extreme), div = out.filter((x) => x.divergence);
  return {
    data: { markets: out },
    reading: `${ext.length ? `Extremos: ${ext.map((x) => `${x.name} (${x.extreme === 'largo' ? 'muy largo' : 'muy corto'})`).join(', ')}.` : 'Ningún mercado en extremo de posicionamiento.'} ${div.length ? `Divergencias: ${div.map((x) => `${x.name} ${x.divergence}`).join(', ')}.` : ''}`.trim(),
  };
}

// M12 — news intelligence: hot topics and statement redlines. c.news() = the ranked items from the worker.
async function m12(db, c) {
  const news = await c.news();
  const now = Date.now(), H = 36e5;
  const count = (from, to) => { const k = {}; for (const n of news.items) if (n.time >= now - from * H && n.time < now - to * H) for (const t of n.tags) k[t] = (k[t] || 0) + 1; return k; };
  const recent = count(12, 0), before = count(36, 12);
  const topics = Object.keys({ ...recent, ...before }).map((t) => ({ tag: t, recent: recent[t] || 0, before: before[t] || 0, accel: (before[t] || 0) >= 2 && (recent[t] || 0) >= 6 && (recent[t] || 0) / 12 >= 2 * ((before[t] || 0) / 24) })).sort((a, b) => b.recent - a.recent);
  const diffOf = async (k) => {
    const st = (await kvGet(db, k))?.v;
    if (!st || st.length < 2) return st?.length ? { newer: st[0], diff: null } : null;
    return { newer: { date: st[0].date, url: st[0].url }, older: { date: st[1].date, url: st[1].url }, diff: A.wordDiff(st[1].text, st[0].text) };
  };
  const [fomc, ecb] = await Promise.all([diffOf('stmt:fomc'), diffOf('stmt:ecb')]);
  const hot = topics.filter((t) => t.accel).map((t) => t.tag);
  return { data: { topics, fomc, ecb }, reading: hot.length ? `Temas en aceleración: ${hot.join(', ')}.` : `Tema dominante: ${topics[0]?.tag ?? '—'} (${topics[0]?.recent ?? 0} titulares en 12 h).` };
}

// M13 — statistics and seasonality
const CORR_SET = [['GC=F', 'Oro'], ['SI=F', 'Plata'], ['DX-Y.NYB', 'DXY'], ['^TNX', 'US 10Y', true], ['^GSPC', 'S&P 500'], ['BTC-USD', 'Bitcoin'], ['CL=F', 'WTI'], ['HG=F', 'Cobre']];
async function m13(db) {
  const gc = await series(db, 'y:GC=F', '2006-01-01');
  const monthly = A.seasonalityMonthly(gc), weekday = A.seasonalityWeekday(gc.slice(-1260));
  const hourly = (await kvGet(db, 'season:hourly'))?.v ?? [];
  const ranges = gc.slice(-251, -1).filter((r) => r.h && r.l).map((r) => ((r.h - r.l) / r.v) * 100).sort((a, b) => a - b);
  const p = (q) => ranges[Math.floor(q * (ranges.length - 1))];
  const today = gc.at(-1), todayRange = today.h ? ((today.h - today.l) / today.v) * 100 : null;
  const rows = await Promise.all(CORR_SET.map(([s]) => S(db, s, 420)));
  const joined = A.align(...rows);
  const rets = CORR_SET.map(([, , diff], i) => { const v = joined.map((r) => r.v[i]); return diff ? A.diffs(v) : A.changes(v); });
  const matrix = (n) => rets.map((a) => rets.map((b) => A.corr(a.slice(-n), b.slice(-n))));
  const month = new Date().getUTCMonth();
  const mm = monthly[month];
  const busiest = hourly.filter((h) => h.n > 50).sort((a, b) => b.absMean - a.absMean)[0];
  return {
    data: { monthly, weekday, hourly, range: { p25: p(0.25), p50: p(0.5), p75: p(0.75), p90: p(0.9), today: todayRange, pctile: todayRange == null ? null : (ranges.filter((x) => x <= todayRange).length / ranges.length) * 100 }, corr: { labels: CORR_SET.map((x) => x[1]), m20: matrix(20), m60: matrix(60), m250: matrix(250) }, streak: A.streak(vals(gc.slice(-30))) },
    reading: `En ${'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(' ')[month]} el oro subió en el ${num(mm.upPct, 0)} % de los últimos ${mm.n} años (media ${sgn(mm.mean)} %).${busiest ? ` La hora con más movimiento es las ${String(busiest.hour).padStart(2, '0')}:00 UTC.` : ''}`,
  };
}

// M14 — reports and journal
async function m14(db) {
  const reports = (await db.prepare('SELECT kind, d, body FROM reports ORDER BY d DESC LIMIT 30').all()).results.map((r) => ({ ...r, body: JSON.parse(r.body) }));
  const journal = (await db.prepare('SELECT id, d, created, bias, levels, note, hit FROM journal ORDER BY d DESC, id DESC LIMIT 60').all()).results;
  const rate = (n) => { const e = journal.filter((j) => j.hit != null).slice(0, n); return e.length ? { n: e.length, pct: (e.filter((j) => j.hit).length / e.length) * 100 } : null; };
  const r20 = rate(20), r60 = rate(60);
  return { data: { reports, journal, hit20: r20, hit60: r60 }, reading: r20 ? `Tu sesgo diario acertó el ${num(r20.pct, 0)} % de las últimas ${r20.n} sesiones evaluadas.` : 'Apunta tu sesgo cada día y aquí verás tu tasa de acierto.' };
}

// M15 — alerts
async function m15(db, c) {
  const env = c.env;
  const levels = (await db.prepare('SELECT id, price, label FROM levels ORDER BY price DESC').all()).results;
  const sent = (await db.prepare('SELECT key, t, text FROM alerts_log ORDER BY t DESC LIMIT 20').all()).results;
  const on = !!(env.TELEGRAM_TOKEN && env.TELEGRAM_CHAT);
  return { data: { telegram: on, levels, sent }, reading: on ? `Alertas activas por Telegram; ${levels.length} niveles vigilados.` : 'Telegram sin configurar: las alertas se registran aquí pero no se envían.' };
}

// M1 — today: gold bias from the other modules
async function m1(db, c) {
  const [r2, r3, r4, r5, r10, r11] = await Promise.all(['m2', 'm3', 'm4', 'm5', 'm10', 'm11'].map(c.get));
  const gc = await S(db, 'GC=F', 120);
  const g = r11.data.markets.find((m) => m.id === 'gold');
  const x = {
    dxy5: r4.data?.dxy5 ?? null, ry5: r4.data?.ry5 ?? null, price: gc.at(-1)?.v, sma20: A.sma(vals(gc), 20), sma50: A.sma(vals(gc), 50),
    regime: r2.data.label, etf5: r5.data?.d5 ?? null, cot: g?.idx156 ?? null, surprise: r10.data.surpriseIndex,
  };
  const b = A.bias(x);
  const bt = (await kvGet(db, 'backtest'))?.v ?? null;
  const drivers = b.components.filter((c) => c.vote !== 0).map((c) => `${c.k[0].toLowerCase()}${c.k.slice(1)} ${c.vote > 0 ? 'a favor' : 'en contra'}`);
  return {
    data: { ...b, inputs: x, regime: r2.data.label, levels: r3.data?.levels ?? [], expected: r3.data?.expected, backtest: bt },
    reading: `Sesgo ${b.label} (${sgn(b.score, 0)} de ±7)${drivers.length ? `: ${drivers.join(', ')}` : ''}. Régimen ${r2.data.label.toLowerCase()}.`,
  };
}

export const MODULES = { m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15 };
export const TTL = { m1: 300, m2: 300, m3: 60, m4: 3600, m5: 3600, m6: 3600, m7: 300, m8: 300, m9: 300, m10: 900, m11: 3600, m12: 300, m13: 21600, m14: 30, m15: 30 };
