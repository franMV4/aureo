-- MarketDesk D1 schema. Idempotent: safe to run on every deploy/backfill.

-- Daily observations: Yahoo closes (y:SYMBOL, with OHLC), FRED (f:SERIES), GLD tonnes (gld:tonnes)
CREATE TABLE IF NOT EXISTS obs (series TEXT NOT NULL, d TEXT NOT NULL, v REAL, o REAL, h REAL, l REAL, PRIMARY KEY (series, d));

-- Intraday gold bars (5 min) captured from now on
CREATE TABLE IF NOT EXISTS bars (sym TEXT NOT NULL, t INTEGER NOT NULL, o REAL, h REAL, l REAL, c REAL, PRIMARY KEY (sym, t));

-- Economic events: live Forex Factory rows plus historical releases (kind = mapped release, e.g. 'cpi')
-- r15 / r60 / rday = gold % move 15 min / 1 h / rest of the day after the release
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, t INTEGER NOT NULL, country TEXT, title TEXT, impact TEXT, kind TEXT,
  forecast TEXT, previous TEXT, actual TEXT, surprise REAL, r15 REAL, r60 REAL, rday REAL
);
CREATE INDEX IF NOT EXISTS events_kind ON events (kind, t);

-- Weekly COT: net = speculators (Managed Money / Leveraged Funds), comm = commercials / dealers
CREATE TABLE IF NOT EXISTS cot (market TEXT NOT NULL, d TEXT NOT NULL, net REAL, comm REAL, oi REAL, PRIMARY KEY (market, d));

CREATE TABLE IF NOT EXISTS reports (kind TEXT NOT NULL, d TEXT NOT NULL, body TEXT, PRIMARY KEY (kind, d));

CREATE TABLE IF NOT EXISTS journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT, d TEXT NOT NULL, created INTEGER, bias INTEGER, levels TEXT, note TEXT, hit INTEGER
);

CREATE TABLE IF NOT EXISTS levels (id INTEGER PRIMARY KEY AUTOINCREMENT, price REAL NOT NULL, label TEXT, side INTEGER);

CREATE TABLE IF NOT EXISTS source_health (source TEXT PRIMARY KEY, ok_at INTEGER, err_at INTEGER, err TEXT, fails INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS alerts_sent (key TEXT PRIMARY KEY, t INTEGER);
CREATE TABLE IF NOT EXISTS alerts_log (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, key TEXT, text TEXT);

-- Precomputed blobs (hourly seasonality, FOMC statements, backtest...)
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, t INTEGER);
