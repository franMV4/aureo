// Pure functions shared by the worker and the tests. No I/O here.

// COT Index (Larry Williams): where the latest net sits inside the last n weeks' range, 0..100.
// values: chronological, oldest first.
export function cotIndex(values, n) {
  const w = values.slice(-n);
  const min = Math.min(...w), max = Math.max(...w);
  return max === min ? 50 : ((w.at(-1) - min) / (max - min)) * 100;
}

// Disaggregated COT rows (newest first, as CFTC returns them) -> summary for the UI.
export function summarizeCot(rows) {
  const asc = [...rows].reverse().map((r) => {
    const n = (k) => Number(r[k]) || 0;
    return {
      date: r.report_date_as_yyyy_mm_dd.slice(0, 10),
      oi: n('open_interest_all'),
      mm: n('m_money_positions_long_all') - n('m_money_positions_short_all'),
      mmLong: n('m_money_positions_long_all'),
      mmShort: n('m_money_positions_short_all'),
      // ponytail: "commercials" = producer/merchant + swap dealers, the usual reading of the disaggregated report
      comm:
        n('prod_merc_positions_long') - n('prod_merc_positions_short') +
        n('swap_positions_long_all') - n('swap__positions_short_all'),
      swap: n('swap_positions_long_all') - n('swap__positions_short_all'),
      prod: n('prod_merc_positions_long') - n('prod_merc_positions_short'),
      other: n('other_rept_positions_long') - n('other_rept_positions_short'),
      small: n('nonrept_positions_long_all') - n('nonrept_positions_short_all'),
    };
  });
  const last = asc.at(-1), prev = asc.at(-2) ?? last;
  const mm = asc.map((r) => r.mm), comm = asc.map((r) => r.comm);
  return {
    date: last.date,
    last,
    change: { mm: last.mm - prev.mm, comm: last.comm - prev.comm, swap: last.swap - prev.swap, prod: last.prod - prev.prod, oi: last.oi - prev.oi },
    pctOi: { mm: (last.mm / last.oi) * 100, comm: (last.comm / last.oi) * 100, swap: (last.swap / last.oi) * 100 },
    index: {
      mm26: cotIndex(mm, 26), mm156: cotIndex(mm, 156),
      comm26: cotIndex(comm, 26), comm156: cotIndex(comm, 156),
    },
    history: asc.map(({ date, mm, comm, swap, prod, oi }) => ({ date, mm, comm, swap, prod, oi })),
  };
}

// Yahoo v8 chart result -> compact quote.
export function summarizeChart(r) {
  const m = r.meta;
  const t = r.timestamp ?? [];
  const c = r.indicators?.quote?.[0]?.close ?? [];
  const pts = t.map((s, i) => [s, c[i]]).filter((p) => p[1] != null);
  const price = m.regularMarketPrice;
  const back = (n) => pts.at(-1 - n)?.[1];
  const pct = (from) => (from ? ((price - from) / from) * 100 : null);
  const year = new Date().getUTCFullYear();
  const lastPrevYear = pts.filter((p) => new Date(p[0] * 1000).getUTCFullYear() < year).at(-1)?.[1];
  const tp = m.currentTradingPeriod?.regular;
  const now = Date.now() / 1000;
  return {
    symbol: m.symbol,
    name: m.shortName ?? m.symbol,
    price,
    currency: m.currency,
    d1: m.regularMarketChangePercent ?? null,
    w1: pct(back(5)),
    m1: pct(back(21)),
    ytd: pct(lastPrevYear),
    high: m.regularMarketDayHigh,
    low: m.regularMarketDayLow,
    time: m.regularMarketTime,
    open: tp ? now >= tp.start && now < tp.end : null,
    spark: pts.slice(-30).map((p) => p[1]),
  };
}

// --- RSS -------------------------------------------------------------------

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (_, e) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? _,
    )
    .replace(/\s+/g, ' ')
    .trim();
const tag = (x, t) => {
  const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i'));
  return m ? decode(decode(m[1])) : '';
};

// ponytail: regex RSS parser, fine for the well-formed feeds we pick; swap for a real XML parser if a feed breaks it
export function parseRss(xml, source) {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(([x]) => {
    let title = tag(x, 'title');
    let src = source;
    if (source === 'Google News') {
      const s = tag(x, 'source');
      if (s) { src = s; title = title.replace(new RegExp(`\\s+-\\s+${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), ''); }
    }
    return {
      title,
      link: tag(x, 'link') || (x.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? ''),
      time: Date.parse(tag(x, 'pubDate') || tag(x, 'dc:date')) || 0,
      summary: tag(x, 'description').slice(0, 280),
      source: src,
      feed: source,
    };
  }).filter((i) => i.title);
}

// --- News ranking ------------------------------------------------------------

// [regex, weight, tag]. Weighted for an intraday gold trader.
const KEYWORDS = [
  [/\b(gold|xau|bullion|oro)\b/i, 5, 'Oro'],
  [/\b(fed|fomc|powell|rate cut|rate hike|interest rates?)\b/i, 5, 'Fed'],
  [/\b(cpi|pce|inflation|inflación)\b/i, 4, 'Inflación'],
  [/\b(payrolls?|nfp|jobless|unemployment|jobs report|employment)\b/i, 4, 'Empleo'],
  [/\b(treasury|yields?|bond)\b/i, 3, 'Bonos'],
  [/\b(dollar|dxy|greenback)\b/i, 3, 'Dólar'],
  [/\b(war|missile|strike|sanction|iran|israel|russia|ukraine|china|taiwan|attack)\b/i, 3, 'Geopolítica'],
  [/\b(tariffs?|trade war)\b/i, 3, 'Aranceles'],
  [/\b(ecb|lagarde|boj|boe|central bank)\b/i, 2, 'Bancos centrales'],
  [/\b(silver|plata|precious metals?)\b/i, 2, 'Metales'],
  [/\b(gdp|recession|pmi|ism|retail sales)\b/i, 2, 'Macro'],
  [/\b(s&p|nasdaq|dow|stocks|wall street|equities)\b/i, 1, 'Bolsa'],
];

const SOURCE_WEIGHT = { Fed: 3, BCE: 2, FXStreet: 1.5, CNBC: 1, MarketWatch: 1, Investing: 1, 'Google News': 1 };

export function scoreNews(item, now = Date.now(), eventWords = []) {
  const text = `${item.title} ${item.summary}`;
  let score = 0;
  const tags = [];
  for (const [re, w, t] of KEYWORDS) {
    if (re.test(item.title)) { score += w * 1.5; tags.push(t); }
    else if (re.test(text)) { score += w * 0.5; }
  }
  score += SOURCE_WEIGHT[item.feed] ?? 1;
  const lower = item.title.toLowerCase();
  if (eventWords.some((w) => lower.includes(w))) { score += 3; tags.push('Evento hoy'); }
  const ageH = Math.max(0, (now - item.time) / 36e5);
  score *= 0.5 ** (ageH / 8); // half-life 8h
  return { ...item, score: Math.round(score * 10) / 10, tags: [...new Set(tags)].slice(0, 3) };
}

const STOP = new Set('the and for with from that this into over amid after says said will its are has have was were but not you your than then what when where which while about more most gold'.split(' '));
const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

export function similarity(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

// Keep the best-scored story per cluster; remember the other sources that ran it.
export function dedupe(items, threshold = 0.6) {
  const kept = [];
  for (const it of [...items].sort((a, b) => b.score - a.score)) {
    const twin = kept.find((k) => similarity(k.title, it.title) >= threshold);
    if (twin) { if (!twin.also.includes(it.source) && it.source !== twin.source) twin.also.push(it.source); }
    else kept.push({ ...it, also: [] });
  }
  return kept;
}

// Words from today's high-impact USD events, used to boost matching headlines.
export function eventWords(events, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const map = { cpi: 'cpi', 'non-farm': 'payrolls', nfp: 'payrolls', fomc: 'fomc', 'federal funds': 'fed', powell: 'powell', pce: 'pce', gdp: 'gdp', unemployment: 'jobless', ism: 'ism', 'retail sales': 'retail sales', ppi: 'ppi' };
  const out = new Set();
  for (const e of events) {
    if (e.impact !== 'High' || !e.date?.startsWith(day)) continue;
    const t = e.title.toLowerCase();
    for (const [k, v] of Object.entries(map)) if (t.includes(k)) out.add(v);
  }
  return [...out];
}
