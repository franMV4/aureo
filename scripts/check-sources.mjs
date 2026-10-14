// F0: which data sources answer from here. usage: node scripts/check-sources.mjs
const UA = { 'User-Agent': 'Mozilla/5.0' };
const CHECKS = [
  ['Yahoo chart (GC=F)', 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=15m', (j) => j.chart.result[0].meta.regularMarketPrice],
  ['gold-api contado XAU', 'https://api.gold-api.com/price/XAU', (j) => j.price],
  ['Binance PAXG/USDT', 'https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', (j) => j.price],
  ['Bybit XAUT/USDT', 'https://api.bybit.com/v5/market/tickers?category=spot&symbol=XAUTUSDT', (j) => j.result.list[0].lastPrice],
  ['Yahoo opciones GLD', 'https://query2.finance.yahoo.com/v7/finance/options/GLD', (j) => j.optionChain.result[0].options[0].calls.length],
  ['CBOE futuros VIX', 'https://cdn.cboe.com/api/global/delayed_quotes/futures/VX.json', (j) => j.data?.length ?? Object.keys(j).length],
  ['CNN Fear & Greed', 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata', (j) => j.fear_and_greed.score],
  ['CFTC COT oro', "https://publicreporting.cftc.gov/resource/72hh-3qpy.json?cftc_contract_market_code=088691&$limit=1&$order=report_date_as_yyyy_mm_dd%20DESC", (j) => j[0].report_date_as_yyyy_mm_dd.slice(0, 10)],
  ['Forex Factory semana', 'https://nfs.faireconomy.media/ff_calendar_thisweek.json', (j) => `${j.length} eventos`],
  ['FRED CSV (DFII10)', 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10&cosd=2026-09-01', (t) => t.trim().split('\n').at(-1), 'text', { 'User-Agent': 'Lingote/1.0 (+personal dashboard)' }],
];

for (const [name, url, pick, as = 'json', headers = UA] of CHECKS) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = pick(as === 'json' ? await r.json() : await r.text());
    console.log(`OK    ${name.padEnd(24)} ${String(v).slice(0, 40).padEnd(40)} ${Date.now() - t0} ms`);
  } catch (e) {
    console.log(`FALLA ${name.padEnd(24)} ${e.message.slice(0, 60)}`);
  }
}
