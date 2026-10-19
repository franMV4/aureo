// Lingote worker (engine from MarketDesk): serves public/ (via [assets]) and proxies market data with an edge cache.
import { summarizeCot, summarizeChart, parseRss, scoreNews, dedupe, eventWords } from './lib.js';
import { MODULES as BASE, TTL as BASE_TTL } from './modules.js';
import { PAGES, PAGES_TTL, asset, candles } from './pages.js';

const MODULES = { ...BASE, ...PAGES }, TTL = { ...BASE_TTL, ...PAGES_TTL };
import { JOBS, DERIVED, isDue, alert, COST, BUDGET, SCHEDULE } from './jobs.js';
import { kvGet, kvSet, health, iso } from './store.js';

const UA = { 'User-Agent': 'Mozilla/5.0' };

const INDICES = [
  ['^GSPC', 'S&P 500', 'US'], ['^NDX', 'Nasdaq 100', 'US'], ['^DJI', 'Dow Jones', 'US'], ['^RUT', 'Russell 2000', 'US'],
  ['^GDAXI', 'DAX', 'EU'], ['^STOXX50E', 'Euro Stoxx 50', 'EU'], ['^IBEX', 'IBEX 35', 'EU'], ['^FTSE', 'FTSE 100', 'EU'],
  ['^N225', 'Nikkei 225', 'AS'], ['^HSI', 'Hang Seng', 'AS'],
];
const MACRO = [
  ['GC=F', 'Oro fut.'], ['SI=F', 'Plata'], ['DX-Y.NYB', 'DXY'], ['^TNX', 'US 10Y'],
  ['^VIX', 'VIX'], ['CL=F', 'WTI'], ['EURUSD=X', 'EUR/USD'], ['BTC-USD', 'Bitcoin'],
];

const FEEDS = [
  ['FXStreet', 'https://www.fxstreet.com/rss/news'],
  ['CNBC', 'https://www.cnbc.com/id/20910258/device/rss/rss.html'],
  ['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories'],
  ['Investing', 'https://www.investing.com/rss/news_25.rss'],
  ['Fed', 'https://www.federalreserve.gov/feeds/press_all.xml'],
  ['BCE', 'https://www.ecb.europa.eu/rss/press.html'],
  ['Google News', 'https://news.google.com/rss/search?q=gold+price+OR+XAUUSD+OR+%22gold+futures%22&hl=en-US&gl=US&ceid=US:en'],
];

// Cache API wrapper: fn() result is stored as JSON for ttl seconds.
async function cached(ctx, key, ttl, fn) {
  const cache = caches.default;
  const req = new Request(`https://cache.lingote/${key}`);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const data = await fn();
  ctx.waitUntil(cache.put(req, new Response(JSON.stringify(data), { headers: { 'Cache-Control': `max-age=${ttl}` } })));
  return data;
}

async function getJson(url, headers = UA) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

const yahoo = (sym, range, interval) =>
  getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}`)
    .then((j) => j.chart.result[0]);

// One failing symbol must not blank the whole board.
async function quotes(list) {
  return Promise.all(list.map(async ([sym, label, region]) => {
    try { return { ...summarizeChart(await yahoo(sym, '1y', '1d')), label, region }; }
    catch (e) { return { symbol: sym, label, region, error: e.message }; }
  }));
}

async function gold() {
  const [spot, fut] = await Promise.allSettled([
    getJson('https://api.gold-api.com/price/XAU'),
    yahoo('GC=F', '1d', '5m'),
  ]);
  const f = fut.status === 'fulfilled' ? fut.value : null;
  const pts = f ? f.timestamp.map((t, i) => [t, f.indicators.quote[0].close[i]]).filter((p) => p[1] != null) : [];
  return {
    spot: spot.status === 'fulfilled' ? spot.value.price : null,
    spotAt: spot.status === 'fulfilled' ? spot.value.updatedAt : null,
    // ponytail: % change, range and intraday line come from COMEX futures; spot and futures move together, basis differs
    fut: f ? { price: f.meta.regularMarketPrice, prev: f.meta.chartPreviousClose, high: f.meta.regularMarketDayHigh, low: f.meta.regularMarketDayLow } : null,
    intraday: pts,
    error: spot.status === 'rejected' && !f ? 'Sin datos de oro' : null,
  };
}

async function cot() {
  const base = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json';
  const q = `?$where=cftc_contract_market_code='088691'&$order=report_date_as_yyyy_mm_dd DESC&$limit=160`;
  const [rows, px] = await Promise.all([getJson(base + q.replace(/ /g, '%20')), yahoo('GC=F', '5y', '1wk')]);
  const s = summarizeCot(rows);
  const weekly = px.timestamp.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), px.indicators.quote[0].close[i]]).filter((p) => p[1] != null);
  s.price = weekly.filter((p) => p[0] >= s.history[0].date);
  return s;
}

// The week's calendar comes from D1, filled hourly by the cron job (which retries on its own).
// Forex Factory answers 429 to Cloudflare's shared IPs too often to call it on every visit;
// it is only fetched live when D1 has nothing for this week yet.
async function calendar(env) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // Forex Factory weeks run Sunday to Saturday
  const rows = (await env.DB.prepare("SELECT t, country, title, impact, forecast, previous, actual FROM events WHERE id LIKE 'ff:%' AND t >= ? AND t < ? ORDER BY t").bind(d.getTime(), d.getTime() + 7 * 864e5).all()).results;
  if (rows.length) return rows.map((e) => ({ title: e.title, country: e.country, date: new Date(e.t).toISOString(), impact: e.impact, forecast: e.forecast ?? '', previous: e.previous ?? '', actual: e.actual ?? '' }));
  const ev = await getJson('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
  return ev.map(({ title, country, date, impact, forecast, previous, actual }) => ({ title, country, date, impact, forecast, previous, actual: actual ?? '' }));
}

async function news(ctx, env) {
  const results = await Promise.allSettled(FEEDS.map(async ([name, url]) => {
    const r = await fetch(url, { headers: UA });
    if (!r.ok) throw new Error(`${name} ${r.status}`);
    return parseRss(await r.text(), name);
  }));
  let events = [];
  try { events = await cached(ctx, 'calendar', 900, () => calendar(env)); } catch { /* ranking works without it */ }
  const now = Date.now();
  const ew = eventWords(events.map((e) => ({ ...e, date: new Date(e.date).toISOString() })), now);
  const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((i) => i.time && now - i.time < 36 * 36e5)
    .map((i) => scoreNews(i, now, ew));
  return {
    items: dedupe(all).slice(0, 30),
    failed: results.map((r, i) => (r.status === 'rejected' ? FEEDS[i][0] : null)).filter(Boolean),
  };
}

const ROUTES = {
  '/api/gold': [15, () => gold()],
  '/api/quotes': [60, async () => ({ indices: await quotes(INDICES), macro: await quotes(MACRO) })],
  '/api/cot': [3600, () => cot()],
  '/api/calendar': [900, (ctx, env) => calendar(env)],
  '/api/news': [300, (ctx, env) => news(ctx, env)],
};

// Analysis modules: one memo per request so M1 can reuse M2..M11 without recomputing.
// bump MOD_V when a module changes the shape of its data, so a deploy never serves the old cached shape
const MOD_V = 5;
function moduleRunner(env, ctx) {
  const memo = new Map();
  const c = { env, news: () => cached(ctx, 'news', 300, () => news(ctx, env)) };
  c.get = (id) => {
    if (!memo.has(id)) memo.set(id, cached(ctx, `mod${MOD_V}-${id}`, TTL[id], () => MODULES[id](env.DB, c)));
    return memo.get(id);
  };
  return c.get;
}

// Writes (journal, levels, manual jobs) need Cloudflare Access in production, or WRITE_OPEN=1 locally.
const canWrite = (req, env) => env.WRITE_OPEN === '1' || !!req.headers.get('Cf-Access-Authenticated-User-Email');

// Runs due jobs, most overdue first, without passing the plan's outbound-request budget per invocation.
// What doesn't fit stays due and runs on the next tick, so slow jobs (fred, cot) can't be starved by quotes.
async function runJobs(env, ctx, only) {
  const mod = moduleRunner(env, ctx);
  const done = [];
  const now = Date.now();
  const names = [...Object.keys(JOBS), ...Object.keys(DERIVED)].filter((n) => !only || only === 'all' || only === n);
  const due = [];
  for (const name of names) {
    const last = (await kvGet(env.DB, `job:${name}`))?.v;
    if (!only && !isDue(name, last)) continue;
    due.push({ name, lag: last ? (now - last) / (SCHEDULE[name] * 6e4) : Infinity });
  }
  due.sort((a, b) => b.lag - a.lag);
  let left = only && only !== 'all' ? Infinity : BUDGET;
  for (const { name } of due) {
    const cost = COST[name] ?? 5;
    if (cost > left) { done.push(`${name}: aplazado (sin cupo en esta pasada)`); continue; }
    left -= cost;
    try {
      await (JOBS[name] ? JOBS[name](env) : DERIVED[name](env, mod));
      await kvSet(env.DB, `job:${name}`, Date.now());
      await health(env.DB, name);
      done.push(name);
    } catch (e) {
      await health(env.DB, name, e.message);
      done.push(`${name}: ${e.message}`);
    }
  }
  return done;
}

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function api(req, env, ctx, pathname) {
  const m = pathname.match(/^\/api\/m\/([a-z0-9]+)$/);
  if (m && Object.hasOwn(MODULES, m[1])) {
    const r = await moduleRunner(env, ctx)(m[1]);
    return json({ ok: true, at: Date.now(), ...r });
  }
  const a = pathname.match(/^\/api\/asset\/([^/]{1,24})$/);
  if (a && req.method === 'GET') {
    const sym = decodeURIComponent(a[1]).toUpperCase();
    if (!/^[A-Z0-9^=.\-]+$/.test(sym)) return json({ ok: false, error: 'Símbolo no válido' }, 400);
    return json({ ok: true, at: Date.now(), data: await cached(ctx, `asset-${sym}`, 900, () => asset(env.DB, sym)) });
  }
  if (pathname === '/api/candles') {
    const q = new URL(req.url).searchParams, sym = (q.get('sym') || 'GC=F').toUpperCase(), tf = q.get('tf') || '1d';
    if (!/^[A-Z0-9^=.\-]{1,24}$/.test(sym) || !['15m', '1h', '4h', '1d'].includes(tf)) return json({ ok: false, error: 'Parámetros no válidos' }, 400);
    return json({ ok: true, at: Date.now(), data: await cached(ctx, `candles-${sym}-${tf}`, tf === '1d' ? 900 : 60, () => candles(env.DB, sym, tf)) });
  }
  if (pathname === '/api/health') {
    const rows = (await env.DB.prepare('SELECT source, ok_at, err_at, err, fails FROM source_health ORDER BY source').all()).results;
    return json({ ok: true, data: rows });
  }
  if (req.method === 'POST' || req.method === 'DELETE') {
    if (!canWrite(req, env)) return json({ ok: false, error: 'Solo con Cloudflare Access' }, 403);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    if (pathname === '/api/journal' && req.method === 'POST') {
      const bias = Math.sign(Number(body.bias) || 0);
      const num = (v) => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v));
      const note = String(body.note ?? '').slice(0, 2000), levels = JSON.stringify({ entry: num(body.entry), invalid: num(body.invalid), basis: num(body.basis) ?? 0 });
      await env.DB.prepare('INSERT INTO journal (d, created, bias, levels, note) VALUES (?, ?, ?, ?, ?)').bind(iso(), Date.now(), bias, levels, note).run();
      return json({ ok: true });
    }
    const jh = pathname.match(/^\/api\/journal\/(\d+)$/);
    if (jh && req.method === 'POST') {
      const hit = body.hit === 1 || body.hit === 0 ? body.hit : null;
      await env.DB.prepare('UPDATE journal SET hit = ? WHERE id = ?').bind(hit, Number(jh[1])).run();
      return json({ ok: true });
    }
    if (pathname === '/api/levels' && req.method === 'POST') {
      const price = Number(body.price);
      if (!isFinite(price) || price <= 0) return json({ ok: false, error: 'Precio no válido' }, 400);
      await env.DB.prepare('INSERT INTO levels (price, label) VALUES (?, ?)').bind(price, String(body.label ?? '').slice(0, 60)).run();
      return json({ ok: true });
    }
    const del = pathname.match(/^\/api\/levels\/(\d+)$/);
    if (del && req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM levels WHERE id = ?').bind(Number(del[1])).run();
      return json({ ok: true });
    }
    if (pathname === '/api/alerts/test') {
      const sent = await alert(env, `test:${Date.now()}`, 'Prueba de alerta de Aureo.');
      return json({ ok: true, sent, telegram: !!(env.TELEGRAM_TOKEN && env.TELEGRAM_CHAT) });
    }
    if (pathname === '/api/admin/run') {
      return json({ ok: true, done: await runJobs(env, ctx, new URL(req.url).searchParams.get('job') || 'all') });
    }
  }
  return null;
}

export default {
  async fetch(req, env, ctx) {
    const { pathname } = new URL(req.url);
    try {
      const r = await api(req, env, ctx, pathname);
      if (r) return r;
    } catch (e) {
      return json({ ok: false, error: e.message }, 502);
    }
    const route = ROUTES[pathname];
    if (!route) return env.ASSETS.fetch(req);
    const [ttl, fn] = route;
    try {
      const data = await cached(ctx, `${pathname.slice(5)}-v${MOD_V}`, ttl, () => fn(ctx, env));
      return json({ ok: true, at: Date.now(), data });
    } catch (e) {
      return json({ ok: false, error: e.message }, 502);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runJobs(env, ctx));
  },
};
