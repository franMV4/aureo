// Scheduled ingestion and derived jobs. scheduled() runs every 15 min and executes whatever is due.
import { YAHOO, FRED, RELEASES } from './config.js';
import * as src from './sources.js';
import * as st from './store.js';
import * as A from './analytics.js';
import { tradeR } from './levels.js';
import { session } from './pages.js';

const madrid = (t = Date.now()) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(t).map((p) => [p.type, p.value]));
const fmt = (v, d = 1) => (v == null || !isFinite(v) ? null : String(Math.round(v * 10 ** d) / 10 ** d));

async function pool(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  return out;
}

// A FRED macro series got a new observation: fill the matching calendar event with actual + surprise.
async function onRelease(db, rel, rows) {
  const v = rows.map((r) => r.v);
  const calc = (i) => ({ diffK: (v[i] - v[i - 1]) * 1000, mom: A.pct(v[i - 1], v[i]), level: v[i], levelK: v[i] }[rel.calc]);
  const actual = calc(v.length - 1);
  const hist = v.slice(1).map((_, i) => calc(i + 1)).filter((x) => x != null && isFinite(x));
  const sd = A.std(A.diffs(hist.slice(-61)));
  const ev = await db.prepare('SELECT id, forecast FROM events WHERE kind = ? AND actual IS NULL AND t <= ? AND t >= ? ORDER BY t DESC LIMIT 1').bind(rel.kind, Date.now(), Date.now() - 3 * 864e5).first();
  if (!ev) return;
  const f = A.parseNum(ev.forecast);
  const surprise = f == null || !sd ? null : ((actual - f) / sd) * (rel.weakIfUp ? -1 : 1);
  const shown = rel.calc === 'diffK' || rel.calc === 'levelK' ? `${fmt(actual / 1000, 0)}K` : rel.calc === 'mom' ? `${fmt(actual)}%` : fmt(actual);
  await db.prepare('UPDATE events SET actual = ?, surprise = ? WHERE id = ?').bind(shown, surprise, ev.id).run();
}

async function telegram(env, text) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT, text }) });
}
export async function alert(env, key, text) {
  const db = env.DB;
  if (await db.prepare('SELECT 1 FROM alerts_sent WHERE key = ?').bind(key).first()) return false;
  await db.batch([db.prepare('INSERT INTO alerts_sent (key, t) VALUES (?, ?)').bind(key, Date.now()), db.prepare('INSERT INTO alerts_log (t, key, text) VALUES (?, ?, ?)').bind(Date.now(), key, text)]);
  await telegram(env, text);
  return true;
}

export const JOBS = {
  async quotes(env) {
    await pool(YAHOO, 8, async (y) => {
      // self-healing: a new symbol loads its history, a gap of more than a few days refills a month
      const last = await st.lastObs(env.DB, `y:${y.s}`);
      const range = !last ? (y.long ? '2006-01-01' : '5y') : last.d >= st.daysAgo(5) ? '5d' : '1mo';
      try { await st.upsertObs(env.DB, `y:${y.s}`, await src.yahooDaily(y.s, range)); } catch (e) { await st.health(env.DB, `yahoo ${y.s}`, e.message); }
    });
  },
  async bars(env) {
    await st.upsertBars(env.DB, 'GC=F', await src.yahooBars('GC=F', '1d', '5m'));
  },
  async fred(env) {
    if (!env.FRED_KEY) throw new Error('Falta FRED_KEY: sin ella el Worker no puede leer FRED (usa npm run sync en local)');
    await pool(Object.keys(FRED), 6, async (id) => {
      try {
        const prev = await st.lastObs(env.DB, `f:${id}`);
        const rows = await src.fred(id, st.daysAgo(70), env.FRED_KEY);
        await st.upsertObs(env.DB, `f:${id}`, rows);
        const rel = RELEASES.find((r) => r.fred === id);
        if (rel && prev && rows.at(-1)?.d > prev.d) await onRelease(env.DB, rel, await st.series(env.DB, `f:${id}`, '2010-01-01'));
      } catch (e) { await st.health(env.DB, `fred ${id}`, e.message); }
    });
  },
  async calendar(env) {
    const ev = await (await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { headers: src.UA })).json();
    const stmt = env.DB.prepare(`INSERT INTO events (id, t, country, title, impact, kind, forecast, previous) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET t = excluded.t, impact = excluded.impact, forecast = excluded.forecast, previous = excluded.previous`);
    await env.DB.batch(ev.map((e) => {
      const kind = e.country === 'USD' ? RELEASES.find((r) => r.match.test(e.title))?.kind ?? null : null;
      return stmt.bind(`ff:${e.date}:${e.country}:${e.title}`, Date.parse(e.date), e.country, e.title, e.impact, kind, e.forecast || null, e.previous || null);
    }));
  },
  async moves(env) {
    const pending = (await env.DB.prepare('SELECT id, t FROM events WHERE kind IS NOT NULL AND t < ? AND t > ? AND (r60 IS NULL OR rday IS NULL)').bind(Date.now() - 70 * 6e4, Date.now() - 3 * 864e5).all()).results;
    for (const e of pending) {
      const T = e.t / 1000;
      const bars = (await env.DB.prepare('SELECT t, o, h, l, c FROM bars WHERE sym = ? AND t >= ? AND t <= ? ORDER BY t').bind('GC=F', T - 3600, T + 86400).all()).results;
      const m = A.eventMoves(bars, T, 300);
      if (m) await env.DB.prepare('UPDATE events SET r15 = ?, r60 = ?, rday = ? WHERE id = ?').bind(m.r15, m.r60, Date.now() - e.t > 12 * 36e5 ? m.rday : null, e.id).run();
    }
  },
  async gld(env) {
    await st.upsertObs(env.DB, 'gld:tonnes', (await src.gldHoldings()).slice(-30));
  },
  async cot(env) {
    for (const m of src.COT_MARKETS) await st.upsertCot(env.DB, m.id, await src.cotHistory(m, 3));
  },
  async statements(env) {
    const f = await src.fomcStatements(2);
    if (f.length) await st.kvSet(env.DB, 'stmt:fomc', f);
    const e = await src.ecbDecision();
    if (e?.text) {
      const prev = (await st.kvGet(env.DB, 'stmt:ecb'))?.v ?? [];
      if (prev[0]?.url !== e.url) await st.kvSet(env.DB, 'stmt:ecb', [e, ...prev].slice(0, 2));
    }
  },
  async journal(env) {
    const open = (await env.DB.prepare('SELECT id, d, created, bias, levels FROM journal WHERE hit IS NULL AND d < ?').bind(st.iso()).all()).results;
    const bars15 = open.length ? await src.yahooBars('GC=F', '5d', '15m').catch(() => []) : [];
    for (const j of open) {
      // the plan as a trade, in R, on the 15-minute bars of its session (only while Yahoo still has them: 5 days)
      let lv = {};
      try { lv = JSON.parse(j.levels || '{}'); } catch { /* old free-text plan */ }
      const key = j.created ? session(j.created).date : null;
      const own = key ? bars15.filter((b) => b.t * 1000 >= j.created && session(b.t * 1000).date === key) : [];
      if (own.length && lv.entry != null) {
        lv.trade = tradeR({ bias: j.bias, entry: lv.entry, invalid: lv.invalid, basis: lv.basis ?? 0, bars: own });
        await env.DB.prepare('UPDATE journal SET levels = ? WHERE id = ?').bind(JSON.stringify(lv), j.id).run();
      }
      const bars = (await env.DB.prepare('SELECT d, v, o, h, l FROM obs WHERE series = ? AND d <= ? ORDER BY d DESC LIMIT 16').bind('y:GC=F', j.d).all()).results.reverse();
      const day = bars.at(-1);
      if (!day || day.d !== j.d || day.o == null) continue;
      const atr = A.atr(bars.slice(0, -1).map((b) => ({ h: b.h, l: b.l, c: b.v })), 14), move = day.v - day.o, k = 0.25 * atr;
      const hit = j.bias > 0 ? move > k : j.bias < 0 ? -move > k : Math.abs(move) <= k;
      await env.DB.prepare('UPDATE journal SET hit = ? WHERE id = ?').bind(hit ? 1 : 0, j.id).run();
    }
  },
};

// Jobs that need the analysis modules (reports, alerts) are passed `mod(id)` by the worker.
export const DERIVED = {
  async reports(env, mod) {
    const m = madrid(), today = `${m.year}-${m.month}-${m.day}`, hm = +m.hour * 60 + +m.minute;
    const due = [];
    if (hm >= 450 && !['Sat', 'Sun'].includes(m.weekday)) due.push(['diario', today]);
    if (m.weekday === 'Sat' && hm >= 600) due.push(['semanal', today]);
    if (m.day === '01' && hm >= 450) due.push(['mensual', today]);
    for (const [kind, d] of due) {
      if (await env.DB.prepare('SELECT 1 FROM reports WHERE kind = ? AND d = ?').bind(kind, d).first()) continue;
      const ids = kind === 'diario' ? ['m1', 'm2', 'm3', 'm10', 'm4', 'm7', 'm12'] : kind === 'semanal' ? ['m1', 'm11', 'm5', 'm2', 'm4', 'm7', 'm8', 'm9', 'm10', 'm14'] : ['m6', 'm4', 'm5', 'm13', 'm11', 'm2', 'm8', 'm9', 'm14'];
      const sections = [];
      for (const id of ids) { try { const r = await mod(id); sections.push({ id, reading: r.reading }); } catch (e) { sections.push({ id, reading: `Sin datos (${e.message}).` }); } }
      await env.DB.prepare('INSERT OR REPLACE INTO reports (kind, d, body) VALUES (?, ?, ?)').bind(kind, d, JSON.stringify({ generated: Date.now(), sections })).run();
    }
  },
  async alerts(env, mod) {
    const db = env.DB, now = Date.now();
    // 1. high-impact USD event within 15 minutes
    const soon = (await db.prepare("SELECT id, t, title FROM events WHERE country = 'USD' AND impact = 'High' AND t > ? AND t <= ?").bind(now, now + 15 * 6e4).all()).results;
    for (const e of soon) await alert(env, `ev:${e.id}`, `${e.title} en ${Math.ceil((e.t - now) / 6e4)} min (USD, impacto alto).`);
    // 2. price crossing a saved level
    const px = (await db.prepare('SELECT c FROM bars WHERE sym = ? ORDER BY t DESC LIMIT 1').bind('GC=F').first())?.c;
    if (px) {
      for (const l of (await db.prepare('SELECT id, price, label, side FROM levels').all()).results) {
        const side = Math.sign(px - l.price);
        if (l.side != null && side && side !== l.side) await alert(env, `lvl:${l.id}:${now}`, `Oro (fut. GC) ${side > 0 ? 'rompe al alza' : 'pierde'} ${l.price}${l.label ? ` (${l.label})` : ''}: ${px.toFixed(1)}.`);
        if (side) await db.prepare('UPDATE levels SET side = ? WHERE id = ?').bind(side, l.id).run();
      }
    }
    // 3-5. COT extremes, VIX curve inversion, gold vs real-yield correlation flip
    const [cot, reg, drv] = await Promise.all([mod('m11'), mod('m2'), mod('m4')]);
    for (const m of cot.data.markets.filter((x) => x.extreme)) await alert(env, `cot:${m.id}:${m.d}`, `COT ${m.name}: especuladores ${m.extreme === 'largo' ? 'muy largos' : 'muy cortos'} (índice 3 años ${Math.round(m.idx156)}).`);
    const r = reg.data.ratioSeries;
    if (r.length > 1 && r.at(-1).v > 1 && r.at(-2).v <= 1) await alert(env, `vix:${r.at(-1).d}`, `VIX/VIX3M = ${r.at(-1).v.toFixed(2)}: la curva del VIX se invierte (estrés).`);
    const c = drv.data?.corr;
    if (c && Math.sign(c.ry60) !== Math.sign(c.ry60prev)) await alert(env, `corr:${st.iso()}`, `La correlación oro/tipos reales a 60 días cambia de signo (${c.ry60prev.toFixed(2)} → ${c.ry60.toFixed(2)}).`);
  },
};

// minutes between runs; cot only matters around the Friday release
export const SCHEDULE = { quotes: 15, bars: 15, moves: 15, alerts: 15, reports: 15, calendar: 60, fred: 60, cot: 60, gld: 360, statements: 360, journal: 360 };
export const isDue = (name, lastRun, now = Date.now()) => {
  if (name === 'cot' && ![5, 6, 1].includes(new Date(now).getUTCDay())) return false;
  return !lastRun || now - lastRun >= SCHEDULE[name] * 6e4 - 30e3;
};
