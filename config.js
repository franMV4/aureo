// What Lingote tracks. Add any Yahoo ticker here and it gets its own sheet at /a/TICKER (history loads on the next run).
// Shared by the worker, the backfill and the backtest.

// Yahoo daily series. long = 20 years of history (seasonality, backtest), others 5 years.
export const YAHOO = [
  { s: 'GC=F', label: 'Oro fut.', g: 'metal', long: true },
  { s: 'SI=F', label: 'Plata', g: 'metal' },
  { s: 'HG=F', label: 'Cobre', g: 'metal' },
  { s: 'PL=F', label: 'Platino', g: 'metal' },
  { s: 'PA=F', label: 'Paladio', g: 'metal' },
  { s: 'CL=F', label: 'WTI', g: 'energy' },
  { s: 'BZ=F', label: 'Brent', g: 'energy' },
  { s: 'NG=F', label: 'Gas natural', g: 'energy' },
  { s: 'DX-Y.NYB', label: 'DXY', g: 'fx' },
  { s: 'EURUSD=X', label: 'EUR/USD', g: 'fx', cur: 'EUR' },
  { s: 'GBPUSD=X', label: 'GBP/USD', g: 'fx', cur: 'GBP' },
  { s: 'JPY=X', label: 'USD/JPY', g: 'fx', cur: 'JPY', inv: true },
  { s: 'CHF=X', label: 'USD/CHF', g: 'fx', cur: 'CHF', inv: true },
  { s: 'AUDUSD=X', label: 'AUD/USD', g: 'fx', cur: 'AUD' },
  { s: 'CAD=X', label: 'USD/CAD', g: 'fx', cur: 'CAD', inv: true },
  { s: 'CNY=X', label: 'USD/CNY', g: 'fx', cur: 'CNY', inv: true },
  { s: '^TNX', label: 'US 10Y', g: 'rates' },
  { s: '^VIX', label: 'VIX', g: 'vol' },
  { s: '^VIX9D', label: 'VIX 9D', g: 'vol' },
  { s: '^VIX3M', label: 'VIX 3M', g: 'vol' },
  { s: '^MOVE', label: 'MOVE', g: 'vol' },
  { s: '^GVZ', label: 'GVZ', g: 'vol', long: true },
  { s: '^GSPC', label: 'S&P 500', g: 'idx', region: 'US' },
  { s: '^NDX', label: 'Nasdaq 100', g: 'idx', region: 'US' },
  { s: '^DJI', label: 'Dow Jones', g: 'idx', region: 'US' },
  { s: '^RUT', label: 'Russell 2000', g: 'idx', region: 'US' },
  { s: '^GDAXI', label: 'DAX', g: 'idx', region: 'EU' },
  { s: '^STOXX50E', label: 'Euro Stoxx 50', g: 'idx', region: 'EU' },
  { s: '^IBEX', label: 'IBEX 35', g: 'idx', region: 'EU' },
  { s: '^FTSE', label: 'FTSE 100', g: 'idx', region: 'EU' },
  { s: '^N225', label: 'Nikkei 225', g: 'idx', region: 'AS' },
  { s: '^HSI', label: 'Hang Seng', g: 'idx', region: 'AS' },
  { s: 'BTC-USD', label: 'Bitcoin', g: 'crypto' },
  { s: 'ETH-USD', label: 'Ethereum', g: 'crypto' },
  { s: 'NEM', label: 'Newmont', g: 'stock' },
  { s: 'GDX', label: 'Mineras de oro (GDX)', g: 'stock' },
  { s: 'NVDA', label: 'Nvidia', g: 'stock' },
  { s: 'AAPL', label: 'Apple', g: 'stock' },
  { s: 'MSFT', label: 'Microsoft', g: 'stock' },
  { s: 'AMZN', label: 'Amazon', g: 'stock' },
  { s: 'TSLA', label: 'Tesla', g: 'stock' },
  { s: 'SPY', label: 'S&P 500 ETF', g: 'sector' },
  { s: 'RSP', label: 'S&P igual peso', g: 'sector' },
  { s: 'XLK', label: 'Tecnología', g: 'sector', kind: 'ciclico' },
  { s: 'XLF', label: 'Financieras', g: 'sector', kind: 'ciclico' },
  { s: 'XLY', label: 'Consumo discrecional', g: 'sector', kind: 'ciclico' },
  { s: 'XLI', label: 'Industriales', g: 'sector', kind: 'ciclico' },
  { s: 'XLB', label: 'Materiales', g: 'sector', kind: 'ciclico' },
  { s: 'XLE', label: 'Energía', g: 'sector', kind: 'ciclico' },
  { s: 'XLC', label: 'Comunicaciones', g: 'sector', kind: 'ciclico' },
  { s: 'XLRE', label: 'Inmobiliario', g: 'sector', kind: 'defensivo' },
  { s: 'XLV', label: 'Salud', g: 'sector', kind: 'defensivo' },
  { s: 'XLP', label: 'Consumo básico', g: 'sector', kind: 'defensivo' },
  { s: 'XLU', label: 'Utilities', g: 'sector', kind: 'defensivo' },
];

// FRED daily/weekly/monthly series (CSV, no key)
export const FRED = {
  DFII10: 'Tipo real 10 años (TIPS)', T10YIE: 'Inflación implícita 10 años', DGS3MO: 'Letra 3 meses', DGS2: 'Bono 2 años', DGS10: 'Bono 10 años', DGS30: 'Bono 30 años',
  T10Y2Y: 'Pendiente 10a-2a', T10Y3M: 'Pendiente 10a-3m', THREEFYTP10: 'Prima por plazo 10 años', SOFR: 'SOFR', DFF: 'Fondos federales efectivo',
  BAMLH0A0HYM2: 'Diferencial high yield', WALCL: 'Balance de la Fed', WTREGEN: 'Cuenta del Tesoro (TGA)', RRPONTSYD: 'Repos inversos (RRP)',
  CPIAUCSL: 'IPC', CPILFESL: 'IPC subyacente', PAYEMS: 'Nóminas no agrícolas', UNRATE: 'Tasa de paro', RSAFS: 'Ventas minoristas', PCEPILFE: 'PCE subyacente', ICSA: 'Peticiones de desempleo', PPIFIS: 'IPP demanda final', A191RL1Q225SBEA: 'PIB trimestral anualizado',
};

// US releases tracked for surprises and gold reaction. rid = FRED release id, et = release time New York.
// match = Forex Factory title patterns; calc turns the FRED series into the unit Forex Factory uses.
export const RELEASES = [
  { kind: 'nfp', name: 'Nóminas no agrícolas', rid: 50, et: '08:30', match: /^Non-Farm Employment Change/i, fred: 'PAYEMS', calc: 'diffK' },
  { kind: 'unrate', name: 'Tasa de paro', rid: 50, et: '08:30', match: /^Unemployment Rate/i, fred: 'UNRATE', calc: 'level', noHist: true, weakIfUp: true },
  { kind: 'cpi', name: 'IPC m/m', rid: 10, et: '08:30', match: /^CPI m\/m/i, fred: 'CPIAUCSL', calc: 'mom' },
  { kind: 'corecpi', name: 'IPC subyacente m/m', rid: 10, et: '08:30', match: /^Core CPI m\/m/i, fred: 'CPILFESL', calc: 'mom', noHist: true },
  { kind: 'ppi', name: 'IPP m/m', rid: 46, et: '08:30', match: /^PPI m\/m/i, fred: 'PPIFIS', calc: 'mom' },
  { kind: 'retail', name: 'Ventas minoristas m/m', rid: 9, et: '08:30', match: /^Retail Sales m\/m/i, fred: 'RSAFS', calc: 'mom' },
  { kind: 'gdp', name: 'PIB t/t', rid: 53, et: '08:30', match: /GDP q\/q/i, fred: 'A191RL1Q225SBEA', calc: 'level' },
  { kind: 'pce', name: 'PCE subyacente m/m', rid: 54, et: '08:30', match: /^Core PCE Price Index m\/m/i, fred: 'PCEPILFE', calc: 'mom' },
  { kind: 'claims', name: 'Peticiones de desempleo', rid: 180, et: '08:30', match: /^Unemployment Claims/i, fred: 'ICSA', calc: 'levelK', weakIfUp: true },
  { kind: 'fomc', name: 'Decisión del FOMC', et: '14:00', match: /^Federal Funds Rate|^FOMC Statement/i },
];

// ponytail: FOMC decision days typed by hand from the Fed calendar; add the next year's when the Fed publishes it
export const FOMC = [
  '2024-01-31', '2024-03-20', '2024-05-01', '2024-06-12', '2024-07-31', '2024-09-18', '2024-11-07', '2024-12-18',
  '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18', '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-10',
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
];
