// Lingote modules: the daily plan (today), gold quant (quant), markets, asset sheets, candles and journal.
// Built on the MarketDesk store and modules; registered in worker.js next to m1..m15.
import { YAHOO } from './config.js';
import * as A from './analytics.js';
import * as Q from './quant.js';
import { series, kvGet, daysAgo, iso } from './store.js';
import { yahoo, yahooDaily, yahooBars, COT_MARKETS, UA } from './sources.js';
import { factorInputs, scoreFactors } from './factors.js';
import { dayLevels, scenarios, levelStats } from './levels.js';
import { cotIndex } from './lib.js';
import { align3, moves, fitBetas, attribute, vqBand } from './vq.js';

const vals = (rows) => rows.map((r) => r.v);
const chg = (rows, n) => (rows.length > n ? A.pct(rows.at(-1 - n).v, rows.at(-1).v) : null);
const nyDate = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(t);
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const safe = async (p, d = null) => { try { return await p; } catch { return d; } };

// CME gold session: 18:00 New York (previous day) to 17:00 New York.
export function session(tRef) {
  const date = nyDate(tRef + 6 * 36e5);
  const start = A.zonedToUtc(addDays(date, -1), '18:00') * 1000;
  return { date, start, end: start + 23 * 36e5, asiaEnd: start + 9 * 36e5, londonEnd: start + 14.5 * 36e5 };
}
const SESSIONS = [['Asia', 0, 9], ['Londres', 9, 14.5], ['Nueva York', 14.5, 23]];

async function goldSpot() {
  const [a, b] = await Promise.allSettled([
    fetch('https://api.gold-api.com/price/XAU', { headers: UA }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=XAUTUSDT', { headers: UA }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
  ]);
  if (a.status === 'fulfilled' && a.value.price) return { price: a.value.price, at: Date.parse(a.value.updatedAt) || Date.now(), src: 'contado (gold-api)' };
  if (b.status === 'fulfilled' && b.value.result?.list?.[0]) return { price: +b.value.result.list[0].lastPrice, at: Date.now(), src: 'XAUT/USDT (Bybit), aproximación' };
  return null;
}

async function goldSeries(db) {
  const [gc, dxy, ry, vix, vix3m, gld] = await Promise.all([
    series(db, 'y:GC=F', '2006-01-01'), series(db, 'y:DX-Y.NYB', daysAgo(1200)), series(db, 'f:DFII10', daysAgo(1200)),
    series(db, 'y:^VIX', daysAgo(60)), series(db, 'y:^VIX3M', daysAgo(60)), series(db, 'gld:tonnes', daysAgo(60)),
  ]);
  return { gc, dxy, ry, vix, vix3m, gld };
}

// ---------- quant: volatility, regimes, risk and projection of gold ----------
async function quant(db) {
  const gc = (await series(db, 'y:GC=F', '2006-01-01')).filter((r) => r.v > 0);
  const closes = vals(gc), r = closes.slice(1).map((c, i) => (c / closes[i] - 1) * 100);
  const last = gc.at(-1), price = last.v;
  // ponytail: models are fitted on request and cached 6 h; move to a nightly script if the Worker hits its CPU limit
  const g = Q.garch(r.slice(-2500)), gj = Q.garch(r.slice(-2500), { gjr: true });
  const hm = Q.hmm(r.slice(-1500), 3, 30);
  const realized = (n) => gc.slice(-500).map((row, i, a) => { const j = gc.length - 500 + i; return { d: row.d, v: j > n ? A.std(r.slice(j - n, j)) * Math.sqrt(252) : null }; });
  const rv20 = realized(20), rv100 = realized(100), gv = g.vol.slice(-500).map((v) => v * Math.sqrt(252));
  const hz = Q.garchHorizon(g, 20);
  const gvz = await series(db, 'y:^GVZ', '2008-01-01');
  const pctile = (arr, v) => (arr.filter((x) => x <= v).length / arr.length) * 100;
  // fan track record: GARCH vs implied vol (GVZ known at each start day); the one closer to its promise draws the fan
  const rs = r.slice(-2500), base = gc.length - 2500, gz = new Map(gvz.map((x) => [x.d, x.v]));
  const chkG = Q.fanCheck(rs, Q.garchSigmaAt(g)), chkV = Q.fanCheck(rs, (t, h) => { const v = gz.get(gc[base + t]?.d); return v ? (v / Math.sqrt(252)) * Math.sqrt(h) : null; });
  const miss = (c) => c.reduce((s, x) => s + Math.abs(x.in90 - 90) + Math.abs(x.in50 - 50), 0);
  const gvzNow = gvz.at(-1)?.v ?? null, useGvz = gvzNow != null && miss(chkV) < miss(chkG);
  const hzFan = useGvz ? hz.map((_, k) => (gvzNow / Math.sqrt(252)) * Math.sqrt(k + 1)) : hz;
  const dd = Q.drawdowns(closes.slice(-756));
  // probability table on round numbers: about ±2.5 monthly sigmas, step 25/50/100/250 $
  const s20 = (price * hzFan[19]) / 100, step = [25, 50, 100, 250, 500].find((x) => x >= s20 / 2.5) ?? 500;
  const grid = []; for (let L = Math.ceil((price - 2.5 * s20) / step) * step; L <= price + 2.5 * s20; L += step) grid.push(L);
  const odds = (L, h) => { const d = Math.log(L / price) * 100, s = hzFan[h - 1]; return { touch: Q.touchProb(d, s) * 100, above: (1 - Q.phi(d / s)) * 100 }; };
  return {
    data: {
      d: last.d, price,
      garch: { a: g.a, b: g.b, pers: g.pers, halfLife: g.halfLife, next: g.next, nextAnn: g.next * Math.sqrt(252), longRunAnn: g.longRun * Math.sqrt(252), move1: (price * g.next) / 100 },
      gjr: { a: gj.a, b: gj.b, g: gj.g, pers: gj.pers, next: gj.next, nextAnn: gj.next * Math.sqrt(252), lr: 2 * (g.nll - gj.nll) },
      gvz: gvzNow, gvzPct: gvzNow == null ? null : pctile(gvz.slice(-252).map((x) => x.v), gvzNow), volPct: pctile(gv.slice(-252).filter((x) => x != null), g.next * Math.sqrt(252)),
      vol: gc.slice(-500).map((row, i) => ({ d: row.d, rv20: rv20[i].v, rv100: rv100[i].v, garch: gv[i] ?? null })),
      hmm: { states: hm.states.map((s, i) => ({ ...s, name: ['Calma', 'Normal', 'Agitado'][i] })), A: hm.A, current: hm.current, path: hm.path.slice(-250).map((s, i) => ({ d: gc.at(-250 + i).d, s })) },
      risk: { y1: Q.riskStats(r.slice(-252)), y4: Q.riskStats(r.slice(-1008)) },
      dd: { max: dd.max, current: dd.current, series: dd.series.map((v, i) => ({ d: gc.at(-756 + i).d, v })) },
      hist: Q.histogram(r.slice(-1000)),
      ar1: Q.ar1Test(r.slice(-2500)),
      fan: Q.fan(price, hzFan), fanSource: useGvz ? 'GVZ' : 'GARCH',
      fanCheck: chkG.map((c, i) => ({ h: c.h, n: c.n, garch90: c.in90, garch50: c.in50, gvz90: chkV[i].in90, gvz50: chkV[i].in50, in90: (useGvz ? chkV : chkG)[i].in90, in50: (useGvz ? chkV : chkG)[i].in50 })),
      fanFrom: gc.at(-750).d,
      recent: gc.slice(-40).map((row) => ({ d: row.d, v: row.v })),
      probMap: grid.map((L) => { const a = odds(L, 5), b = odds(L, 20); return { level: L, touch5: a.touch, touch20: b.touch, above20: b.above }; }),
    },
    reading: `Volatilidad esperada mañana ${(g.next * Math.sqrt(252)).toFixed(1).replace('.', ',')} % anual (±${((price * g.next) / 100).toFixed(0)} $ en un día). Régimen ${['de calma', 'normal', 'agitado'][hm.current]} con ${Math.round(hm.states[hm.current].p * 100)} % de probabilidad.`,
  };
}

// ---------- today: the plan of the day ----------
async function today(db, c) {
  const [spot, intra, S, q, r10, bt, news, eur] = await Promise.all([
    safe(goldSpot()), safe(yahooBars('GC=F', '5d', '15m'), []), goldSeries(db), c.get('quant'), safe(c.get('m10')),
    kvGet(db, 'factors:backtest'), safe(c.news(), { items: [] }), series(db, 'y:EURUSD=X', daysAgo(10)),
  ]);
  const now = Date.now();
  const lastBar = intra.at(-1);
  const ses = session(lastBar ? lastBar.t * 1000 : now);
  const bars = intra.filter((b) => b.t * 1000 >= ses.start - 18 * 36e5);
  const todayBars = intra.filter((b) => b.t * 1000 >= ses.start);
  const fut = lastBar?.c ?? S.gc.at(-1).v;
  const basis = spot && lastBar && now - spot.at < 15 * 6e4 ? fut - spot.price : 0;
  const price = spot?.price ?? fut;
  const conv = (p) => (p == null ? null : p - basis);

  const daily = S.gc.filter((r) => r.d < ses.date && r.h != null);
  const atr = A.atr(daily.slice(-30).map((b) => ({ h: b.h, l: b.l, c: b.v })), 14);
  const asia = todayBars.filter((b) => b.t * 1000 < ses.asiaEnd);
  const monday = (() => { const d = new Date(ses.date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const open = todayBars[0]?.o ?? null;
  const firstOf = (test) => S.gc.find((r) => test(r) && r.d < ses.date);
  const weekOpen = firstOf((r) => r.d >= monday)?.o ?? open;
  const monthOpen = firstOf((r) => r.d.slice(0, 7) === ses.date.slice(0, 7))?.o ?? open;
  const prevWeekRows = daily.filter((r) => r.d < monday && r.d >= addDays(monday, -7));
  const prevMonthRows = daily.filter((r) => r.d.slice(0, 7) === addDays(ses.date.slice(0, 7) + '-01', -1).slice(0, 7));
  const hl = (rows) => (rows.length ? { h: Math.max(...rows.map((r) => r.h)), l: Math.min(...rows.map((r) => r.l)) } : null);
  const vwapOf = (bs) => { const w = bs.reduce((s, b) => s + (b.v || 0), 0); return w ? bs.reduce((s, b) => s + ((b.h + b.l + b.c) / 3) * (b.v || 0), 0) / w : null; };
  const lv = dayLevels({
    daily, price: fut, atr, weekOpen, monthOpen, prevWeek: hl(prevWeekRows), prevMonth: hl(prevMonthRows),
    vwap: vwapOf(todayBars), prevVwap: vwapOf(intra.filter((b) => b.t * 1000 >= ses.start - 24 * 36e5 && b.t * 1000 < ses.start)),
    today: { open, asiaHigh: asia.length ? Math.max(...asia.map((b) => b.h)) : null, asiaLow: asia.length ? Math.min(...asia.map((b) => b.l)) : null, asiaDone: now >= ses.asiaEnd },
  });
  // one-day sigma from whichever vol (GARCH or implied GVZ) kept its promise best in the fan check
  const volSrc = q.data.fanSource, sigma = (fut * (volSrc === 'GVZ' ? q.data.gvz / Math.sqrt(252) : q.data.garch.next)) / 100;
  const closed = now > ses.end || now - (lastBar?.t ?? 0) * 1000 > 2 * 36e5;
  const dayLeft = closed ? 1 : Math.max(0, Math.min(1, (ses.end - now) / (23 * 36e5)));
  const sc = scenarios({ price: fut, levels: lv, atr, sigma, dayLeft });
  const mapSc = (s) => s && { ...s, trigger: conv(s.trigger), target: conv(s.target), invalid: conv(s.invalid) };

  const fx = factorInputs(S, S.gc.at(-1).d);
  const fac = fx ? scoreFactors(fx) : null;
  const hi = todayBars.length ? Math.max(...todayBars.map((b) => b.h)) : null, lo = todayBars.length ? Math.min(...todayBars.map((b) => b.l)) : null;
  const prevClose = daily.at(-1).v;

  const evRows = (await db.prepare("SELECT id, t, country, title, impact, kind, forecast, previous, actual FROM events WHERE t >= ? AND t < ? AND impact IN ('High','Medium') AND country IN ('USD','EUR','CNY') ORDER BY t").bind(ses.start, ses.end + 24 * 36e5).all()).results;
  const stats = r10?.data?.stats ?? {};
  const events = evRows.filter((e) => e.t < ses.end).map((e) => ({ ...e, react: e.kind && stats[e.kind]?.r60?.n ? { n: stats[e.kind].r60.n, abs60: stats[e.kind].r60.absMedian, absUsd: (stats[e.kind].r60.absMedian / 100) * price, up: stats[e.kind].r60.upPct } : null }));
  const nextRed = (await db.prepare("SELECT t, title, country FROM events WHERE t > ? AND impact = 'High' AND country = 'USD' ORDER BY t LIMIT 1").bind(now).first()) ?? null;
  const plan = await db.prepare('SELECT id, d, bias, levels, note, hit FROM journal WHERE d = ? ORDER BY id DESC LIMIT 1').bind(iso()).first();
  const cur = closed ? null : SESSIONS.find(([, a, b]) => now >= ses.start + a * 36e5 && now < ses.start + b * 36e5)?.[0] ?? null;

  return {
    data: {
      price, spot, fut, basis, closed, session: { ...ses, current: cur, dayLeft },
      d1: A.pct(prevClose, fut), prevClose: conv(prevClose), high: conv(hi), low: conv(lo), range: hi != null ? hi - lo : null, atr, rangeAtr: hi != null ? ((hi - lo) / atr) * 100 : null,
      factors: fac, factorDate: S.gc.at(-1).d, backtest: bt?.v ?? null,
      levels: lv.map((l) => ({ ...l, p: conv(l.p) })), levelStats: levelStats(S.gc.filter((r) => r.h != null && r.d < ses.date)), eurusd: eur.at(-1)?.v ?? null,
      scenarios: { up: mapSc(sc.up), down: mapSc(sc.down), range: sc.range && { lo: conv(sc.range.lo), hi: conv(sc.range.hi), width: sc.range.width }, sigmaLeft: sc.sigmaLeft },
      risk: { atr, sigma, volSrc, garchAnn: q.data.garch.nextAnn, volPct: q.data.volPct, gvz: q.data.gvz, gvzPct: q.data.gvzPct, regime: q.data.hmm.states[q.data.hmm.current], var95: (q.data.risk.y4.var95 / 100) * price, es95: (q.data.risk.y4.es95 / 100) * price },
      bars: bars.map((b) => ({ t: b.t, o: conv(b.o), h: conv(b.h), l: conv(b.l), c: conv(b.c) })),
      events, nextRed, news: news.items.slice(0, 6), plan,
    },
    reading: fac ? `Balanza ${fac.total > 0 ? '+' : ''}${fac.total} de ±${fac.max}.` : 'Sin datos suficientes.',
  };
}

// ---------- markets ----------
const CORE = [['GC=F', 'Oro'], ['SI=F', 'Plata'], ['HG=F', 'Cobre'], ['DX-Y.NYB', 'DXY'], ['^TNX', 'US 10Y'], ['^GSPC', 'S&P 500'], ['^NDX', 'Nasdaq 100'], ['BTC-USD', 'Bitcoin'], ['CL=F', 'WTI'], ['^VIX', 'VIX']];
function stats(rows, gold) {
  if (rows.length < 30) return { error: 'sin datos' };
  const c = vals(rows), r = A.changes(c), y = new Date().getUTCFullYear();
  const prevY = rows.filter((x) => +x.d.slice(0, 4) < y).at(-1);
  const g = gold && A.align(rows, gold);
  const gr = g ? A.changes(g.map((x) => x.v[0])) : null, gg = g ? A.changes(g.map((x) => x.v[1])) : null;
  const hi = Math.max(...c.slice(-252)), lo = Math.min(...c.slice(-252));
  return {
    price: c.at(-1), d: rows.at(-1).d, d1: chg(rows, 1), w1: chg(rows, 5), m1: chg(rows, 21), m3: chg(rows, 63), m6: chg(rows, 126), y1: chg(rows, 252), ytd: prevY ? A.pct(prevY.v, c.at(-1)) : null,
    vol20: A.std(r.slice(-20)) * Math.sqrt(252), rsi: Q.rsi(c.slice(-120)),
    vsE50: A.pct(Q.ema(c, 50).at(-1), c.at(-1)), vsE200: c.length >= 200 ? A.pct(Q.ema(c, 200).at(-1), c.at(-1)) : null,
    pos52: hi > lo ? ((c.at(-1) - lo) / (hi - lo)) * 100 : null, hi52: hi, lo52: lo,
    corrGold60: gr ? A.corr(gr.slice(-60), gg.slice(-60)) : null, corrGold250: gr ? A.corr(gr.slice(-250), gg.slice(-250)) : null,
    spark: c.slice(-60),
  };
}

async function markets(db) {
  const gold = await series(db, 'y:GC=F', daysAgo(420));
  const list = await Promise.all(YAHOO.map(async (y) => ({ s: y.s, label: y.label, g: y.g, ...stats(await series(db, `y:${y.s}`, daysAgo(420)), y.s === 'GC=F' ? null : gold) })));
  const rows = await Promise.all(CORE.map(([s]) => series(db, `y:${s}`, daysAgo(200))));
  const joined = A.align(...rows);
  const rets = CORE.map(([s], i) => { const v = joined.map((r) => r.v[i]); return s === '^TNX' ? A.diffs(v) : A.changes(v); });
  const matrix = (n) => rets.map((a) => rets.map((b) => A.corr(a.slice(-n), b.slice(-n))));
  const ok = list.filter((x) => x.m1 != null && !['sector', 'vol', 'rates'].includes(x.g));
  const best = [...ok].sort((a, b) => b.m1 - a.m1);
  return {
    data: { list, corr: { labels: CORE.map((x) => x[1]), m20: matrix(20), m60: matrix(60) } },
    reading: `En el último mes lideran ${best.slice(0, 2).map((x) => x.label).join(' y ')}; a la cola, ${best.slice(-2).map((x) => x.label).join(' y ')}.`,
  };
}

// ---------- asset sheet (any Yahoo ticker) ----------
export async function asset(db, sym) {
  const cfg = YAHOO.find((y) => y.s === sym);
  let rows = cfg ? await series(db, `y:${sym}`, daysAgo(1900)) : [];
  let name = cfg?.label ?? null;
  if (rows.length < 60) {
    const r = await yahoo(sym, '5y', '1d');
    name ??= r.meta.shortName ?? r.meta.longName ?? sym;
    const qd = r.indicators.quote[0], off = r.meta.gmtoffset ?? 0;
    rows = (r.timestamp ?? []).map((t, i) => ({ d: new Date((t + off) * 1000).toISOString().slice(0, 10), v: qd.close[i], o: qd.open[i], h: qd.high[i], l: qd.low[i] })).filter((x) => x.v != null);
  }
  if (rows.length < 30) throw new Error('Sin histórico para ' + sym);
  const gold = sym === 'GC=F' ? null : await series(db, 'y:GC=F', daysAgo(420));
  const st = stats(rows.slice(-420), gold);
  const ohlc = rows.filter((r) => r.h != null).map((r) => ({ h: r.h, l: r.l, c: r.v }));
  const m = COT_MARKETS.find((x) => x.px === sym);
  let cot = null;
  if (m) {
    const cr = (await db.prepare('SELECT d, net, oi FROM cot WHERE market = ? ORDER BY d').bind(m.id).all()).results;
    if (cr.length > 30) cot = { name: m.name, kind: m.kind === 'd' ? 'Managed Money' : 'Leveraged Funds', d: cr.at(-1).d, net: cr.at(-1).net, change: cr.at(-1).net - cr.at(-2).net, idx26: cotIndex(cr.map((x) => x.net), 26), idx156: cotIndex(cr.map((x) => x.net), 156), hist: cr.slice(-104).map((x) => ({ d: x.d, v: x.net })) };
  }
  return {
    sym, name: name ?? sym, group: cfg?.g ?? null, ...st,
    atr: A.atr(ohlc.slice(-30), 14), adx: Q.adx(ohlc.slice(-120)),
    season: rows.length > 750 ? A.seasonalityMonthly(rows) : null,
    candles: rows.slice(-260),
    cot,
  };
}

// ---------- candles with overlays ----------
const TF = { '15m': ['5d', '15m', 1], '1h': ['1mo', '60m', 1], '4h': ['3mo', '60m', 4], '1d': ['2y', '1d', 1] };
export async function candles(db, sym, tf) {
  const [range, interval, agg] = TF[tf] ?? TF['1d'];
  let bars;
  if (tf === '1d') {
    const rows = await series(db, `y:${sym}`, daysAgo(900));
    bars = rows.length > 200 ? rows.filter((r) => r.h != null).map((r) => ({ t: Date.parse(r.d + 'T00:00:00Z') / 1000, o: r.o, h: r.h, l: r.l, c: r.v })) : (await yahooDaily(sym, '3y')).map((r) => ({ t: Date.parse(r.d + 'T00:00:00Z') / 1000, o: r.o, h: r.h, l: r.l, c: r.v }));
  } else {
    bars = (await yahooBars(sym, range, interval)).filter((b) => b.o != null);
    if (agg > 1) {
      // buckets start at the 18:00 New York open, like MT5 / TradingView, not at UTC midnight
      const by = new Map(), w = agg * 3600;
      for (const b of bars) {
        const st = session(b.t * 1000).start / 1000, k = st + Math.floor((b.t - st) / w) * w, x = by.get(k);
        by.set(k, x ? { t: k, o: x.o, h: Math.max(x.h, b.h), l: Math.min(x.l, b.l), c: b.c } : { ...b, t: k });
      }
      bars = [...by.values()];
    }
  }
  // gold futures shown as spot: subtract today's basis (futures - spot), as the Hoy page does
  let basis = 0;
  if (sym === 'GC=F') {
    const [spot, fut] = await Promise.all([safe(goldSpot()), safe(yahoo('GC=F', '1d', '5m'))]);
    const futPx = fut?.meta?.regularMarketPrice;
    if (spot && futPx && Date.now() - spot.at < 15 * 6e4) basis = futPx - spot.price;
    // ponytail: one basis for the whole history; it drifts a few $ over months and jumps a little at each roll
    if (basis) bars = bars.map((b) => ({ ...b, o: b.o - basis, h: b.h - basis, l: b.l - basis, c: b.c - basis }));
  }
  const c = bars.map((b) => b.c);
  const line = (a) => a.map((v, i) => ({ time: bars[i].t, value: v })).filter((p) => isFinite(p.value));
  const bb = c.map((_, i) => (i >= 19 ? Q.bollinger(c.slice(0, i + 1)) : null));
  return {
    sym, tf, bars, basis,
    ema20: line(Q.ema(c, 20)), ema50: line(Q.ema(c, 50)), ema200: line(Q.ema(c, 200)),
    bbUp: line(bb.map((b) => b?.up ?? NaN)), bbLow: line(bb.map((b) => b?.low ?? NaN)),
    rsi: Q.rsi(c.slice(-200)), adx: Q.adx(bars.slice(-200).map((b) => ({ h: b.h, l: b.l, c: b.c }))),
  };
}

// ---------- journal ----------
async function journal(db) {
  const rows = (await db.prepare('SELECT id, d, created, bias, levels, note, hit FROM journal ORDER BY d DESC, id DESC LIMIT 250').all()).results
    .map((j) => { let lv = {}; try { lv = JSON.parse(j.levels || '{}'); } catch { lv = { text: j.levels }; } return { ...j, entry: lv.entry ?? null, invalid: lv.invalid ?? null, levelsText: lv.text ?? null, trade: lv.trade ?? null }; });
  const done = rows.filter((j) => j.hit != null);
  const rate = (a) => (a.length ? { n: a.length, pct: (a.filter((j) => j.hit).length / a.length) * 100 } : null);
  const WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return {
    data: {
      rows: rows.slice(0, 120),
      all: rate(done), last20: rate(done.slice(0, 20)),
      byBias: [[1, 'Comprador'], [-1, 'Vendedor'], [0, 'Neutral']].map(([b, label]) => ({ label, ...rate(done.filter((j) => j.bias === b)) })),
      byWeekday: [1, 2, 3, 4, 5].map((w) => ({ label: WD[w], ...rate(done.filter((j) => new Date(j.d + 'T12:00:00Z').getUTCDay() === w)) })),
      trades: (() => {
        const t = rows.filter((j) => j.trade), on = t.filter((j) => j.trade.entered);
        return { judged: t.length, entered: on.length, avgR: on.length ? on.reduce((s, j) => s + j.trade.r, 0) / on.length : null, totalR: on.reduce((s, j) => s + j.trade.r, 0), hit1: on.length ? (on.filter((j) => j.trade.hit1).length / on.length) * 100 : null };
      })(),
    },
    reading: done.length ? `Has acertado ${Math.round(rate(done).pct)} % de ${done.length} planes evaluados.` : 'Apunta tu plan cada mañana; aquí verás cuándo aciertas.',
  };
}


// ---------- vq: variación cuantitativa = who is moving gold today: dollar, rates or gold itself ----------
async function vq(db, c) {
  const [g, d, z, q] = await Promise.all(['GC=F', 'DX-Y.NYB', 'ZN=F'].map((x) => yahooBars(x, '60d', '15m')).concat(c.get('quant')));
  const m = moves(align3(g, d, z));
  if (m.length < 500) throw new Error('faltan velas de 15 minutos del oro, el dólar o el bono');
  const fit = fitBetas(m), half = Math.floor(m.length / 2);
  const key = session(m.at(-1).t * 1000).date, day = m.filter((x) => session(x.t * 1000).date === key);
  const path = attribute(day, fit), last = path.at(-1), open = g.find((b) => session(b.t * 1000).date === key)?.o ?? g.at(-1).c;
  const sigma = q.data.garch.next; // % per day
  const score = Math.max(-100, Math.min(100, Math.round((100 * last.own) / sigma)));
  return {
    data: {
      score, band: vqBand(score), t: last.t, sessionDate: key, closed: Date.now() - last.t * 1000 > 2 * 36e5, open, sigma,
      now: { total: last.total, dollar: last.dollar, rates: last.rates, own: last.own },
      fit, early: fitBetas(m.slice(0, half)), late: fitBetas(m.slice(half)), from: m[0].t,
      path: path.map((p) => ({ t: p.t, total: p.total, dollar: p.dollar, rates: p.rates, own: p.own })),
    },
    reading: `Hoy el oro ${last.total >= 0 ? 'sube' : 'baja'} ${Math.abs(last.total).toFixed(2).replace('.', ',')} %: dólar ${last.dollar >= 0 ? '+' : '−'}${Math.abs(last.dollar).toFixed(2).replace('.', ',')}, tipos ${last.rates >= 0 ? '+' : '−'}${Math.abs(last.rates).toFixed(2).replace('.', ',')}, propio ${last.own >= 0 ? '+' : '−'}${Math.abs(last.own).toFixed(2).replace('.', ',')}.`,
  };
}

export const PAGES = { quant, today, markets, journal, vq };
export const PAGES_TTL = { quant: 21600, today: 60, markets: 300, journal: 10, vq: 60 };
