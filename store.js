// D1 helpers.
export const iso = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export const daysAgo = (n) => iso(Date.now() - n * 864e5);

export async function series(db, key, from = '1900-01-01') {
  return (await db.prepare('SELECT d, v, o, h, l FROM obs WHERE series = ? AND d >= ? ORDER BY d').bind(key, from).all()).results;
}

export async function lastObs(db, key) {
  return db.prepare('SELECT d, v FROM obs WHERE series = ? ORDER BY d DESC LIMIT 1').bind(key).first();
}

async function batch(db, stmts) {
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
}

export async function upsertObs(db, key, rows) {
  const st = db.prepare('INSERT OR REPLACE INTO obs (series, d, v, o, h, l) VALUES (?, ?, ?, ?, ?, ?)');
  await batch(db, rows.map((r) => st.bind(key, r.d, r.v, r.o ?? null, r.h ?? null, r.l ?? null)));
}

export async function upsertBars(db, sym, rows) {
  const st = db.prepare('INSERT OR REPLACE INTO bars (sym, t, o, h, l, c) VALUES (?, ?, ?, ?, ?, ?)');
  await batch(db, rows.map((b) => st.bind(sym, b.t, b.o, b.h, b.l, b.c)));
}

export async function upsertCot(db, market, rows) {
  const st = db.prepare('INSERT OR REPLACE INTO cot (market, d, net, comm, oi) VALUES (?, ?, ?, ?, ?)');
  await batch(db, rows.map((r) => st.bind(market, r.d, r.net, r.comm, r.oi)));
}

export async function kvGet(db, k) {
  const r = await db.prepare('SELECT v, t FROM kv WHERE k = ?').bind(k).first();
  return r ? { v: JSON.parse(r.v), t: r.t } : null;
}

export const kvSet = (db, k, v) => db.prepare('INSERT OR REPLACE INTO kv (k, v, t) VALUES (?, ?, ?)').bind(k, JSON.stringify(v), Date.now()).run();

export async function health(db, source, err) {
  if (err) await db.prepare('INSERT INTO source_health (source, err_at, err, fails) VALUES (?1, ?2, ?3, 1) ON CONFLICT(source) DO UPDATE SET err_at = ?2, err = ?3, fails = fails + 1').bind(source, Date.now(), String(err).slice(0, 300)).run();
  else await db.prepare('INSERT INTO source_health (source, ok_at, fails) VALUES (?1, ?2, 0) ON CONFLICT(source) DO UPDATE SET ok_at = ?2, fails = 0').bind(source, Date.now()).run();
}
