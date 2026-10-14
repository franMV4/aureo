// Data source connectors. Plain fetch, so they run in the Worker and in Node (backfill/backtest scripts).
import { releaseDates } from './analytics.js';

export const UA = { 'User-Agent': 'Mozilla/5.0' };

async function get(url, as = 'json', headers = UA) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return as === 'json' ? r.json() : as === 'text' ? r.text() : r.arrayBuffer();
}

// --- Yahoo ---------------------------------------------------------------------
export async function yahoo(sym, range, interval) {
  // range can be a Yahoo range ('5d', '2y') or a start date ('2006-01-01') for long daily history
  const span = /^\d{4}-/.test(range) ? `period1=${Math.floor(Date.parse(range) / 1000)}&period2=${Math.floor(Date.now() / 1000)}` : `range=${range}`;
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?${span}&interval=${interval}`);
  if (!j.chart?.result?.[0]) throw new Error(`yahoo ${sym}: ${j.chart?.error?.description ?? 'sin datos'}`);
  return j.chart.result[0];
}

// Daily OHLC rows keyed by the exchange's local date.
export async function yahooDaily(sym, range = '5d') {
  const r = await yahoo(sym, range, '1d');
  const q = r.indicators.quote[0], off = r.meta.gmtoffset ?? 0;
  return (r.timestamp ?? []).map((t, i) => ({ d: new Date((t + off) * 1000).toISOString().slice(0, 10), v: q.close[i], o: q.open[i], h: q.high[i], l: q.low[i] })).filter((x) => x.v != null);
}

export async function yahooBars(sym, range, interval) {
  const r = await yahoo(sym, range, interval);
  const q = r.indicators.quote[0];
  return (r.timestamp ?? []).map((t, i) => ({ t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume?.[i] ?? 0 })).filter((b) => b.c != null);
}

// --- FRED (CSV download, no API key) ----------------------------------------------
// FRED's edge drops requests with no User-Agent or a bare browser one; an honest app name passes.
const FRED_UA = { 'User-Agent': 'MarketDesk/1.0 (+personal dashboard)' };
// With a key (free at fredaccount.stlouisfed.org) use the official API: the CSV endpoint drops
// connections from the Workers runtime, but answers Node (backfill and sync scripts).
export async function fred(id, from = '2016-01-01', key = null) {
  if (key) {
    const j = await get(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&observation_start=${from}`, 'json', FRED_UA);
    return j.observations.filter((o) => o.value !== '.').map((o) => ({ d: o.date, v: Number(o.value) }));
  }
  const txt = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${from}`, 'text', FRED_UA);
  return txt.trim().split('\n').slice(1).map((l) => l.split(',')).filter(([, v]) => v && v !== '.').map(([d, v]) => ({ d, v: Number(v) }));
}

export async function fredReleaseDates(rid, year) {
  return releaseDates(await get(`https://fred.stlouisfed.org/releases/calendar?rid=${rid}&y=${year}`, 'text', FRED_UA));
}

// --- CFTC COT --------------------------------------------------------------------
// kind 'd' = disaggregated (Managed Money), 't' = traders in financial futures (Leveraged Funds)
export const COT_MARKETS = [
  { id: 'gold', name: 'Oro', code: '088691', kind: 'd', px: 'GC=F' },
  { id: 'silver', name: 'Plata', code: '084691', kind: 'd', px: 'SI=F' },
  { id: 'copper', name: 'Cobre', code: '085692', kind: 'd', px: 'HG=F' },
  { id: 'wti', name: 'Crudo WTI', code: '067651', kind: 'd', px: 'CL=F' },
  { id: 'dxy', name: 'Índice dólar', code: '098662', kind: 't', px: 'DX-Y.NYB' },
  { id: 'eur', name: 'Euro', code: '099741', kind: 't', px: 'EURUSD=X' },
  { id: 'jpy', name: 'Yen', code: '097741', kind: 't', px: 'JPY=X', invert: true },
  { id: 'es', name: 'S&P 500 e-mini', code: '13874A', kind: 't', px: '^GSPC' },
  { id: 'ty', name: 'Bono 10 años', code: '043602', kind: 't', px: '^TNX', invert: true },
  { id: 'btc', name: 'Bitcoin', code: '133741', kind: 't', px: 'BTC-USD' },
];

export async function cotHistory(m, limit = 260) {
  const ds = m.kind === 'd' ? '72hh-3qpy' : 'gpe5-46if';
  const q = `?cftc_contract_market_code=${m.code}&$order=report_date_as_yyyy_mm_dd DESC&$limit=${limit}`;
  const rows = await get(`https://publicreporting.cftc.gov/resource/${ds}.json${q.replace(/ /g, '%20')}`);
  const n = (r, k) => Number(r[k]) || 0;
  return rows.map((r) => ({
    d: r.report_date_as_yyyy_mm_dd.slice(0, 10),
    oi: n(r, 'open_interest_all'),
    net: m.kind === 'd' ? n(r, 'm_money_positions_long_all') - n(r, 'm_money_positions_short_all') : n(r, 'lev_money_positions_long') - n(r, 'lev_money_positions_short'),
    comm: m.kind === 'd'
      ? n(r, 'prod_merc_positions_long') - n(r, 'prod_merc_positions_short') + n(r, 'swap_positions_long_all') - n(r, 'swap__positions_short_all')
      : n(r, 'dealer_positions_long_all') - n(r, 'dealer_positions_short_all'),
  })).reverse();
}

// --- SPDR GLD holdings (xlsx archive) ------------------------------------------------
// ponytail: minimal xlsx reader (zip central directory + deflate-raw + shared strings), enough for this one file
async function unzip(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = buf.byteLength - 22;
  while (eocd > 0 && v.getUint32(eocd, true) !== 0x06054b50) eocd--;
  const files = {};
  let p = v.getUint32(eocd + 16, true);
  for (let i = 0, n = v.getUint16(eocd + 10, true); i < n; i++) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nameLen = v.getUint16(p + 28, true);
    const extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    files[name] = { method, data: u8.subarray(start, start + size) };
    p += 46 + nameLen + extra + comment;
  }
  return async (name) => {
    const f = files[name];
    if (!f) return null;
    if (f.method === 0) return new TextDecoder().decode(f.data);
    const stream = new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  };
}

export async function gldHoldings() {
  const buf = await get('https://api.spdrgoldshares.com/api/v1/historical-archive?product=GLD&exchange=NYSE&lang=en', 'buffer');
  const read = await unzip(buf);
  const strings = [...((await read('xl/sharedStrings.xml')) ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, s]) => [...s.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((x) => x[1]).join(''));
  let sheet = null;
  for (const n of ['xl/worksheets/sheet2.xml', 'xl/worksheets/sheet1.xml']) {
    const x = await read(n);
    if (x && x.includes('<row')) { sheet = x; if ((sheet.match(/<row/g) || []).length > 100) break; }
  }
  const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const rows = [];
  let tonCol = null;
  for (const [, row] of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const [, ref, t, inner] of row.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const raw = inner.match(/<v>([^<]*)<\/v>/)?.[1];
      cells[ref] = / t="s"/.test(t) ? strings[+raw] : raw;
    }
    if (!tonCol) { tonCol = Object.keys(cells).find((k) => /Tonnes of Gold/i.test(cells[k] ?? '')); continue; }
    const m = String(cells.A ?? '').match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
    const tn = Number(cells[tonCol]);
    if (m && isFinite(tn) && tn > 0) rows.push({ d: `${m[3]}-${MON[m[2]]}-${m[1]}`, v: tn });
  }
  return rows;
}

// --- Central bank statements -----------------------------------------------------------
const stripTags = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

export async function fomcStatements(limit = 2) {
  const xml = await get('https://www.federalreserve.gov/feeds/press_monetary.xml', 'text');
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, x]) => ({ title: x.match(/<title>([^<]*)/)?.[1] ?? '', link: x.match(/<link>(?:<!\[CDATA\[)?\s*([^<\]\s]+)/)?.[1] ?? '' }))
    .filter((i) => /issues FOMC statement/i.test(i.title)).slice(0, limit);
  return Promise.all(items.map(async (i) => {
    const html = await get(i.link, 'text');
    const art = html.slice(html.indexOf('id="article"'));
    const paras = [...art.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(([, p]) => stripTags(p)).filter((p) => p && !/^(January|February|March|April|May|June|July|August|September|October|November|December) \d|^For release/.test(p));
    const end = paras.findIndex((p) => /^For media inquiries|^Implementation Note/i.test(p));
    return { date: i.link.match(/(\d{8})/)?.[1]?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), url: i.link, text: paras.slice(0, end < 0 ? undefined : end).join('\n\n') };
  }));
}

export async function ecbDecision() {
  const xml = await get('https://www.ecb.europa.eu/rss/press.html', 'text');
  const it = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, x]) => ({ title: x.match(/<title>([^<]*)/)?.[1]?.trim() ?? '', link: x.match(/<link>(?:<!\[CDATA\[)?\s*([^<\]\s]+)/)?.[1] ?? '' }))
    .find((i) => /^Monetary policy decisions/i.test(i.title));
  if (!it) return null;
  const html = await get(it.link, 'text');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const paras = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(([, p]) => stripTags(p)).filter((p) => p.length > 40);
  return { date: it.link.match(/mp(\d{6})/)?.[1]?.replace(/(\d{2})(\d{2})(\d{2})/, '20$1-$2-$3') ?? null, url: it.link, text: paras.join('\n\n') };
}
