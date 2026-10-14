'use strict';
// Lingote front: dark glass trading desk. Tiny router + pages; SVG charts here, candles with lightweight-charts.
// Colour is semantic (see styles.css): gold computed levels, blue the user's own, green up, red down, orange caution.

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('lg.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lg.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const TZ = 'Europe/Madrid';
const nfc = {};
const nf = (v, d = 2) => (v == null || !isFinite(v) ? '—' : (nfc[d] ??= new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' })).format(v));
const MINUS = '−';
const sgn = (v, d = 2, suf = '') => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? MINUS : ''}${nf(Math.abs(v), d)}${suf}`);
const pc = (v, d = 2) => sgn(v, d, ' %');
const dir = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'dim');
const pxd = (v) => (Math.abs(v) >= 1000 ? 1 : Math.abs(v) >= 10 ? 2 : 4);
const px = (v) => nf(v, pxd(v));
const fTime = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fClock = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fUtc = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
const fDay = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fShort = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: 'numeric', month: 'short' });
const fLong = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const dayKey = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(t);
const dLabel = (d) => fShort.format(new Date(d + 'T12:00:00Z'));
const dLabelY = (d) => fLong.format(new Date(d + 'T12:00:00Z'));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
const until = (t) => { const s = Math.max(0, Math.round((t - Date.now()) / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(x).padStart(2, '0')} s`; };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const MONTHS = 'Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic'.split(' ');
const ES_EVENTS = {
  'Core CPI m/m': 'IPC subyacente m/m', 'CPI m/m': 'IPC m/m', 'CPI y/y': 'IPC a/a', 'Core CPI y/y': 'IPC subyacente a/a', 'Non-Farm Employment Change': 'Nóminas no agrícolas', 'Unemployment Rate': 'Tasa de paro',
  'Unemployment Claims': 'Peticiones de desempleo', 'Retail Sales m/m': 'Ventas minoristas m/m', 'Core Retail Sales m/m': 'Ventas minoristas subyacentes m/m', 'PPI m/m': 'IPP m/m', 'Core PPI m/m': 'IPP subyacente m/m',
  'Federal Funds Rate': 'Tipo de la Fed', 'FOMC Statement': 'Comunicado del FOMC', 'FOMC Press Conference': 'Rueda de prensa del FOMC', 'FOMC Meeting Minutes': 'Actas del FOMC', 'Core PCE Price Index m/m': 'PCE subyacente m/m',
  'Advance GDP q/q': 'PIB avance t/t', 'Prelim GDP q/q': 'PIB preliminar t/t', 'Final GDP q/q': 'PIB final t/t', 'GDP q/q': 'PIB t/t', 'ISM Manufacturing PMI': 'ISM manufacturero', 'ISM Services PMI': 'ISM servicios',
  'JOLTS Job Openings': 'Ofertas de empleo JOLTS', 'ADP Non-Farm Employment Change': 'Empleo ADP', 'Prelim UoM Consumer Sentiment': 'Confianza Univ. Michigan (prel.)', 'Main Refinancing Rate': 'Tipo del BCE',
  'Monetary Policy Statement': 'Comunicado de política monetaria', 'Philly Fed Manufacturing Index': 'Índice manufacturero de Filadelfia', 'Empire State Manufacturing Index': 'Índice manufacturero de Nueva York',
  'Building Permits': 'Permisos de construcción', 'Housing Starts': 'Viviendas iniciadas', 'Existing Home Sales': 'Venta de viviendas usadas', 'New Home Sales': 'Venta de viviendas nuevas', 'Durable Goods Orders m/m': 'Pedidos de bienes duraderos m/m',
  'Trade Balance': 'Balanza comercial', 'Flash Manufacturing PMI': 'PMI manufacturero (avance)', 'Flash Services PMI': 'PMI de servicios (avance)', 'Crude Oil Inventories': 'Inventarios de crudo',
  'Industrial Production m/m': 'Producción industrial m/m', 'Average Hourly Earnings m/m': 'Salario por hora m/m', 'German ZEW Economic Sentiment': 'ZEW alemán', 'CPI Flash Estimate y/y': 'IPC zona euro (avance) a/a',
};
const evName = (t) => ES_EVENTS[t] ?? t.replace(/^(.*) Speaks$/, 'Habla $1').replace('Fed Chairman', 'el presidente de la Fed').replace('Fed Chair', 'el presidente de la Fed').replace('ECB President', 'la presidenta del BCE');
const ARROW_UP = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 12 12 3M6 3h6v6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const ARROW_DN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4l9 9M6 13h6V7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

// ---------- data ----------
function setLive(ok, t) {
  const l = $('#live');
  const old = ok && Date.now() - t > 20 * 6e4;
  l.className = `age ${ok ? (old ? 'old' : 'ok') : 'old'}`;
  l.textContent = ok ? `Datos ${fTime.format(t)}` : 'Sin conexión';
}
// '' on Cloudflare, '/aureo' when served from a subfolder (GitHub Pages): app paths stay '/oro', URLs get the prefix
const BASE = new URL('.', document.currentScript?.src ?? location.href).pathname.replace(/\/$/, '');
async function api(path, opts) {
  let r;
  try { r = await fetch(BASE + path, opts); } catch { setLive(false); throw new Error('sin conexión'); }
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (!j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  if (j.at) setLive(true, j.at);
  return j;
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

// ---------- page lifecycle ----------
let cleanups = [];
const onLeave = (fn) => cleanups.push(fn);
const every = (ms, fn) => { const id = setInterval(() => !document.hidden && fn(), ms); onLeave(() => clearInterval(id)); };

const help = (text) => `<button class="info" type="button" data-how aria-expanded="false" aria-label="Cómo leer esto" title="Cómo leer esto"><i class="ph ph-info"></i></button><p class="help" hidden>${text}</p>`;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-how]');
  if (!b) return;
  const p = b.nextElementSibling;
  if (p?.classList.contains('help')) { p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); }
});
// every panel title carries an icon tile; panels that don't pass one take it from here
const PANEL_ICONS = {
  'g-tech': 'ph-chart-line', 'g-vol': 'ph-wave-sine', 'g-garch': 'ph-function', 'g-hmm': 'ph-graph', 'g-hist': 'ph-chart-bar',
  'g-dd': 'ph-trend-down', 'g-var': 'ph-warning-diamond', 'g-fan': 'ph-fan', 'g-vq': 'ph-gauge', 'g-vqp': 'ph-chart-pie-slice', 'g-vqd': 'ph-chart-line', 'g-vqc': 'ph-check-circle', 'g-pmap': 'ph-target', 'g-hz': 'ph-arrows-out-line-vertical', 'g-chk': 'ph-check-circle',
  'g-cot': 'ph-users-three', 'g-gld': 'ph-vault', 'g-m6': 'ph-bank', 'g-m2': 'ph-gauge', 'g-m7': 'ph-currency-dollar',
  'g-m8': 'ph-buildings', 'g-fv': 'ph-scales', 'g-cr': 'ph-link', 'g-cur': 'ph-currency-circle-dollar', 'g-cm': 'ph-grid-four',
  'mk-heat': 'ph-squares-four', 'mk-sc': 'ph-chart-scatter', 'mk-corr': 'ph-grid-four',
  'a-px': 'ph-chart-line', 'a-st': 'ph-list-numbers', 'a-sea': 'ph-calendar', 'a-cot': 'ph-users-three',
  'ag': 'ph-calendar-blank', 'ag-r': 'ph-lightning', 'j-st': 'ph-target', 'j-list': 'ph-notebook', 'me-bt': 'ph-flask',
};
// icon tile colour by kind of content: charts, data, plan, risk, news and agenda, positioning
const PANEL_KIND = {
  chart: ['t-chart', 'g-vqd', 'g-tech', 'g-vol', 'g-hist', 'g-fan', 'g-fv', 'g-m7', 'g-m8', 'a-px', 'a-sea', 'mk-sc'],
  data: ['t-lv', 'g-vq', 'g-vqp', 'g-vqc', 'g-garch', 'g-pmap', 'g-hz', 'g-chk', 'g-cr', 'g-cm', 'g-m6', 'g-m2', 'a-st', 'mk-heat', 'mk-corr', 'me-bt'],
  plan: ['t-scn', 't-plan', 't-fac', 'j-st', 'j-list'],
  risk: ['t-risk', 'g-var', 'g-dd', 'g-hmm'],
  news: ['t-ev', 't-news', 'ag', 'ag-r'],
  flow: ['g-cot', 'g-gld', 'a-cot'],
};
const kindOf = (id) => Object.keys(PANEL_KIND).find((k) => PANEL_KIND[k].includes(id)) ?? 'data';
const panel = (id, title, aside = '', cls = 'c12', body = '<div class="skeleton"></div>', icon = PANEL_ICONS[id] ?? '') =>
  `<section class="panel ${cls}" id="${id}" aria-labelledby="${id}-h"><div class="panel-h"><h2 id="${id}-h">${icon ? `<i class="ph ${icon} k-${kindOf(id)}" aria-hidden="true"></i>` : ''}${title}</h2><span class="aside">${aside}</span></div><div class="pb">${body}</div></section>`;
const fill = (id, html) => { const el = document.getElementById(id); if (el) $('.pb', el).innerHTML = html; return el; };
const fail = (id, e) => fill(id, `<p class="err">No se pudo cargar: ${esc(e.message)}. Se reintenta en el próximo refresco.</p>`);
const ro = (label, value, small = '', cls = '') => `<div class="ro"><span>${label}</span><b class="${cls}">${value}</b>${small ? `<small>${small}</small>` : ''}</div>`;
const ecam = (label, text) => `<div class="ecam"><b><i class="ph ph-lightbulb" aria-hidden="true"></i>${label}</b><span>${esc(text)}</span></div>`;

// ---------- SVG charts ----------
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function ticks(min, max, n = 4) { const st = niceStep((max - min) / n || 1); const out = []; for (let v = Math.ceil(min / st) * st; v <= max + 1e-9; v += st) out.push(v); return out; }
const legend = (series) => (series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i class="${s.dash ? 'dash' : ''}" style="background:${s.color};color:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>` : '');
const roundedBar = (x, y0, y, w, r) => {
  const h = Math.abs(y - y0), rr = Math.min(r, h, w / 2), up = y < y0;
  if (h < 0.5) return `M${x},${y0}h${w}`;
  return up
    ? `M${x},${y0}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y0}Z`
    : `M${x},${y0}V${y - rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y - rr}V${y0}Z`;
};

// data: [{x, ...}]; series: [{key,label,color,dash}]; bands: [{lo,hi,color,alpha}]; kind 'line' | 'bar'
function chart(el, o) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const tip = Object.assign(document.createElement('div'), { className: 'tip' });
  const sr = Object.assign(document.createElement('table'), { className: 'sr' });
  el.replaceChildren(svg, tip, sr);
  el.tabIndex = 0;
  el.setAttribute('role', 'img');
  if (o.label) el.setAttribute('aria-label', o.label + '. Flechas para recorrer los valores.');
  const data = o.data, series = o.series, kind = o.kind ?? 'line', bands = o.bands ?? [], marks = o.marks ?? [];
  const fmtY = o.fmtY ?? ((v) => nf(v, 2)), fmtX = o.fmtX ?? ((x) => x);
  const PL = 4, PR = o.pr ?? 58, PT = 10, PB = 22;
  let sx, sy, W, H, idx = -1;
  sr.innerHTML = `<tr><th>Fecha</th>${series.map((s) => `<th>${esc(s.label)}</th>`).join('')}</tr>` + data.slice(-24).map((d) => `<tr><td>${esc(fmtX(d.x))}</td>${series.map((s) => `<td>${esc(fmtY(d[s.key]))}</td>`).join('')}</tr>`).join('');
  function draw() {
    W = el.clientWidth; H = el.clientHeight;
    if (!W || !data.length) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
    const ys = data.flatMap((d) => [...series.map((s) => d[s.key]), ...bands.flatMap((b) => [d[b.lo], d[b.hi]])]).concat(marks.map((m) => m.y)).filter((v) => v != null && isFinite(v));
    let min = Math.min(...ys), max = Math.max(...ys);
    if (o.zero || kind === 'bar') { min = Math.min(0, min); max = Math.max(0, max); }
    if (o.min != null) min = o.min;
    if (o.max != null) max = o.max;
    const pad = (max - min) * 0.06 || 1;
    if (o.min == null && !(kind === 'bar' && min === 0)) min -= pad;
    if (o.max == null) max += pad;
    const iw = W - PL - PR, ih = H - PT - PB, n = data.length;
    sx = (i) => PL + (kind === 'bar' ? ((i + 0.5) / n) * iw : n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    sy = (v) => PT + ih - ((v - min) / (max - min || 1)) * ih;
    let h = '';
    for (const t of ticks(min, max)) h += `<line class="grid-l" x1="${PL}" x2="${W - PR + 4}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${W - PR + 8}" y="${sy(t) + 4}">${esc(fmtY(t))}</text>`;
    if (min < 0 && max > 0) h += `<line class="base-l" x1="${PL}" x2="${W - PR + 4}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    for (const m of marks) h += `<line class="mark-l" x1="${PL}" x2="${W - PR + 4}" y1="${sy(m.y)}" y2="${sy(m.y)}"/><text x="${PL + 4}" y="${sy(m.y) - 5}">${esc(m.label)}</text>`;
    const xn = Math.min(kind === 'bar' && n <= 13 ? n : W < 480 ? 3 : 5, n);
    for (let k = 0; k < xn; k++) {
      const i = Math.round((k / Math.max(1, xn - 1)) * (n - 1));
      const anchor = kind === 'bar' ? 'middle' : k === 0 ? 'start' : k === xn - 1 ? 'end' : 'middle';
      h += `<text x="${sx(i)}" y="${H - 6}" text-anchor="${anchor}">${esc(fmtX(data[i].x))}</text>`;
    }
    for (const b of bands) {
      const pts = data.map((d, i) => (d[b.lo] != null && d[b.hi] != null ? [sx(i), sy(d[b.hi]), sy(d[b.lo])] : null)).filter(Boolean);
      if (pts.length) h += `<path fill="${b.color}" fill-opacity="${b.alpha ?? 0.15}" d="M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}L${pts.reverse().map((p) => `${p[0].toFixed(1)},${p[2].toFixed(1)}`).join('L')}Z"/>`;
    }
    if (kind === 'bar') {
      const s = series[0], bw = Math.max(1, Math.min(28, iw / n - 2)), y0 = sy(0);
      data.forEach((d, i) => {
        const v = d[s.key];
        if (v == null || !isFinite(v)) return;
        const color = d.color ?? (o.diverging ? (v >= 0 ? 'var(--up)' : 'var(--down)') : s.color);
        h += `<path fill="${color}" d="${roundedBar(sx(i) - bw / 2, y0, sy(v), bw, 3)}"/>`;
      });
      for (const s2 of series.slice(1)) h += `<path class="ln" stroke="${s2.color}" ${s2.dash ? 'stroke-dasharray="4 3" stroke-width="1.5"' : ''} d="${data.map((d, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(d[s2.key]).toFixed(1)}`).join('')}"/>`;
    } else {
      for (const s of series) {
        let d = '', pen = false;
        data.forEach((p, i) => { const v = p[s.key]; if (v == null || !isFinite(v)) { pen = false; return; } d += `${pen ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`; pen = true; });
        h += `<path class="ln" stroke="${s.color}" ${s.dash ? 'stroke-dasharray="4 3" stroke-width="1.5"' : ''} d="${d}"/>`;
      }
    }
    h += `<g class="xh-g" visibility="hidden"><line class="xh" y1="${PT}" y2="${PT + ih}"/>${series.map((s) => `<circle class="dot" r="4" fill="${s.color}"/>`).join('')}</g><rect class="hit" x="0" y="0" width="${W}" height="${H}"/>`;
    svg.innerHTML = h;
    if (idx >= 0) show(idx);
  }
  function show(i) {
    if (!data.length || !sx) return;
    idx = Math.max(0, Math.min(data.length - 1, i));
    const d = data[idx], g = svg.querySelector('.xh-g'), x = sx(idx);
    g.setAttribute('visibility', 'visible');
    const ln = g.querySelector('line'); ln.setAttribute('x1', x); ln.setAttribute('x2', x);
    $$('circle', g).forEach((c, k) => { const v = d[series[k].key]; c.setAttribute('cx', x); c.setAttribute('cy', v == null ? -99 : sy(v)); c.setAttribute('visibility', v == null || kind === 'bar' ? 'hidden' : 'visible'); });
    tip.innerHTML = o.tip ? o.tip(d) : `<div class="dim">${esc(fmtX(d.x))}</div>${series.map((s) => `<div><span class="k" style="background:${s.color}"></span>${esc(s.label)} <b>${esc(fmtY(d[s.key]))}</b></div>`).join('')}`;
    tip.classList.add('on');
    const tw = tip.offsetWidth;
    const ty = Math.min(...series.map((s) => (d[s.key] == null ? H : sy(d[s.key]))));
    tip.style.transform = `translate(${Math.min(Math.max(0, x - tw / 2), W - tw)}px, ${Math.max(-8, ty - tip.offsetHeight - 12)}px)`;
  }
  function hide() { idx = -1; tip.classList.remove('on'); svg.querySelector('.xh-g')?.setAttribute('visibility', 'hidden'); }
  const at = (e) => { const r = svg.getBoundingClientRect(); const f = (e.clientX - r.left - PL) / (W - PL - PR); return kind === 'bar' ? Math.floor(f * data.length) : Math.round(f * (data.length - 1)); };
  el.onpointermove = (e) => show(at(e));
  el.onpointerdown = (e) => show(at(e));
  el.onpointerleave = hide;
  el.onblur = hide;
  el.onkeydown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = idx < 0 ? data.length - 1 : idx;
    show(e.key === 'Home' ? 0 : e.key === 'End' ? data.length - 1 : i + (e.key === 'ArrowLeft' ? -1 : 1));
  };
  const ro_ = new ResizeObserver(draw);
  ro_.observe(el);
  onLeave(() => ro_.disconnect());
}

// kind 'dir' = returns (up/down), 'corr' = correlation (cyan/magenta series inks, so it never reads as good/bad)
const heatBg = (v, max, kind = 'dir') => {
  if (v == null || !isFinite(v) || !max) return '';
  const a = Math.min(1, Math.abs(v) / max) * 45;
  const c = kind === 'corr' ? (v >= 0 ? 's2' : 's3') : v >= 0 ? 'up' : 'down';
  return `background:color-mix(in srgb, var(--${c}) ${a.toFixed(0)}%, transparent)`;
};

// ---------- candles (lightweight-charts) ----------
const madridTick = (t, type) => (type < 3 ? fShort.format(new Date(t * 1000)) : fTime.format(new Date(t * 1000)));
function lwc(el, extra = {}) {
  return LightweightCharts.createChart(el, {
    autoSize: true,
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: css('--ink-3'), fontFamily: "'SF Mono', 'Cascadia Mono', Consolas, monospace", fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, tickMarkFormatter: madridTick },
    localization: { locale: 'es-ES', timeFormatter: (t) => `${fShort.format(new Date(t * 1000))} ${fTime.format(new Date(t * 1000))}`, priceFormatter: (p) => nf(p, 1) },
    crosshair: { mode: 0, vertLine: { color: 'rgba(255,255,255,0.3)', labelBackgroundColor: '#2a2c34' }, horzLine: { color: 'rgba(255,255,255,0.3)', labelBackgroundColor: '#2a2c34' } },
    // the wheel scrolls the page, not the chart; drag and pinch still pan and zoom
    handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: { time: true, price: !extra.fixedPrice } },
    ...extra.opts,
  });
}
const candleStyle = () => ({ upColor: css('--up'), downColor: css('--down'), borderVisible: false, wickUpColor: css('--up'), wickDownColor: css('--down') });
function candles(el, { bars, overlays = [] }) {
  if (!window.LightweightCharts) { el.innerHTML = '<p class="err">No cargó la librería de gráficos.</p>'; return null; }
  el.innerHTML = '';
  const c = lwc(el);
  const s = c.addCandlestickSeries({ ...candleStyle(), priceLineColor: css('--ink-2') });
  s.setData(bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
  for (const ov of overlays) c.addLineSeries({ color: ov.color, lineWidth: ov.width ?? 1, lineStyle: ov.dash ? 2 : 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(ov.data);
  c.timeScale().fitContent();
  onLeave(() => c.remove());
  return { chart: c, series: s };
}

// ---------- router ----------
const ROUTES = [
  ['/', 'Hoy', () => pageToday, 'ph-sun-horizon'],
  ['/oro', 'Oro', () => pageGold, 'ph-chart-line-up'],
  ['/mercados', 'Mercados', () => pageMarkets, 'ph-squares-four'],
  ['/agenda', 'Agenda', () => pageAgenda, 'ph-calendar-blank'],
  ['/diario', 'Diario', () => pageJournal, 'ph-notebook'],
  ['/metodo', 'Método', () => pageMethod, 'ph-book-open-text'],
];
$('#nav').innerHTML = ROUTES.map(([p, l, , i]) => `<a href="${p}" data-link><i class="ph ${i}" aria-hidden="true"></i>${l}</a>`).join('');
$('#tabbar').innerHTML = ROUTES.slice(0, 5).map(([p, l, , i]) => `<a href="${p}" data-link><i class="ph ${i}" aria-hidden="true"></i>${l}</a>`).join('');
function setTopPrice(price, d1) {
  $('#tp').innerHTML = `<span class="${dir(d1)}">${nf(price, 2)}</span>`;
  $('#tp-side').textContent = nf(price, 2);
  $('#tp-side-chg').innerHTML = `<span class="${dir(d1)}">${pc(d1)} hoy</span>`;
}

function render() {
  cleanups.forEach((f) => { try { f(); } catch { /* already gone */ } });
  cleanups = [];
  const path = location.pathname.slice(BASE.length).replace(/\/+$/, '') || '/';
  const view = $('#view');
  view.innerHTML = '';
  const a = path.match(/^\/a\/([^/]+)$/);
  const route = ROUTES.find(([p]) => p === path);
  const navKey = route ? route[0] : a ? '/mercados' : '/';
  $$('[data-link]').forEach((x) => x.removeAttribute('aria-current'));
  $$(`#nav a[href="${navKey}"], #tabbar a[href="${navKey}"]`).forEach((x) => x.setAttribute('aria-current', 'page'));
  if (a) pageAsset(view, decodeURIComponent(a[1]).toUpperCase());
  else if (route) route[2]()(view);
  else view.innerHTML = '<div class="page-head"><div><h1>No existe esta página</h1><p><a href="/" data-link>Volver a Hoy</a></p></div></div>';
  document.title = (a ? decodeURIComponent(a[1]).toUpperCase() : route?.[1] ?? 'Aureo') + ' · Aureo';
}
function go(path) { if (BASE + path !== location.pathname + location.hash) history.pushState(null, '', BASE + path); render(); window.scrollTo(0, 0); $('#view').focus({ preventScroll: true }); }
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || a.target) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});
addEventListener('popstate', render);

$$('[data-palette]').forEach((b) => {
  b.setAttribute('aria-pressed', String(document.documentElement.dataset.palette === 'cvd'));
  b.textContent = document.documentElement.dataset.palette === 'cvd' ? 'Sí' : 'No';
  b.addEventListener('click', () => {
    const on = document.documentElement.dataset.palette !== 'cvd';
    if (on) document.documentElement.dataset.palette = 'cvd'; else delete document.documentElement.dataset.palette;
    try { localStorage.setItem('lg.palette', on ? 'cvd' : ''); } catch { /* ignore */ }
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'Sí' : 'No';
    render();
  });
});
// sidebar / top bar price on every page
const refreshTop = () => api('/api/m/today').then((j) => setTopPrice(j.data.price, j.data.d1)).catch(() => {});
refreshTop();
setInterval(() => !document.hidden && refreshTop(), 60e3);
const tick = () => {
  $('#clock').textContent = fClock.format(Date.now());
  $$('[data-until]').forEach((el) => (el.textContent = until(+el.dataset.until)));
};
tick();
setInterval(tick, 1000);

// =====================================================================
// HOY · the session plan, in three sections
// =====================================================================
const FACTOR_HELP = 'Seis factores de −2 a +2: a la derecha empujan al oro hacia arriba, a la izquierda hacia abajo. Rayada: el factor va en contra del total. Son motores de semanas, así que su acierto se mide a 20 sesiones, sin solapar ventanas, de 2021 a hoy, frente a la base (lo que acertaría quien apuesta en la misma proporción sin mirarlo). Se quitaron el COT a la contra, el valor macro y la estacionalidad porque perdían frente a la base en los dos periodos.';
const SCN_HELP = 'Reglas: la activación es el nivel más cercano con peso 3 o más y a más de 0,3 ATR del precio; la invalidación queda a 0,25 ATR (1 R) y el objetivo, en el siguiente nivel que pague al menos 1,5 R. "Llega a la activación hoy" usa la volatilidad prevista (GARCH) para lo que queda de sesión. "Objetivo antes que stop" es, una vez activado, la probabilidad de que un paseo aleatorio toque el objetivo antes que la invalidación: con ella la esperanza sale cero, así que la ventaja solo existe si el nivel aguanta de verdad (mira la tabla de Niveles).';
const CHART_HELP = 'Velas de 15 minutos del futuro GC trasladadas a contado. Líneas doradas: niveles calculados (continuas las fuertes). Líneas azules: tu plan. Líneas verdes punteadas: movimiento esperado hoy (±1 desviación) desde la apertura.';

const SHORT = [
  [/^Máximo de ayer/, 'Máx. ayer'], [/^Mínimo de ayer/, 'Mín. ayer'], [/^Cierre de ayer/, 'Cierre ayer'], [/^Apertura semanal/, 'Apert. semana'], [/^Apertura mensual/, 'Apert. mes'],
  [/^Máximo de Asia/, 'Máx. Asia'], [/^Mínimo de Asia/, 'Mín. Asia'], [/^Zona de giro \((\d+) toques?\)/, 'Giro ×$1'], [/^([+−]\S+) ATR.*/, '$1 ATR'], [/^Número redondo/, 'Redondo'], [/^1 ATR más allá/, '1 ATR'],
];
const shortLabel = (l) => { for (const [re, s] of SHORT) if (re.test(l)) return l.replace(re, s).replace(/\s*\(en curso\)/, ''); return l.slice(0, 14); };

// 15-minute chart with the native, narrow price axis (TradingView style); fixed height, so it never grows
function makeChart15(el) {
  const c = lwc(el, { opts: { rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.08 }, minimumWidth: 64 } } });
  const s = c.addCandlestickSeries({ ...candleStyle(), priceLineColor: css('--ink-2'), priceLineStyle: 2 });
  let lines = [], levelLines = [], fitted = false;
  onLeave(() => c.remove());
  return {
    update(d, plan) {
      s.setData(d.bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
      lines.forEach((l) => s.removePriceLine(l));
      lines = [];
      const near = (p) => Math.abs(p - d.price) <= 1.6 * d.atr;
      levelLines = d.levels.map((l) => (near(l.p) ? s.createPriceLine({ price: l.p, color: l.strong ? css('--gold') : 'rgba(230,180,80,.55)', lineWidth: 1, lineStyle: l.strong ? 0 : 2, axisLabelVisible: true, title: shortLabel(l.labels[0]) }) : null));
      lines.push(...levelLines.filter(Boolean));
      const open = d.bars.find((b) => b.t * 1000 >= d.session.start)?.o;
      if (open) for (const k of [1, -1]) lines.push(s.createPriceLine({ price: open + k * d.risk.sigma, color: 'rgba(48,209,88,.6)', lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: k > 0 ? '+1σ' : '−1σ' }));
      if (plan?.entry) lines.push(s.createPriceLine({ price: plan.entry, color: css('--blue'), lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: 'Entrada' }));
      if (plan?.invalid) lines.push(s.createPriceLine({ price: plan.invalid, color: css('--blue'), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Invalida' }));
      if (!fitted) { c.timeScale().fitContent(); fitted = true; }
    },
    setHot(i) { levelLines.forEach((l, k) => l?.applyOptions({ lineWidth: k === i ? 3 : 1 })); },
  };
}

function pageToday(view) {
  view.innerHTML = `
    <div class="page-head"><div><h1>Hoy</h1><p id="t-sub">Plan de la sesión del oro.</p></div><span class="meta" id="t-meta"></span></div>
    <div class="section first"><h2>Mercado ahora</h2></div>
    <div class="tiles" id="t-tiles" aria-label="Estado de la sesión">${'<div class="tile"><div class="skeleton" style="height:52px"></div></div>'.repeat(5)}</div>
    <div class="grid">
      ${panel('t-chart', 'XAU/USD · 15 min', 'contado', 'c8', `${help(CHART_HELP)}<div class="chart15" id="t-lwc"></div><div class="chart-stats" id="t-foot"></div>`, 'ph-chart-line')}
      ${panel('t-lv', 'Niveles del día', '', 'c4', undefined, 'ph-stack')}
    </div>
    <div class="section"><h2>Plan del día</h2></div>
    <div class="grid">
      <div class="c5 stack">
        ${panel('t-scn', 'Escenarios', 'probabilidad de tocar hoy', 'c12', undefined, 'ph-path')}
        ${panel('t-plan', 'Mi plan', '', 'c12', undefined, 'ph-note-pencil')}
      </div>
      ${panel('t-fac', 'Balanza de factores', '', 'c7', undefined, 'ph-scales')}
    </div>
    <div class="section"><h2>Riesgo y agenda</h2></div>
    <div class="grid">
      ${panel('t-risk', 'Riesgo de hoy', '', 'c4', undefined, 'ph-shield-warning')}
      ${panel('t-ev', 'Datos de hoy', '', 'c4', undefined, 'ph-calendar-dots')}
      ${panel('t-news', 'Titulares', 'por relevancia', 'c4', undefined, 'ph-newspaper')}
    </div>
    <p class="disclaimer">Información para preparar tu sesión. No es asesoramiento ni una recomendación de compra o venta. Algunos mercados llegan con retraso.</p>`;
  let first = true, ch = null, plan = null, basisNow = 0;
  const hotAll = (i) => { ch?.setHot(i); $$('#t-lv tr[data-i]').forEach((tr) => tr.classList.toggle('on', +tr.dataset.i === i)); };
  const load = async () => {
    try {
      const j = await api('/api/m/today');
      const d = j.data;
      try { plan = JSON.parse(d.plan?.levels || '{}'); } catch { plan = {}; }
      basisNow = d.basis ?? 0;
      $('#t-sub').textContent = `Sesión del ${fDay.format(new Date(d.session.date + 'T12:00:00Z'))}.`;
      $('#t-meta').textContent = `Actualizado a las ${fTime.format(j.at)}`;
      setTopPrice(d.price, d.d1);
      tiles(d);
      foot(d);
      factors(d);
      scen(d);
      levels(d);
      risk(d);
      events(d);
      news(d);
      if (first) { ch = window.LightweightCharts ? makeChart15($('#t-lwc')) : null; plan_(d); first = false; }
      ch?.update(d, plan);
    } catch (e) {
      ['t-fac', 't-scn', 't-lv', 't-risk', 't-ev', 't-news'].forEach((id) => fail(id, e));
    }
  };
  function tiles(d) {
    const stale = d.spot && Date.now() - d.spot.at > 20 * 6e4;
    const f = d.factors, sig = d.backtest?.total?.signal, nr = d.nextRed, soon = nr && nr.t - Date.now() < 15 * 6e4;
    $('#t-tiles').innerHTML = `
      <div class="tile price"><span><i class="ph ph-coins"></i>Oro al contado</span><b>${nf(d.price, 2)}<span class="chg ${dir(d.d1)}">${pc(d.d1)}</span></b><small>${d.spot ? `${esc(d.spot.src.split(' (')[0])} · ${fTime.format(d.spot.at)}${stale ? ' · <span class="caut">retrasado</span>' : ''}` : 'futuro GC, sin contado'}</small></div>
      <div class="tile"><span><i class="ph ph-clock"></i>Sesión</span><b>${d.closed ? '<span class="caut">Cerrado</span>' : esc(d.session.current ?? '—')}</b><small>${d.closed ? 'mercado cerrado' : `quedan ${until(d.session.end)}`}</small></div>
      <div class="tile"><span><i class="ph ph-waveform"></i>Volatilidad</span><b class="${d.risk.volPct > 80 ? 'caut' : ''}">Percentil ${nf(d.risk.volPct, 0)}</b><small title="Volatilidad prevista (GARCH) frente al último año; GVZ = implícita de las opciones">del año · GARCH ${nf(d.risk.garchAnn, 1)} % · GVZ ${nf(d.risk.gvz, 0)} %</small></div>
      <div class="tile"><span><i class="ph ph-scales"></i>Balanza</span><b class="${dir(f?.total)}">${f ? `${f.total > 0 ? '+' : f.total < 0 ? MINUS : ''}${Math.abs(f.total)} de ±${f.max}` : '—'}</b><small class="${sig ? 'up' : 'caut'}">${sig ? 'señal medida' : 'confluencia, no señal'}</small></div>
      <div class="tile"><span><i class="ph ph-bell-ringing"></i>Próximo dato rojo</span><b class="${soon ? 'warn' : nr ? 'caut' : 'up'}">${nr ? esc(evName(nr.title)) : 'Ninguno'}</b><small>${nr ? `${fTime.format(nr.t)} · en <span data-until="${nr.t}">${until(nr.t)}</span>` : 'sin datos de impacto alto'}</small></div>`;
  }
  function foot(d) {
    $('#t-foot').innerHTML = `
      ${ro('Rango de hoy', `${nf(d.range, 1)} $`, `${nf(d.rangeAtr, 0)} % del ATR`)}
      ${ro('Movimiento esperado', `±${nf(d.risk.sigma, 0)} $`, `${d.risk.volSrc}, un día`)}
      ${ro('Cierre de ayer', nf(d.prevClose, 1), `${pc(d.d1)} desde entonces`)}
      ${ro('Base futuro − contado', sgn(d.basis, 1, ' $'), 'ya restada a los niveles')}`;
  }
  function factors(d) {
    const f = d.factors, bt = d.backtest;
    if (!f) return fill('t-fac', '<p class="empty">Sin datos suficientes.</p>');
    const hit = (k) => { const v = k === 'total' ? bt?.total : bt?.factors?.[k], o = v?.oos; return o?.hit20 != null ? `<span title="Acierto a 20 sesiones de 2021 a hoy frente a su base (${o.n20} ventanas sin solapar)"${v.signal ? ' class="up"' : ''}>${nf(o.hit20, 0)} / ${nf(o.base20, 0)} %</span>` : ''; };
    const gauge = (s, max, against) => {
      const pos = ((s + max) / (2 * max)) * 100;
      const fillCss = s > 0 ? `left:50%;width:${pos - 50}%` : `left:${pos}%;width:${50 - pos}%`;
      return `<div class="gauge" aria-hidden="true"><i class="tk c"></i>${s ? `<i class="fill ${s > 0 ? 'pos' : 'neg'}${against ? ' x' : ''}" style="${fillCss}"></i>` : ''}</div>`;
    };
    const head = `<div class="srow head" aria-hidden="true"><span class="name">Factor</span><span class="gauge-h"><span>Baja</span><span>Sube</span></span><span class="score">Punt.</span><span class="hit">20 ses. / base</span></div>`;
    const rows = f.list.map((x) => {
      const against = x.score && f.total && Math.sign(x.score) !== Math.sign(f.total);
      return `<div class="srow" role="listitem" title="${esc(x.what)}"><span class="name">${esc(x.label)}</span>${gauge(x.score, 2, against)}<span class="score ${dir(x.score)}">${x.score === 0 ? '0' : sgn(x.score, 0)}</span><span class="hit">${hit(x.k)}</span><span class="why">${esc(x.why)}${against ? ' · va en contra del total' : ''}</span></div>`;
    }).join('');
    const tot = `<div class="srow total" role="listitem"><span class="name">Total</span>${gauge(f.total, f.max)}<span class="score ${dir(f.total)}">${f.total === 0 ? '0' : sgn(f.total, 0)}</span><span class="hit">${hit('total')}</span><span class="why">de ±${f.max}; cuenta como inclinado desde ±${bt?.totalMin ?? 3}</span></div>`;
    const o = bt?.total?.oos;
    const v = !bt ? '<p class="verdict"><b>Sin backtest.</b> Ejecuta <code>npm run factors</code>.</p>'
      : bt.total.signal ? `<p class="verdict sig"><b>Señal.</b> El total superó a su base dentro y fuera de muestra (${nf(o.hit1, 1)} % frente a ${nf(o.base1, 1)} %).</p>`
        : `<p class="verdict"><b>Confluencia, no señal.</b> De 2021 a hoy, a 20 sesiones, el total acertó el ${nf(o.hit20, 1)} % de ${o.n20} ventanas frente a una base del ${nf(o.base20, 1)} %.${Object.entries(bt.factors).filter(([, v]) => v.signal).length ? ` Solo ${Object.entries(bt.factors).filter(([, v]) => v.signal).map(([k]) => f.list.find((x) => x.k === k)?.label ?? k).join(' y ')} supera a su base en los dos periodos, con pocas ventanas.` : ''} Dice qué empuja al oro estas semanas, no cuándo entrar.</p>`;
    fill('t-fac', `${help(FACTOR_HELP)}<div class="sys" role="list">${head}${rows}${tot}</div>${v}`);
    $('#t-fac .aside').textContent = `cierre del ${dLabel(d.factorDate)}`;
  }
  function scen(d) {
    const s = d.scenarios;
    const leg = (x, up) => !x ? `<div class="leg"><h3>${up ? 'Ruptura al alza' : 'Ruptura a la baja'}</h3><p class="empty">Sin escenario: no hay un nivel con peso a más de 0,3 ATR por ${up ? 'arriba' : 'abajo'}.</p></div>` : `
      <div class="leg ${up ? 'up' : 'down'}"><h3><span class="${up ? 'up' : 'down'}">${up ? ARROW_UP : ARROW_DN}</span>${up ? 'Ruptura al alza' : 'Ruptura a la baja'}</h3>
        <dl>
          <dt>Se activa</dt><dd><b class="tgt">${up ? '>' : '<'} ${nf(x.trigger, 1)}</b><small>cierre de 15 min · ${esc(x.triggerWhy.join(' · '))}</small></dd>
          <dt>Objetivo</dt><dd><b class="tgt">${nf(x.target, 1)}</b> <span class="dim">${sgn(x.target - x.trigger, 1, ' $')}</span><small>${esc(x.targetWhy.join(' · '))}</small></dd>
          <dt>Invalidación</dt><dd><b>${up ? '<' : '>'} ${nf(x.invalid, 1)}</b><small>riesgo/beneficio 1 : ${nf(x.rr, 1)}</small></dd>
        </dl>
        <div class="p"><span class="pill dim" title="Probabilidad de que el precio llegue hoy a la activación">Llega a la activación hoy ${nf(x.pTrigger, 0)} %</span><span class="pill ${up ? 'up' : 'down'}" title="Una vez activado: probabilidad de tocar el objetivo antes que la invalidación">Objetivo antes que stop ${nf(x.pWin, 0)} %</span></div>
      </div>`;
    const evRed = d.events.filter((e) => e.impact === 'High' && e.t > Date.now());
    const rng = !s.up && !s.down ? '<p class="range-note">El precio está en mitad de su rango, lejos de niveles con peso. Hoy no hay escenario que merezca la pena.</p>' : s.range ? `<p class="range-note">Entre <b class="tgt">${nf(s.range.lo, 1)}</b> y <b class="tgt">${nf(s.range.hi, 1)}</b> (${nf(s.range.width, 0)} $) es rango, sin ventaja para ningún lado.${evRed.length ? ` <span class="caut">${esc(evName(evRed[0].title))} a las ${fTime.format(evRed[0].t)} suele romperlo.</span>` : ''}</p>` : '';
    fill('t-scn', `${help(SCN_HELP)}<div class="fpln">${leg(s.up, true)}${leg(s.down, false)}${rng}</div>`);
  }
  function levels(d) {
    const rows = [];
    let placed = false;
    const now = `<tr class="lv-now"><td class="num">${nf(d.price, 1)}</td><td class="num">—</td><td>Precio ahora</td></tr>`;
    d.levels.forEach((l, i) => {
      if (!placed && l.p < d.price) { rows.push(now); placed = true; }
      rows.push(`<tr class="link ${l.strong ? 'lv-strong' : 'lv-weak'}" data-i="${i}" tabindex="0"><td class="num">${nf(l.p, 1)}</td><td class="num ${l.p > d.price ? 'up' : 'down'}">${sgn(l.p - d.price, 1)}<div class="sub">${nf(Math.abs(l.p - d.price) / d.atr, 2)} ATR</div></td><td><div class="tags">${l.labels.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div></td></tr>`);
    });
    if (!placed) rows.push(now);
    const ls = d.levelStats, lsRow = (label, x) => `<tr><td>${label}</td><td class="num">${nf(x.touch, 0)} %</td><td class="num">${x.beyond == null ? '—' : nf(x.beyond, 0) + ' %'}</td></tr>`;
    const stats = ls ? `<h3 class="h3" style="margin-top:16px">Cómo se comportan <span class="sub">desde ${dLabelY(ls.from)} · ${nf(ls.n, 0)} días</span></h3><table class="tbl"><thead><tr><th>Nivel</th><th class="num">Se toca</th><th class="num">Cierra más allá</th></tr></thead><tbody>${lsRow('Máximo de ayer', ls.pdh)}${lsRow('Mínimo de ayer', ls.pdl)}${lsRow('Máximo semana anterior', ls.pwh)}${lsRow('Mínimo semana anterior', ls.pwl)}</tbody></table><p class="sub" style="margin:6px 0 0">"Cierra más allá" cuenta solo los días que lo tocaron. Por debajo del 50 %, romperlo suele ser una trampa.</p>` : '';
    fill('t-lv', `${help('Niveles del futuro GC trasladados a contado con la base actual: máximos y mínimos de ayer, de la semana y del mes anteriores, aperturas, VWAP, rango de Asia, zonas de giro y números redondos (los de 100 $ pesan el doble que los de 50). Los que coinciden a menos de 0,15 ATR se funden en uno; en dorado intenso los que suman más peso. Pasa el ratón por una fila para resaltarla en el gráfico.')}<table class="tbl"><thead><tr><th class="num">Precio</th><th class="num">Distancia</th><th>Origen</th></tr></thead><tbody>${rows.join('')}</tbody></table>${stats}`);
    $$('#t-lv tr[data-i]').forEach((tr) => {
      const i = +tr.dataset.i;
      tr.addEventListener('pointerenter', () => hotAll(i)); tr.addEventListener('focus', () => hotAll(i));
      tr.addEventListener('pointerleave', () => hotAll(-1)); tr.addEventListener('blur', () => hotAll(-1));
    });
  }
  function risk(d) {
    const r = d.risk, used = d.rangeAtr ?? 0;
    const vp = r.volPct, regCls = vp > 80 ? 'caut' : vp < 20 ? 'up' : 'dim', reg = vp > 80 ? 'Volatilidad alta' : vp < 20 ? 'Volatilidad baja' : 'Volatilidad media';
    const stats = `
      <div class="risk-hero">
        <div><span class="lbl">Movimiento esperado hoy</span><b class="big">±${nf(r.sigma, 0)} $</b><small>${r.volSrc === 'GVZ' ? `${nf(r.gvz, 1)} % anual · implícita (GVZ), la que mejor ha acertado` : `${nf(r.garchAnn, 1)} % anual · volatilidad prevista (GARCH)`}</small></div>
        <span class="pill ${regCls}" title="Volatilidad prevista frente al último año"><i class="dot"></i>${esc(reg)}</span>
      </div>
      <div class="meter" role="meter" aria-label="Rango de hoy frente al ATR" aria-valuemin="0" aria-valuemax="150" aria-valuenow="${Math.round(used)}">
        <div class="meter-h"><span>Rango recorrido hoy</span><b>${nf(d.range, 1)} $ · ${nf(used, 0)} % del ATR</b></div>
        <div class="track"><i class="${used > 100 ? 'caut' : ''}" style="width:${Math.min(used, 150) / 1.5}%"></i><em style="left:${100 / 1.5}%"></em></div>
        <div class="track-scale"><span>0</span><span>1 ATR</span><span>1,5</span></div>
      </div>
      <div class="kpis">
        <div class="kpi"><span class="ic"><i class="ph ph-arrows-vertical"></i></span><div><span>ATR 14 días</span><b>${nf(r.atr, 1)} $</b><small>rango medio</small></div></div>
        <div class="kpi"><span class="ic caut"><i class="ph ph-warning-diamond"></i></span><div><span>VaR 95 % · 1 día</span><b>${nf(r.var95, 0)} $</b><small>ES ${nf(r.es95, 0)} $ por onza</small></div></div>
        <div class="kpi"><span class="ic ${regCls === 'up' ? 'up' : regCls}"><i class="ph ph-gauge"></i></span><div><span>Implícita (GVZ)</span><b>${nf(r.gvz, 1)} %</b><small>percentil ${nf(r.gvzPct, 0)} del año · GARCH p${nf(vp, 0)}</small></div></div>
      </div>`;
    if ($('#t-rs')) { $('#t-rs').innerHTML = stats; return; }
    fill('t-risk', `${help('Movimiento esperado: una desviación típica de la volatilidad prevista para hoy; dos de cada tres días el oro se mueve menos. La barra compara lo que ya se ha movido hoy con su rango medio (ATR). VaR 95 %: pérdida por onza que solo se supera uno de cada veinte días (4 años de histórico); ES es la pérdida media en esos días.')}
      <div id="t-rs">${stats}</div>
      <div class="calc">
        <h3 class="calc-h"><i class="ph ph-calculator" aria-hidden="true"></i>Tamaño de posición</h3>
        <div class="form-row" id="t-calc">
          <label class="field">Capital (€)<span class="brk"><input inputmode="decimal" name="cap" autocomplete="off"></span></label>
          <label class="field">Riesgo (%)<span class="brk"><input inputmode="decimal" name="risk" autocomplete="off"></span></label>
          <label class="field">Stop ($)<span class="brk"><input inputmode="decimal" name="stop" autocomplete="off"></span></label>
          <label class="field">Onzas por lote<span class="brk"><input inputmode="decimal" name="lot" autocomplete="off"></span></label>
        </div>
        <div class="calc-res" id="t-calc-out" role="status"></div>
      </div>`);
    const box = $('#t-calc');
    const saved = store.get('calc', { cap: 10000, risk: 1, stop: '', lot: 100 });
    for (const k of ['cap', 'risk', 'stop', 'lot']) $(`[name=${k}]`, box).value = saved[k] || (k === 'stop' ? Math.round(d.risk.atr * 0.5) : k === 'lot' ? 100 : '');
    const out = () => {
      const num = (k) => Number(String($(`[name=${k}]`, box).value).replace(',', '.'));
      const cap = num('cap'), rk = num('risk'), st = num('stop'), lot = num('lot') || 100, fx = d.eurusd;
      store.set('calc', { cap, risk: rk, stop: st, lot });
      if (!(cap > 0 && rk > 0 && st > 0)) { $('#t-calc-out').innerHTML = '<small>Escribe capital, riesgo y distancia al stop.</small>'; return; }
      if (!fx) { $('#t-calc-out').innerHTML = '<small class="caut">Sin cambio euro-dólar: no se puede pasar el riesgo de € a $.</small>'; return; }
      const eur = (cap * rk) / 100, oz = (eur * fx) / st;
      $('#t-calc-out').innerHTML = `<b>${nf(oz / lot, 2)}</b><span class="u">lotes</span><b>${nf(oz, 2)}</b><span class="u">onzas</span><small>Arriesgas ${nf(eur, 0)} € (${nf(eur * fx, 0)} $ al cambio ${nf(fx, 4)}) con un stop de ${nf(st / d.risk.atr, 2)} ATR. Lote de ${nf(lot, 0)} oz; sin spread ni comisión.</small>`;
    };
    box.oninput = out;
    out();
  }
  function events(d) {
    const ev = d.events;
    if (!ev.length) return fill('t-ev', '<p class="empty">Sin datos de impacto alto o medio en la sesión.</p>');
    const nextI = ev.findIndex((e) => e.t > Date.now());
    fill('t-ev', `<ol class="tl">${ev.map((e, i) => {
      const past = e.t < Date.now(), soon = !past && e.t - Date.now() < 15 * 6e4, next = i === nextI;
      const dot = soon ? 'now' : e.impact === 'High' ? 'hi' : '';
      return `<li class="tl-i${past ? ' past' : ''}${next ? ' next' : ''}"><span class="tl-t">${fTime.format(e.t)}</span><span class="tl-dot ${dot}" aria-hidden="true"></span>
        <div class="tl-c"><div class="ttl">${esc(evName(e.title))}<span class="flag">${esc(e.country)}</span>${e.impact === 'High' ? '<span class="lvl hi">Alto</span>' : '<span class="lvl md">Medio</span>'}${next ? `<span class="next-chip">en <span data-until="${e.t}">${until(e.t)}</span></span>` : ''}</div>
          <div class="sub">${e.actual ? `dato <b>${esc(e.actual)}</b> · ` : ''}${e.forecast ? `previsión ${esc(e.forecast)}` : ''}${e.forecast && e.previous ? ' · ' : ''}${e.previous ? `anterior ${esc(e.previous)}` : ''}</div>
          ${e.react ? `<div class="react"><span>El oro se mueve</span><b>±${nf(e.react.absUsd, 0)} $</b><span>en 1 h · ${e.react.n} datos</span></div>` : ''}</div></li>`;
    }).join('')}</ol>`);
  }
  function news(d) {
    if (!d.news.length) return fill('t-news', '<p class="empty">Sin titulares.</p>');
    fill('t-news', `<div class="news">${d.news.map((n) => `<a class="nw" href="${esc(n.link)}" target="_blank" rel="noopener"><span class="src" aria-hidden="true">${esc((n.source || '?').trim().charAt(0).toUpperCase())}</span><div><div class="nt">${esc(n.title)}</div><div class="nm">${esc(n.source)}${n.also?.length ? ` y ${n.also.length} más` : ''} · ${ago(n.time)}</div>${n.tags.length ? `<div class="tags">${n.tags.map((t) => `<span class="tag${t === 'Oro' ? ' gold' : ''}">${esc(t)}</span>`).join('')}</div>` : ''}</div></a>`).join('')}</div>`);
  }
  function plan_(d) {
    const p = d.plan, lv = plan ?? {};
    let bias = p?.bias ?? 0;
    fill('t-plan', `
      ${p ? `<p class="reading">Guardado hoy: <b class="sel">${['Vendedor', 'Neutral', 'Comprador'][p.bias + 1]}</b>${lv.entry ? ` · entrada <b class="sel">${nf(lv.entry, 1)}</b>` : ''}${lv.invalid ? ` · invalidación <b class="sel">${nf(lv.invalid, 1)}</b>` : ''}. Cuenta el último que guardes.</p>` : '<p class="reading">Escríbelo antes de operar. Aparece en azul en el gráfico y por la noche se evalúa solo.</p>'}
      <form id="t-form" style="display:grid;gap:12px">
        <div class="keyrow" role="group" aria-label="Sesgo">${[[1, 'Comprador'], [0, 'Neutral'], [-1, 'Vendedor']].map(([v, l]) => `<button class="key" type="button" data-b="${v}" aria-pressed="${v === bias}">${l}</button>`).join('')}</div>
        <div class="form-row" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
          <label class="field">Entrada<span class="brk"><input name="entry" inputmode="decimal" autocomplete="off" value="${lv.entry ?? ''}" placeholder="${d.scenarios.up ? nf(d.scenarios.up.trigger, 1) : ''}"></span></label>
          <label class="field">Invalidación<span class="brk"><input name="invalid" inputmode="decimal" autocomplete="off" value="${lv.invalid ?? ''}"></span></label>
        </div>
        <label class="field">Nota<textarea name="note" rows="2" placeholder="Qué tiene que pasar para entrar">${esc(p?.note ?? '')}</textarea></label>
        <div style="display:flex;align-items:center;gap:12px"><button class="key go" type="submit">Guardar plan</button><span id="t-plan-msg" class="status" role="status"></span></div>
      </form>`);
    const f = $('#t-form');
    $$('[data-b]', f).forEach((b) => b.addEventListener('click', () => { bias = +b.dataset.b; $$('[data-b]', f).forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.b === bias))); }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = (k) => String(f.elements[k].value).replace(/\./g, '').replace(',', '.');
      const btn = $('button[type=submit]', f);
      btn.disabled = true;
      try {
        await post('/api/journal', { bias, entry: n('entry'), invalid: n('invalid'), basis: basisNow, note: f.elements.note.value });
        $('#t-plan-msg').className = 'status';
        $('#t-plan-msg').textContent = `Guardado a las ${fTime.format(Date.now())}.`;
        plan = { entry: Number(n('entry')) || null, invalid: Number(n('invalid')) || null };
        load();
      } catch (err) { $('#t-plan-msg').className = 'status caut'; $('#t-plan-msg').textContent = `No se guardó: ${err.message}`; }
      finally { btn.disabled = false; }
    });
  }
  load();
  every(60e3, load);
}

// =====================================================================
// ORO · one page at a time, picked with a segmented control
// =====================================================================
const CHAPTERS = [
  ['tecnico', 'Técnico', chTech],
  ['variacion', 'Variación cuantitativa', chVq],
  ['volatilidad', 'Volatilidad', chVol],
  ['riesgo', 'Riesgo', chRisk],
  ['proyeccion', 'Proyección', chProj],
  ['posicionamiento', 'Posición', chPos],
  ['macro', 'Macro', chMacro],
  ['relaciones', 'Relaciones', chRel],
];
function pageGold(view) {
  const cur = () => CHAPTERS.find((c) => c[0] === location.hash.slice(1)) ?? CHAPTERS[0];
  view.innerHTML = `<div class="page-head"><div><h1>Oro</h1><p>Ocho páginas de análisis. Cada una abre con su lectura en una línea y la prueba debajo.</p></div></div>
    <nav class="seg syskeys" aria-label="Páginas del oro">${CHAPTERS.map(([id, t]) => `<a class="key" href="#${id}" data-ch="${id}">${t}</a>`).join('')}</nav>
    <div id="g-read"></div><div class="grid" id="g-body"></div>`;
  onLeave(() => clearInterval(chTimer));
  const show = () => {
    clearInterval(chTimer);
    const [id, , fn] = cur();
    $$('[data-ch]', view).forEach((a) => (a.dataset.ch === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    const body = $('#g-body');
    body.innerHTML = '<div class="c12 skeleton" style="height:300px"></div>';
    $('#g-read').innerHTML = '';
    fn(body, (txt) => { $('#g-read').innerHTML = ecam('Lectura', txt); }).catch((e) => { body.innerHTML = `<p class="err c12">No se pudo cargar: ${esc(e.message)}</p>`; });
  };
  $$('[data-ch]', view).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); history.replaceState(null, '', BASE + '/oro#' + a.dataset.ch); show(); }));
  show();
}

let chTimer = 0; // the one chapter that refreshes itself (Variación cuantitativa)
const modCache = new Map();
const mod = (id) => { if (!modCache.has(id) || Date.now() - modCache.get(id).t > 60e3) modCache.set(id, { t: Date.now(), p: api(`/api/m/${id}`).catch((e) => { modCache.delete(id); throw e; }) }); return modCache.get(id).p; };
// Variación cuantitativa: a 270° dial from -100 to +100. Lit segments run from 0 to the reading.
function vqDial(score, from) {
  const C = 200, rad = (a) => (a * Math.PI) / 180, pt = (r, a) => [C + r * Math.sin(rad(a)), C - r * Math.cos(rad(a))].map((v) => v.toFixed(1));
  const seg = (a0, a1) => { const [x0, y0] = pt(172, a0), [x1, y1] = pt(172, a1), [x2, y2] = pt(150, a1), [x3, y3] = pt(150, a0); return `M${x0} ${y0}A172 172 0 0 1 ${x1} ${y1}L${x2} ${y2}A150 150 0 0 0 ${x3} ${y3}Z`; };
  let h = '';
  for (let a = -135; a < 135; a += 5) {
    const v = ((a + 2.5) / 135) * 100, on = score > 0 ? v > 0 && v <= score + 2 : score < 0 ? v < 0 && v >= score - 2 : Math.abs(v) < 3;
    h += `<path d="${seg(a + 0.6, a + 4.4)}" class="vq-seg ${on ? (v > 0 ? 'on up' : v < 0 ? 'on down' : 'on') : ''}"/>`;
  }
  for (let v = -100; v <= 100; v += 10) {
    const a = (v / 100) * 135, [x1, y1] = pt(146, a), [x2, y2] = pt(v % 50 ? 140 : 134, a);
    h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="vq-tick${v % 50 ? '' : ' major'}"/>`;
    if (!(v % 50)) { const [x, y] = pt(116, a); h += `<text x="${x}" y="${(+y + 5).toFixed(1)}" class="vq-lab">${v > 0 ? '+' : v < 0 ? MINUS : ''}${Math.abs(v)}</text>`; }
  }
  const sign = score > 0 ? '+' : score < 0 ? MINUS : '';
  return `<svg viewBox="0 0 400 352" class="vq-dial" role="img" aria-label="Ponderado ${sign}${Math.abs(score)} sobre 100">${h}
    <g class="vq-needle" style="transform:rotate(${from}deg)" data-to="${(score / 100) * 135}"><path d="M200 92 L206 200 L200 214 L194 200 Z"/></g>
    <circle cx="200" cy="200" r="11" class="vq-hub"/><circle cx="200" cy="200" r="3.5" class="vq-hub-in"/>
    <text x="200" y="334" class="vq-num ${dir(score)}">${sign}${Math.abs(score)}</text></svg>`;
}

async function chVq(body, setRead) {
  let needleAt = -135;
  const draw = async () => {
    const { data: v, reading } = await api('/api/m/vq');
    const usd = (p) => (p / 100) * v.open, n = v.now, f = v.fit;
    const own = Math.abs(n.own) >= Math.abs(n.dollar + n.rates);
    setRead(`${reading} ${own ? 'Lo mueve sobre todo el propio oro: es un movimiento con más fondo que si fuera solo el dólar.' : 'Lo mueven sobre todo el dólar y los tipos: si se giran ellos, se gira el oro.'}`);
    const parts = [['dollar', 'Dólar', 'DXY · el oro se mueve ' + sgn(f.bD, 2) + ' % por cada +1 % del dólar'], ['rates', 'Tipos', 'futuro del bono a 10 años · ' + sgn(f.bZ, 2) + ' % por cada +1 % del bono (tipos a la baja)'], ['own', 'Propio del oro', 'lo que no explican ni el dólar ni los tipos: demanda u oferta del propio oro']];
    const mx = Math.max(0.05, ...['dollar', 'rates', 'own', 'total'].map((k) => Math.abs(n[k])));
    const gauge = (x) => { const pos = ((x / mx + 1) / 2) * 100; return `<div class="gauge" aria-hidden="true"><i class="tk c"></i>${Math.abs(x) > mx * 0.02 ? `<i class="fill ${x > 0 ? 'pos' : 'neg'}" style="${x > 0 ? `left:50%;width:${pos - 50}%` : `left:${pos}%;width:${50 - pos}%`}"></i>` : ''}</div>`; };
    const stable = Math.abs(v.early.bD - v.late.bD) < 0.5 * Math.abs(f.bD);
    body.innerHTML = `
      ${panel('g-vq', 'Fuerza propia del oro', v.closed ? `<span class="caut">mercado cerrado · sesión del ${dLabel(v.sessionDate)}</span>` : `vela de las ${fTime.format(v.t * 1000)}`, 'c6', `${help('De −100 a +100: lo que el oro ha subido o bajado hoy por su cuenta, después de quitar lo que explican el dólar y los tipos, medido contra su movimiento normal de un día (±100 = una desviación diaria entera). Un oro que sube con el dólar también subiendo es fuerza de verdad; uno que sube solo porque cae el dólar depende del dólar. Se recalcula cada minuto. No predice hacia dónde irá: dice quién ha empujado.')}
        <div class="vq-wrap">${vqDial(v.score, needleAt)}<div class="vq-band ${dir(v.score)}">${esc(v.band)}</div>
        <p class="vq-sub">${v.score >= 5 ? 'El oro sube por su cuenta, más allá del dólar y los tipos' : v.score <= -5 ? 'El oro cae por su cuenta, más allá del dólar y los tipos' : 'El oro se mueve lo que le marcan el dólar y los tipos'}</p></div>
        <div class="ros vq-meta">${ro('Sesión', pc(n.total, 2), `${sgn(usd(n.total), 0, ' $')}`, dir(n.total))}${ro('Dólar y tipos', pc(n.dollar + n.rates, 2), `${sgn(usd(n.dollar + n.rates), 0, ' $')}`, dir(n.dollar + n.rates))}${ro('Propio del oro', pc(n.own, 2), `${sgn(usd(n.own), 0, ' $')}`, dir(n.own))}</div>`)}
      ${panel('g-vqp', 'Quién mueve el oro hoy', 'desde la apertura de la sesión', 'c6', `<div class="sys" role="list"><div class="srow head" aria-hidden="true"><span class="name">Parte</span><span class="gauge-h"><span>Baja</span><span>Sube</span></span><span class="score">%</span><span class="hit">$</span></div>
        ${parts.map(([k, label, why]) => `<div class="srow" role="listitem"><span class="name">${label}</span>${gauge(n[k])}<span class="score ${dir(n[k])}">${sgn(n[k], 2)}</span><span class="hit">${sgn(usd(n[k]), 0)}</span><span class="why">${esc(why)}</span></div>`).join('')}
        <div class="srow total" role="listitem"><span class="name">Total</span>${gauge(n.total)}<span class="score ${dir(n.total)}">${sgn(n.total, 2)}</span><span class="hit">${sgn(usd(n.total), 0)}</span><span class="why">movimiento del futuro GC en la sesión</span></div></div>`)}
      ${panel('g-vqd', 'La sesión, parte a parte', `${v.path.length} velas de 15 min`, 'c8', `${legend([{ label: 'Total', color: 'var(--ink)' }, { label: 'Dólar', color: 'var(--s2)' }, { label: 'Tipos', color: 'var(--s3)' }, { label: 'Propio del oro', color: 'var(--gold)' }])}<div class="chart" id="g-vqdc"></div>`)}
      ${panel('g-vqc', '¿Cuánto explican el dólar y los tipos?', '', 'c4', `${help(`Regresión de los movimientos de 15 minutos del oro sobre los del índice dólar y el futuro del bono a 10 años desde el ${dLabel(new Date(v.from * 1000).toISOString().slice(0, 10))} (${nf(f.n, 0)} velas). R² es la parte del movimiento del oro que explican esos dos. Las sensibilidades se comparan entre la primera y la segunda mitad del periodo para ver si la relación aguanta.`)}
        <div class="ros">${ro('Explican', `${nf(f.r2 * 100, 0)} %`, 'del movimiento de 15 min')}${ro('Por +1 % del dólar', pc(f.bD, 2), `antes ${pc(v.early.bD, 2)} · ahora ${pc(v.late.bD, 2)}`)}${ro('Por +1 % del bono', pc(f.bZ, 2), `antes ${pc(v.early.bZ, 2)} · ahora ${pc(v.late.bZ, 2)}`)}</div>
        <p class="reading" style="margin-top:12px">${f.r2 < 0.15 ? 'Ahora el oro va casi por libre: el dólar y los tipos explican poco.' : `El dólar y los tipos explican ${f.r2 > 0.4 ? 'buena parte' : 'una parte'} de cada movimiento: vigílalos.`} ${stable ? 'La relación con el dólar se mantiene estable.' : '<span class="caut">La relación con el dólar ha cambiado entre las dos mitades: fíate menos del reparto.</span>'}</p>`)}`;
    const nd = $('.vq-needle', body);
    nd.getBoundingClientRect(); // commit the start angle so the transition runs
    nd.style.transform = `rotate(${nd.dataset.to}deg)`;
    needleAt = +nd.dataset.to;
    chart($('#g-vqdc'), { label: 'Movimiento del oro en la sesión repartido entre dólar, tipos y propio', data: v.path.map((p) => ({ x: fTime.format(p.t * 1000), a: usd(p.total), b: usd(p.dollar), c: usd(p.rates), o: usd(p.own) })), series: [{ key: 'a', label: 'Total', color: 'var(--ink)' }, { key: 'b', label: 'Dólar', color: 'var(--s2)' }, { key: 'c', label: 'Tipos', color: 'var(--s3)' }, { key: 'o', label: 'Propio', color: 'var(--gold)' }], fmtY: (y) => sgn(y, 0, ' $') });
  };
  await draw();
  chTimer = setInterval(() => !document.hidden && draw().catch(() => {}), 60e3);
}

async function chTech(body, setRead) {
  body.innerHTML = `${panel('g-tech', 'XAU/USD contado', 'desde el futuro GC, menos la base', 'c12', `${help('Velas del futuro GC de COMEX con la base de hoy (futuro menos contado) restada, para que los precios coincidan con los de tu plataforma de XAU/USD. Las velas de 4 horas empiezan a las 18:00 de Nueva York, como en MT5 y TradingView, así que la EMA y el RSI salen igual que allí. La base cambia unos dólares con los meses: en velas antiguas puede haber un pequeño desfase.')}<div class="tf"><div class="keyrow" role="group" aria-label="Marco temporal">${['15m', '1h', '4h', '1d'].map((t) => `<button class="key sm" type="button" data-tf="${t}" aria-pressed="${t === store.get('tf', '1h')}">${t === '1d' ? 'Diario' : t}</button>`).join('')}</div><div class="legend" style="margin:0"><span><i style="background:var(--s2)"></i>EMA 20</span><span><i style="background:var(--s3)"></i>EMA 50</span><span><i style="background:var(--ink)"></i>EMA 200</span><span><i class="dash" style="color:var(--ink-3)"></i>Bollinger 20, 2</span></div></div><div class="lwc-box" id="g-lwc"></div><div class="ros" id="g-tstats" style="margin-top:12px"></div>`)}`;
  const loadTf = async (tf) => {
    store.set('tf', tf);
    $$('[data-tf]', body).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tf === tf)));
    const { data: c } = await api(`/api/candles?sym=GC%3DF&tf=${tf}`);
    candles($('#g-lwc'), { bars: c.bars, overlays: [{ data: c.ema20, color: css('--s2') }, { data: c.ema50, color: css('--s3') }, { data: c.ema200, color: css('--ink') }, { data: c.bbUp, color: css('--ink-3'), dash: true }, { data: c.bbLow, color: css('--ink-3'), dash: true }] });
    const last = c.bars.at(-1).c, e200 = c.ema200.at(-1)?.value, e50 = c.ema50.at(-1)?.value;
    $('#g-tstats').innerHTML = `
      <div class="ro"><span>Último</span><b>${nf(last, 1)}</b></div>
      <div class="ro"><span>Frente a EMA 50</span><b class="${dir(last - e50)}">${pc(((last - e50) / e50) * 100)}</b></div>
      <div class="ro"><span>Frente a EMA 200</span><b class="${dir(last - e200)}">${e200 ? pc(((last - e200) / e200) * 100) : '—'}</b></div>
      <div class="ro"><span>RSI 14</span><b>${nf(c.rsi, 0)}</b><small>${c.rsi > 70 ? 'sobrecompra' : c.rsi < 30 ? 'sobreventa' : 'zona media'}</small></div>
      <div class="ro"><span>ADX 14</span><b>${nf(c.adx, 0)}</b><small>${c.adx > 25 ? 'tendencia definida' : 'sin tendencia clara'}</small></div>`;
    setRead(`En ${tf === '1d' ? 'diario' : tf} el precio está ${last > e200 ? 'sobre' : 'bajo'} la EMA 200, RSI ${nf(c.rsi, 0)} y ADX ${nf(c.adx, 0)} (${c.adx > 25 ? 'con tendencia' : 'sin tendencia'}).`);
  };
  $$('[data-tf]', body).forEach((b) => b.addEventListener('click', () => loadTf(b.dataset.tf).catch((e) => ($('#g-lwc').innerHTML = `<p class="err">${esc(e.message)}</p>`))));
  await loadTf(store.get('tf', '1h'));
}

async function chVol(body, setRead) {
  const { data: q, reading } = await mod('quant');
  setRead(reading);
  const rk = (s) => ['Calma', 'Normal', 'Agitado'][s];
  body.innerHTML = `
    ${panel('g-vol', 'Volatilidad anualizada', 'realizada y prevista', 'c8', `${legend([{ label: 'Realizada 20 días', color: 'var(--s1)' }, { label: 'Realizada 100 días', color: 'var(--s2)' }, { label: 'GARCH (condicional)', color: 'var(--s3)', dash: true }])}<div class="chart" id="g-volc"></div>`)}
    ${panel('g-garch', 'Modelos GARCH', '', 'c4', `${help('GARCH(1,1) estima la volatilidad de mañana con la de hoy y el último susto. Persistencia cerca de 1: los sustos tardan en olvidarse; la vida media son los días que tarda en disiparse la mitad. GJR añade asimetría y aquí puede salir de los dos signos: γ positivo, las caídas agitan más (lo típico en bolsa); γ negativo, las subidas agitan más, algo frecuente en el oro. Ajuste por máxima verosimilitud con 10 años de datos.')}
      <div class="ros">
        <div class="ro"><span>Prevista mañana</span><b>${nf(q.garch.nextAnn, 1)} %</b><small>±${nf(q.garch.move1, 0)} $ en un día</small></div>
        <div class="ro"><span>Implícita (GVZ)</span><b>${nf(q.gvz, 1)} %</b><small>${q.gvz ? (q.gvz > q.garch.nextAnn ? 'las opciones esperan más' : 'las opciones esperan menos') : ''}</small></div>
        <div class="ro"><span>Media de largo plazo</span><b>${nf(q.garch.longRunAnn, 1)} %</b></div>
        <div class="ro"><span>Persistencia</span><b>${nf(q.garch.pers, 3)}</b><small>vida media ${nf(q.garch.halfLife, 0)} días</small></div>
        <div class="ro"><span>α · β</span><b>${nf(q.garch.a, 3)} · ${nf(q.garch.b, 3)}</b></div>
        <div class="ro"><span>GJR γ (asimetría)</span><b>${nf(q.gjr.g, 3)}</b><small>${q.gjr.lr > 3.84 ? (q.gjr.g < 0 ? 'las subidas agitan más que las caídas' : 'las caídas agitan más que las subidas') : 'sin asimetría clara'} (LR ${nf(q.gjr.lr, 1)})</small></div>
      </div>`)}
    ${panel('g-hmm', 'Régimen (modelo oculto de Markov)', '3 estados · 6 años', 'c6', `${help('El modelo agrupa los días en tres estados por su volatilidad y estima cuánto suele durar cada uno. La franja muestra el estado más probable de cada día del último año; la tabla, la probabilidad de cada estado hoy.')}
      <div class="regime-strip" role="img" aria-label="Régimen del último año">${q.hmm.path.map((p) => `<i style="background:${['color-mix(in srgb, var(--s1) 25%, transparent)', 'color-mix(in srgb, var(--s1) 60%, transparent)', 'var(--s1)'][p.s]}" title="${dLabel(p.d)}: ${rk(p.s)}"></i>`).join('')}</div>
      <div class="legend" style="margin-top:6px"><span><i style="background:color-mix(in srgb, var(--s1) 25%, transparent);height:8px"></i>Calma</span><span><i style="background:color-mix(in srgb, var(--s1) 60%, transparent);height:8px"></i>Normal</span><span><i style="background:var(--s1);height:8px"></i>Agitado</span></div>
      <table class="tbl"><thead><tr><th>Estado</th><th class="num">Hoy</th><th class="num">Vol. anual</th><th class="num">Media diaria</th><th class="num">Duración</th></tr></thead><tbody>
      ${q.hmm.states.map((s, i) => `<tr ${i === q.hmm.current ? 'class="lv-now"' : ''}><td>${s.name}</td><td class="num">${nf(s.p * 100, 0)} %</td><td class="num">${nf(s.sd * Math.sqrt(252), 1)} %</td><td class="num">${pc(s.mu, 2)}</td><td class="num">${nf(s.days, 0)} d</td></tr>`).join('')}
      </tbody></table>`)}
    ${panel('g-hist', 'Distribución de rendimientos diarios', '4 años', 'c6', `${legend([{ label: 'Días observados', color: 'var(--s1)' }, { label: 'Si fuera normal', color: 'var(--ink-2)', dash: true }])}<div class="chart short" id="g-histc"></div><p class="reading" style="margin:8px 0 0">Asimetría ${nf(q.risk.y4.skew, 2)}, curtosis ${nf(q.risk.y4.kurt, 1)}: ${q.risk.y4.kurt > 1 ? 'colas más gordas que una normal, los días extremos son más frecuentes de lo que dice la campana.' : 'colas parecidas a una normal.'}</p>`)}`;
  chart($('#g-volc'), { label: 'Volatilidad anualizada del oro', data: q.vol.map((v) => ({ x: v.d, a: v.rv20, b: v.rv100, c: v.garch })), series: [{ key: 'a', label: 'Realizada 20 d', color: 'var(--s1)' }, { key: 'b', label: 'Realizada 100 d', color: 'var(--s2)' }, { key: 'c', label: 'GARCH', color: 'var(--s3)', dash: true }], fmtY: (v) => nf(v, 0) + ' %', fmtX: dLabel });
  chart($('#g-histc'), { kind: 'bar', label: 'Histograma de rendimientos diarios', data: q.hist.map((h) => ({ x: h.x, n: h.n, normal: h.normal })), series: [{ key: 'n', label: 'Días', color: 'var(--s1)' }, { key: 'normal', label: 'Normal', color: 'var(--ink-2)', dash: true }], fmtY: (v) => nf(v, 0), fmtX: (x) => pc(x, 1), pr: 36 });
}

async function chRisk(body, setRead) {
  const { data: q } = await mod('quant');
  const y1 = q.risk.y1, y4 = q.risk.y4, $oz = (v) => nf((v / 100) * q.price, 0) + ' $';
  setRead(`Caída máxima de 3 años ${pc(q.dd.max, 1)}; ahora a ${pc(q.dd.current, 1)} del máximo. Un día de cada veinte se pierden más de ${$oz(y4.var95)} por onza.`);
  body.innerHTML = `
    ${panel('g-dd', 'Caída desde máximos', '3 años', 'c8', '<div class="chart" id="g-ddc"></div>')}
    ${panel('g-var', 'Pérdidas extremas en un día', '', 'c4', `${help('VaR: pérdida que solo se supera ese porcentaje de días. ES: la pérdida media en esos días. Sharpe y Sortino miden rentabilidad por unidad de riesgo (Sortino solo cuenta las caídas); por encima de 1 es bueno.')}
      <table class="tbl"><thead><tr><th></th><th class="num">1 año</th><th class="num">4 años</th><th class="num">$/oz</th></tr></thead><tbody>
      <tr><td>VaR 95 %</td><td class="num">${pc(-y1.var95)}</td><td class="num">${pc(-y4.var95)}</td><td class="num">${$oz(y4.var95)}</td></tr>
      <tr><td>ES 95 %</td><td class="num">${pc(-y1.es95)}</td><td class="num">${pc(-y4.es95)}</td><td class="num">${$oz(y4.es95)}</td></tr>
      <tr><td>VaR 99 %</td><td class="num">${pc(-y1.var99)}</td><td class="num">${pc(-y4.var99)}</td><td class="num">${$oz(y4.var99)}</td></tr>
      <tr><td>ES 99 %</td><td class="num">${pc(-y1.es99)}</td><td class="num">${pc(-y4.es99)}</td><td class="num">${$oz(y4.es99)}</td></tr>
      <tr><td>Sharpe</td><td class="num">${nf(y1.sharpe, 2)}</td><td class="num">${nf(y4.sharpe, 2)}</td><td></td></tr>
      <tr><td>Sortino</td><td class="num">${nf(y1.sortino, 2)}</td><td class="num">${nf(y4.sortino, 2)}</td><td></td></tr>
      </tbody></table>`)}
`;
  chart($('#g-ddc'), { label: 'Caída del oro desde su máximo', data: q.dd.series.map((p) => ({ x: p.d, v: p.v })), series: [{ key: 'v', label: 'Desde máximo', color: 'var(--down)' }], fmtY: (v) => nf(v, 0) + ' %', fmtX: dLabel, max: 0 });
}

async function chProj(body, setRead) {
  const { data: q } = await mod('quant');
  const P = q.price, at = (h) => q.fan[h - 1], usd = (v) => nf(v, 0);
  const rng = (lo, hi) => `${usd(lo)} – ${usd(hi)} $`;
  const m = at(20);
  setRead(`Lo normal es que dentro de un mes el oro esté entre ${rng(m.p25, m.p75)} (1 de cada 2 veces) y casi seguro entre ${rng(m.p5, m.p95)} (9 de cada 10). Son rangos de movimiento, no dirección.`);
  const HZ = [[1, 'Mañana'], [5, 'En una semana'], [20, 'En un mes']];
  const chk = q.fanCheck, ok = (c) => Math.abs(c.in90 - 90) <= 4;
  const bar = (v) => `background:linear-gradient(90deg, color-mix(in srgb, var(--s1) 20%, transparent) ${v.toFixed(0)}%, transparent ${v.toFixed(0)}%)`;
  const rows = [...q.probMap].reverse();
  const cut = rows.findIndex((r) => r.level < P);
  const nowRow = `<tr class="lv-now"><td class="num">${usd(P)}</td><td class="num">precio ahora</td><td></td><td></td><td></td></tr>`;
  const lvRow = (r) => `<tr><td class="num">${usd(r.level)}</td><td class="num sub">${sgn(r.level - P, 0, ' $')} · ${pc(((r.level - P) / P) * 100, 1)}</td>${[r.touch5, r.touch20, r.above20].map((v) => `<td class="num" style="${bar(v)}">${nf(v, 0)} %</td>`).join('')}</tr>`;
  body.innerHTML = `
    ${panel('g-hz', 'Cuánto se puede mover', `desde el último cierre, ${usd(P)} $`, 'c12', `${help(`Para cada plazo: el movimiento típico (la mitad de las veces se mueve menos que eso) y los dos rangos. Salen de la volatilidad que mejor ha acertado en la prueba de la derecha: ahora ${q.fanSource === 'GVZ' ? 'la implícita de las opciones (GVZ)' : 'la prevista por el modelo GARCH'}.`)}
      <div class="ros" style="grid-template-columns:repeat(auto-fit, minmax(200px, 1fr))">${HZ.map(([h, t]) => { const f = at(h); return `<div class="ro"><span>${t}</span><b>± ${usd((f.p75 - f.p25) / 2)} $</b><small>1 de cada 2 veces: ${rng(f.p25, f.p75)}</small><small>9 de cada 10: ${rng(f.p5, f.p95)}</small></div>`; }).join('')}</div>`)}
    ${panel('g-fan', 'Abanico de precios', `futuro GC · volatilidad ${q.fanSource}`, 'c8', `${help('A la izquierda, el precio real de los últimos 2 meses. A la derecha, por dónde puede ir en las próximas 20 sesiones: la banda clara recoge 9 de cada 10 casos y la oscura 1 de cada 2. La línea discontinua es el centro, no una previsión: el abanico no apuesta por ninguna dirección.')}${legend([{ label: 'Precio real', color: 'var(--ink)' }, { label: '9 de cada 10', color: 'color-mix(in srgb, var(--s1) 30%, transparent)' }, { label: '1 de cada 2', color: 'color-mix(in srgb, var(--s1) 60%, transparent)' }, { label: 'Centro', color: 'var(--s1)', dash: true }])}<div class="chart" id="g-fanc"></div>`)}
    ${panel('g-chk', '¿Se cumplen las bandas?', '', 'c4', `${help(`Cada día desde ${dLabelY(q.fanFrom)} se dibujaron dos abanicos, uno con la volatilidad GARCH y otro con la implícita de las opciones (GVZ) de ese día, y se miró dónde acabó el precio de verdad. El que más se acerca a lo que promete dibuja el abanico de esta página. Prueba con ${nf(chk[0].n, 0)} días.`)}
      <table class="tbl"><thead><tr><th>Plazo</th><th class="num">9 de 10 <span class="sub">GARCH · GVZ</span></th><th class="num">1 de 2 <span class="sub">GARCH · GVZ</span></th></tr></thead><tbody>
      ${chk.map((c) => `<tr><td>${c.h === 1 ? '1 día' : `${c.h} días`}</td><td class="num">${nf(c.garch90, 0)} · <b class="${ok(c) ? '' : 'caut'}">${nf(c.gvz90, 0)}</b> %</td><td class="num">${nf(c.garch50, 0)} · ${nf(c.gvz50, 0)} %</td></tr>`).join('')}
      </tbody></table><p class="vq-sub" style="margin:8px 0 0;text-align:left">Prometen 90 % y 50 %. Ahora dibuja el abanico <b>${q.fanSource}</b>.</p>
      <p class="reading" style="margin-top:12px">${chk.every(ok) ? 'Las bandas aciertan lo que prometen en todos los plazos.' : `Ojo: a ${chk.filter((c) => !ok(c)).map((c) => (c.h === 1 ? '1 día' : `${c.h} días`)).join(' y ')} la banda de 9 de cada 10 ${chk.find((c) => !ok(c)).in90 < 90 ? 'se ha quedado algo corta (el oro se ha movido más de lo previsto); deja margen' : 'ha sido más ancha de lo necesario'}.`}</p>
      <p class="reading" style="margin:0"><b>¿Y la dirección?</b> ${q.ar1.beats ? 'Un modelo AR(1) mejora algo al azar fuera de muestra, pero poco.' : 'Ningún modelo probado la adivina: un AR(1) no mejora al azar fuera de muestra. Por eso el abanico es simétrico.'}</p>`)}
    ${panel('g-pmap', 'Probabilidad por nivel', 'con la volatilidad de hoy', 'c12', `${help('Para cada número redondo: probabilidad de que el precio lo toque en algún momento (aunque luego vuelva) y de que acabe el mes por encima. Tocar un nivel es casi el doble de probable que cerrar más allá de él. Igual que el abanico, no supone ninguna dirección.')}
      <div class="scroll-x"><table class="tbl"><thead><tr><th class="num">Nivel</th><th class="num">Distancia</th><th class="num">Lo toca en 1 semana</th><th class="num">Lo toca en 1 mes</th><th class="num">Acaba el mes por encima</th></tr></thead><tbody>
      ${rows.map((r, i) => (i === cut ? nowRow : '') + lvRow(r)).join('')}${cut < 0 ? nowRow : ''}
      </tbody></table></div>`)}`;
  const recent = q.recent.slice(-40);
  const pts = [...recent.map((r) => ({ x: dLabel(r.d), v: r.v })), ...q.fan.map((r) => ({ x: `+${r.h} ses.`, h: r.h, ...r }))];
  Object.assign(pts[recent.length - 1], { x: 'Hoy', p5: P, p25: P, p50: P, p75: P, p95: P });
  chart($('#g-fanc'), { label: 'Precio de los últimos 2 meses y abanico de las próximas 20 sesiones', data: pts, series: [{ key: 'v', label: 'Precio', color: 'var(--ink)' }, { key: 'p50', label: 'Centro', color: 'var(--s1)', dash: true }], bands: [{ lo: 'p5', hi: 'p95', color: 'var(--s1)', alpha: 0.14 }, { lo: 'p25', hi: 'p75', color: 'var(--s1)', alpha: 0.28 }], fmtY: usd,
    tip: (d) => (d.h ? `<div class="dim">Dentro de ${d.h} ${d.h === 1 ? 'sesión' : 'sesiones'}</div><div>9 de cada 10 <b>${rng(d.p5, d.p95)}</b></div><div>1 de cada 2 <b>${rng(d.p25, d.p75)}</b></div>` : `<div class="dim">${esc(d.x)}</div><div>Precio <b>${usd(d.v)} $</b></div>`) });
}

async function chPos(body, setRead) {
  const [{ data: m5, reading: r5 }, cot] = await Promise.all([mod('m5'), api('/api/cot').then((j) => j.data).catch(() => null)]);
  setRead(`${cot ? `Managed Money ${sgn(cot.change.mm, 0)} contratos en la semana (${nf(cot.pctOi.mm, 1)} % del interés abierto); swap dealers ${sgn(cot.change.swap, 0)}. ` : ''}${r5}`);
  body.innerHTML = `
    ${panel('g-cot', 'COT del oro', cot ? `informe del ${dLabel(cot.date)}` : '', 'c7', `${help('Posición neta (largos menos cortos) en contratos. Managed Money: fondos que siguen tendencias. Swap dealers: bancos que cubren lo que venden a sus clientes, casi siempre cortos. Productores: mineras y refinerías. Es contexto: en el backtest, leer los extremos de Managed Money a la contra perdía dinero en los dos periodos, así que ya no puntúa en la balanza. Lo útil es el cambio semanal y cuánto pesan los fondos en el interés abierto.')}
      <div class="ros" style="margin-bottom:12px">
        <div class="ro"><span>Managed Money neto</span><b>${nf(cot?.last.mm, 0)}</b><small>${sgn(cot?.change.mm, 0)} en la semana · ${nf(cot?.pctOi.mm, 1)} % del interés abierto</small></div>
        <div class="ro"><span>Swap dealers neto</span><b>${nf(cot?.last.swap, 0)}</b><small>${sgn(cot?.change.swap, 0)} en la semana · ${nf(cot?.pctOi.swap, 1)} %</small></div>
        <div class="ro"><span>Productores neto</span><b>${nf(cot?.last.prod, 0)}</b><small>${sgn(cot?.change.prod, 0)} en la semana</small></div>
        <div class="ro"><span>Managed Money, 3 años</span><b>${nf(cot?.index.mm156, 0)} de 100</b><small>dónde está entre su mínimo y su máximo</small></div>
      </div>
      ${legend([{ label: 'Managed Money', color: 'var(--s1)' }, { label: 'Swap dealers', color: 'var(--s2)' }, { label: 'Productores', color: 'var(--s3)' }])}<div class="chart" id="g-cotc"></div>`)}
    ${panel('g-gld', 'Oro en el ETF GLD', '', 'c5', `${help('Toneladas de oro físico que guarda el SPDR Gold Shares, el mayor ETF de oro. Es solo una parte de la demanda de ETF: no incluye IAU ni los ETF asiáticos y europeos. Entradas sostenidas indican demanda de inversión occidental. En el backtest es el único factor que ha superado a su base a 20 sesiones en los dos periodos, con pocas ventanas.')}<div class="ros" style="margin-bottom:12px"><div class="ro"><span>Toneladas</span><b>${nf(m5.tonnes, 1)}</b></div><div class="ro"><span>5 sesiones</span><b class="${dir(m5.d5)}">${sgn(m5.d5, 1, ' t')}</b></div><div class="ro"><span>20 sesiones</span><b class="${dir(m5.d20)}">${sgn(m5.d20, 1, ' t')}</b></div></div><div class="chart" id="g-gldc"></div>`)}`;
  if (cot) chart($('#g-cotc'), { label: 'Posición neta en el oro por tipo de operador', data: cot.history.slice(-156).map((h) => ({ x: h.date, a: h.mm, b: h.swap, c: h.prod })), series: [{ key: 'a', label: 'Managed Money', color: 'var(--s1)' }, { key: 'b', label: 'Swap dealers', color: 'var(--s2)' }, { key: 'c', label: 'Productores', color: 'var(--s3)' }], fmtY: (v) => nf(v / 1000, 0) + 'k', fmtX: dLabel });
  if (m5.series) chart($('#g-gldc'), { label: 'Toneladas de oro en GLD', data: m5.series.map((p) => ({ x: p.d, v: p.v })), series: [{ key: 'v', label: 'Toneladas', color: 'var(--s1)' }], fmtY: (v) => nf(v, 0) + ' t', fmtX: dLabel });
}

async function chMacro(body, setRead) {
  const [{ data: m6, reading: r6 }, { data: m2, reading: r2 }, { data: m7, reading: r7 }] = await Promise.all(['m6', 'm2', 'm7'].map(mod));
  setRead(`${r2} ${r7}`);
  body.innerHTML = `
    ${panel('g-m6', 'Tipos y Fed', '', 'c7', `<p class="reading">${esc(r6)}</p>
      <table class="tbl"><thead><tr><th>Plazo</th><th class="num">Hoy</th><th class="num">Hace 1 mes</th><th class="num">Hace 1 año</th></tr></thead><tbody>
      ${m6.curve.map((c) => `<tr><td>${c.k}</td><td class="num">${nf(c.now, 2)} %</td><td class="num">${nf(c.m1, 2)} %</td><td class="num">${nf(c.y1, 2)} %</td></tr>`).join('')}
      <tr><td><b>Tipo real 10 a (TIPS)</b></td><td class="num"><b>${nf(m6.real, 2)} %</b></td><td></td><td></td></tr><tr><td>Inflación implícita 10 a</td><td class="num">${nf(m6.be, 2)} %</td><td></td><td></td></tr>
      </tbody></table>
      ${m6.path?.length ? `<h3 class="h3">Lo que descuentan los futuros de fondos Fed</h3><table class="tbl"><thead><tr><th>Reunión</th><th class="num">Tipo implícito</th><th class="num">Cambio</th><th class="num">Probabilidad</th></tr></thead><tbody>${m6.path.map((p) => `<tr><td>${dLabelY(p.meeting)}</td><td class="num">${nf(p.rate, 2)} %</td><td class="num ${dir(-p.change)}">${sgn(p.change * 100, 0, ' pb')}</td><td class="num">${p.change < 0 ? `${nf(p.cutProb, 0)} % bajada` : `${nf(p.hikeProb, 0)} % subida`}</td></tr>`).join('')}</tbody></table><p class="vq-sub" style="text-align:left;margin:6px 0 0">Calculado con los futuros ZQ del mes siguiente a cada reunión. Compáralo con CME FedWatch antes de fiarte.</p>` : ''}
      <p class="vq-sub" style="text-align:left;margin:10px 0 0">Liquidez neta de la Fed: ${nf(m6.liq?.at(-1)?.v, 2)} billones $ (${sgn((m6.liq4 ?? 0) * 1000, 0, ' mm $')} en 4 semanas). Contexto; no hay relación probada con el oro.</p>`)}
    ${panel('g-m2', 'Apetito por riesgo', m2.label, 'c5', `<p class="reading">${esc(r2)}</p><table class="tbl"><tbody>${m2.parts.map((p) => `<tr><td>${esc(p.k)}</td><td class="num">${p.v == null ? '—' : nf(p.v, 2)}</td><td class="${dir(p.vote)}" style="white-space:nowrap">${p.vote > 0 ? 'risk-on' : p.vote < 0 ? 'risk-off' : 'neutro'}</td><td class="sub">${esc(p.why)}</td></tr>`).join('')}</tbody></table>`)}
    ${panel('g-m7', 'Fuerza de las divisas', 'última semana', 'c12', `<p class="reading">${esc(r7)}</p><div class="chart short" id="g-fx"></div>`)}`;
  chart($('#g-fx'), { kind: 'bar', diverging: true, label: 'Fuerza relativa de las divisas en la semana', data: m7.strength.w1.map((s) => ({ x: s.cur, v: s.v })), series: [{ key: 'v', label: 'Fuerza', color: 'var(--s1)' }], fmtY: (v) => pc(v, 1) });
}

async function chRel(body, setRead) {
  const [{ data: m4, reading: r4 }, { data: m13, reading: r13 }, m3] = await Promise.all([mod('m4'), mod('m13'), mod('m3').catch(() => null)]);
  setRead(r4);
  const corrT = (labels, m) => `<div class="scroll-x"><table class="corr"><thead><tr><th></th>${labels.map((l) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${m.map((row, i) => `<tr><th style="text-align:right">${esc(labels[i])}</th>${row.map((v, j) => `<td style="${i === j ? '' : heatBg(v, 1, 'corr')}">${i === j ? '' : nf(v, 2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const B = m4.betas, c3 = m3?.data;
  body.innerHTML = `
    ${panel('g-fv', 'Sensibilidad a tipos y dólar', `R² ${nf(B.now.r2, 2)} · 60 sesiones`, 'c7', `${help('Regresión de los rendimientos diarios del oro sobre la variación del tipo real a 10 años (TIPS) y la del dólar (DXY), en ventanas de 60 sesiones. Dice cuánto se mueve el oro por cada +10 pb de tipo real y por cada +1 % del dólar. Sirve para escenarios: si un dato sube los tipos reales 15 pb, el oro debería moverse 1,5 veces la primera cifra. Si cambia de signo, la relación se ha roto. Sustituye al antiguo valor razonable, que comparaba niveles de precio y daba un R² inflado.')}
      <div class="ros">${ro('Por +10 pb de tipo real', pc(B.now.ry10, 2), `hace 3 meses ${pc(B.prev.ry10, 2)} · 1 año ${pc(B.year.ry10, 2)}`, dir(B.now.ry10))}${ro('Por +1 % del dólar', pc(B.now.dxy, 2), `hace 3 meses ${pc(B.prev.dxy, 2)} · 1 año ${pc(B.year.dxy, 2)}`, dir(B.now.dxy))}</div>
      ${legend([{ label: 'Por +10 pb de tipo real', color: 'var(--s2)' }, { label: 'Por +1 % del dólar', color: 'var(--s3)' }])}<div class="chart" id="g-fvc"></div>`)}
    ${panel('g-cur', '¿Es el dólar o el oro?', 'hoy', 'c5', c3 ? `${help('El oro en cuatro divisas. Si sube o baja en todas, el movimiento es del propio oro; si solo se mueve en dólares, lo está moviendo el dólar. La ratio oro/plata dice cuántas onzas de plata compra una de oro.')}
      <p class="reading">${esc(c3.own)}</p>
      <div class="ros">${['USD', 'EUR', 'JPY', 'CNY'].map((k) => ro(`Oro en ${k}`, pc(c3.inCur[k], 2), '', dir(c3.inCur[k]))).join('')}</div>
      ${c3.goldSilver ? `<div class="ros" style="margin-top:12px">${ro('Ratio oro/plata', nf(c3.goldSilver, 1), c3.gsr ? `rango del año ${nf(c3.gsr.min, 1)} – ${nf(c3.gsr.max, 1)} · percentil ${nf(c3.gsr.pct, 0)}` : '')}</div>` : ''}` : '<p class="empty">Sin datos de divisas.</p>')}
    ${panel('g-cr', 'Correlación con el oro', 'rendimientos diarios', 'c5', `<table class="tbl"><thead><tr><th></th><th class="num">20 días</th><th class="num">60 días</th></tr></thead><tbody>
      <tr><td>Dólar (DXY)</td><td class="num">${nf(m4.corr.dxy20, 2)}</td><td class="num">${nf(m4.corr.dxy60, 2)}</td></tr>
      <tr><td>Tipo real 10 años</td><td class="num">${nf(m4.corr.ry20, 2)}</td><td class="num">${nf(m4.corr.ry60, 2)}</td></tr></tbody></table>
      <h3 class="h3">Estacionalidad por mes</h3><p class="reading">${esc(r13)} Con unos 20 años por mes es orientativo: en el backtest no ayudó a acertar y salió de la balanza.</p><div class="chart short" id="g-sea"></div>`)}
    ${panel('g-cm', 'Matriz de correlaciones', '60 sesiones', 'c7', corrT(m13.corr.labels, m13.corr.m60))}`;
  chart($('#g-fvc'), { label: 'Sensibilidad del oro al tipo real y al dólar, ventanas de 60 sesiones', data: m4.betaSeries.map((p) => ({ x: p.d, a: p.ry10, b: p.dxy })), series: [{ key: 'a', label: 'Por +10 pb de tipo real', color: 'var(--s2)' }, { key: 'b', label: 'Por +1 % del dólar', color: 'var(--s3)' }], fmtY: (v) => pc(v, 1), fmtX: dLabel });
  chart($('#g-sea'), { kind: 'bar', diverging: true, label: 'Rendimiento medio del oro por mes', data: m13.monthly.map((m) => ({ x: MONTHS[m.month - 1], v: m.mean, up: m.upPct, n: m.n })), series: [{ key: 'v', label: 'Media', color: 'var(--s1)' }], fmtY: (v) => pc(v, 1), pr: 50, tip: (d) => `${d.x}: media <b>${pc(d.v, 2)}</b><br>subió ${nf(d.up, 0)} % de ${d.n} años` });
}

// =====================================================================
// MERCADOS
// =====================================================================
const GROUPS = [['all', 'Todos'], ['metal', 'Metales'], ['energy', 'Energía'], ['fx', 'Divisas'], ['rates', 'Tipos'], ['vol', 'Volatilidad'], ['idx', 'Índices'], ['crypto', 'Cripto'], ['stock', 'Acciones'], ['sector', 'Sectores']];
async function pageMarkets(view) {
  let grp = store.get('grp', 'all'), win = store.get('corrwin', 'm60');
  view.innerHTML = `<div class="page-head"><div><h1>Mercados</h1><p id="mk-read">El resto del mercado como contexto del oro.</p></div>
    <form class="search" id="mk-s" role="search"><label class="sr" for="mk-q">Buscar ticker</label><span class="brk"><input id="mk-q" placeholder="NVDA, SOL-USD" autocomplete="off" spellcheck="false"></span><button class="key go" type="submit">Abrir ficha</button></form></div>
    <div class="keyrow" style="margin-bottom:12px" id="mk-chips">${GROUPS.map(([k, l]) => `<button class="key sm" type="button" data-g="${k}" aria-pressed="${k === grp}">${l}</button>`).join('')}</div>
    <div class="grid">${panel('mk-heat', 'Rendimiento por periodo', 'pulsa una fila para ver su ficha', 'c12')}
    ${panel('mk-sc', 'Momentum frente a volatilidad', '3 meses · 20 sesiones · sin índices de volatilidad', 'c6', '<div class="chart tall" id="mk-scc"></div>')}
    ${panel('mk-corr', 'Correlaciones', 'rendimientos diarios', 'c6')}</div>`;
  $('#mk-s').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#mk-q').value.trim().toUpperCase(); if (q) go('/a/' + encodeURIComponent(q)); });
  let data;
  try { ({ data } = await mod('markets')); $('#mk-read').textContent = (await mod('markets')).reading; } catch (e) { return fail('mk-heat', e); }
  const draw = () => {
    const rows = data.list.filter((x) => !x.error && (grp === 'all' ? x.g !== 'sector' : x.g === grp));
    const cols = [['d1', '1 día'], ['w1', '1 sem.'], ['m1', '1 mes'], ['m3', '3 meses'], ['ytd', 'Año'], ['y1', '12 meses']];
    const mx = Object.fromEntries(cols.map(([k]) => [k, Math.max(...rows.map((r) => Math.abs(r[k] ?? 0)))]));
    fill('mk-heat', `<div class="scroll-x"><table class="tbl heat"><thead><tr><th>Activo</th><th class="num">Precio</th>${cols.map(([, l]) => `<th class="num">${l}</th>`).join('')}<th class="num">Vol. 20 d</th><th class="num">RSI</th><th class="num">Corr. oro 60 d</th><th class="num">Rango 52 sem.</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="link" data-s="${esc(r.s)}" tabindex="0"><td>${r.s === 'GC=F' ? '<b>Oro</b>' : esc(r.label)} <span class="sub">${esc(r.s)}</span></td><td class="num">${px(r.price)}</td>${cols.map(([k]) => `<td class="num cell" style="${heatBg(r[k], mx[k])}">${pc(r[k], 1)}</td>`).join('')}<td class="num">${nf(r.vol20, 0)} %</td><td class="num">${nf(r.rsi, 0)}</td><td class="num">${r.corrGold60 == null ? '—' : nf(r.corrGold60, 2)}</td><td class="num">${nf(r.pos52, 0)} %</td></tr>`).join('')}
      </tbody></table></div>`);
    $$('#mk-heat tr.link').forEach((tr) => { tr.onclick = () => go('/a/' + encodeURIComponent(tr.dataset.s)); tr.onkeydown = (e) => e.key === 'Enter' && tr.onclick(); });
    scatter($('#mk-scc'), rows.filter((r) => r.vol20 != null && r.m3 != null && r.g !== 'vol'));
  };
  const corr = () => fill('mk-corr', `<div class="keyrow" role="group" aria-label="Ventana" style="margin-bottom:10px">${[['m20', '20 sesiones'], ['m60', '60 sesiones']].map(([k, l]) => `<button class="key sm" type="button" data-w="${k}" aria-pressed="${k === win}">${l}</button>`).join('')}</div><div class="scroll-x"><table class="corr"><thead><tr><th></th>${data.corr.labels.map((l) => `<th>${esc(l.slice(0, 6))}</th>`).join('')}</tr></thead><tbody>${data.corr[win].map((row, i) => `<tr><th style="text-align:right">${esc(data.corr.labels[i])}</th>${row.map((v, j) => `<td style="${i === j ? '' : heatBg(v, 1, 'corr')}">${i === j ? '' : nf(v, 2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  $('#mk-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; grp = b.dataset.g; store.set('grp', grp); $$('[data-g]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.g === grp))); draw(); });
  $('#mk-corr').addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (!b) return; win = b.dataset.w; store.set('corrwin', win); corr(); });
  draw();
  corr();
}
function scatter(el, rows) {
  const W = el.clientWidth || 600, H = el.clientHeight || 360, PL = 44, PR = 16, PT = 12, PB = 30;
  if (!rows.length) { el.innerHTML = '<p class="empty">Sin datos.</p>'; return; }
  const xs = rows.map((r) => r.vol20), ys = rows.map((r) => r.m3);
  const x0 = 0, x1 = Math.max(...xs) * 1.08, y0 = Math.min(0, ...ys) * 1.1 - 1, y1 = Math.max(0, ...ys) * 1.1 + 1;
  const sx = (v) => PL + ((v - x0) / (x1 - x0)) * (W - PL - PR), sy = (v) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);
  let h = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Momentum a 3 meses frente a volatilidad de cada activo">`;
  for (const t of ticks(y0, y1)) h += `<line class="grid-l" x1="${PL}" x2="${W - PR}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${PL - 6}" y="${sy(t) + 4}" text-anchor="end">${nf(t, 0)} %</text>`;
  for (const t of ticks(x0, x1)) h += `<text x="${sx(t)}" y="${H - 8}" text-anchor="middle">${nf(t, 0)} %</text>`;
  h += `<line class="base-l" x1="${PL}" x2="${W - PR}" y1="${sy(0)}" y2="${sy(0)}"/>`;
  rows.forEach((r, i) => {
    const gold = r.s === 'GC=F';
    h += `<g class="pt" data-i="${i}" tabindex="0" role="button" aria-label="${esc(r.label)}: ${pc(r.m3, 1)} en 3 meses, volatilidad ${nf(r.vol20, 0)} %"><circle cx="${sx(r.vol20)}" cy="${sy(r.m3)}" r="${gold ? 6 : 4.5}" fill="${gold ? 'var(--gold)' : 'var(--s2)'}" stroke="#1a1c22" stroke-width="2"/>${gold || rows.length <= 14 ? `<text x="${sx(r.vol20) + 8}" y="${sy(r.m3) + 4}" style="fill:${gold ? 'var(--gold)' : 'var(--ink-2)'}">${esc(gold ? 'ORO' : r.label.slice(0, 12))}</text>` : ''}<circle cx="${sx(r.vol20)}" cy="${sy(r.m3)}" r="12" fill="transparent"/></g>`;
  });
  h += `<text x="${W - PR}" y="${H - 8}" text-anchor="end" style="fill:var(--ink-3)">volatilidad →</text></svg><div class="tip"></div>`;
  el.innerHTML = h;
  const tip = $('.tip', el);
  $$('.pt', el).forEach((g) => {
    const r = rows[+g.dataset.i];
    const show = () => { tip.innerHTML = `<b style="font-family:var(--font)">${esc(r.label)}</b><div>3 meses <b>${pc(r.m3, 1)}</b></div><div>Volatilidad <b>${nf(r.vol20, 0)} %</b></div>`; tip.classList.add('on'); tip.style.transform = `translate(${Math.min(sx(r.vol20) + 10, W - 170)}px, ${sy(r.m3) - 60}px)`; };
    g.addEventListener('pointerenter', show); g.addEventListener('focus', show);
    g.addEventListener('pointerleave', () => tip.classList.remove('on')); g.addEventListener('blur', () => tip.classList.remove('on'));
    g.addEventListener('click', () => go('/a/' + encodeURIComponent(r.s)));
  });
}

// =====================================================================
// FICHA DE ACTIVO
// =====================================================================
async function pageAsset(view, sym) {
  view.innerHTML = `<div class="page-head"><div><h1 id="a-h">${esc(sym)}</h1><p id="a-sub"><a href="/mercados" data-link>Mercados</a></p></div></div><div class="grid">${panel('a-px', 'Precio diario', '1 año', 'c8', '<div class="lwc-box short" id="a-lwc"></div>')}${panel('a-st', 'Cifras', '', 'c4')}</div>`;
  let a;
  try { ({ data: a } = await api('/api/asset/' + encodeURIComponent(sym))); } catch (e) { return fail('a-st', e); }
  $('#a-h').textContent = a.name;
  $('#a-sub').innerHTML = `<span class="num">${esc(a.sym)}</span> · <b class="num">${px(a.price)}</b> <span class="${dir(a.d1)}">${pc(a.d1)}</span> · cierre del ${dLabel(a.d)} · <a href="/mercados" data-link>volver a Mercados</a>`;
  document.title = `${a.name} · Aureo`;
  const c = a.candles.filter((r) => r.h != null), cl = c.map((r) => r.v);
  const emaS = (n) => { const k = 2 / (n + 1); let e = null; return cl.map((v, i) => { e = i < n - 1 ? null : e == null ? cl.slice(0, n).reduce((s, x) => s + x, 0) / n : v * k + e * (1 - k); return e; }); };
  const t = (r) => Date.parse(r.d + 'T00:00:00Z') / 1000;
  candles($('#a-lwc'), { bars: c.map((r) => ({ t: t(r), o: r.o, h: r.h, l: r.l, c: r.v })), overlays: [[50, '--s2'], [200, '--ink']].map(([n, col]) => ({ color: css(col), data: emaS(n).map((v, i) => ({ time: t(c[i]), value: v })).filter((p) => p.value != null) })) });
  fill('a-st', `<div class="ros">
    ${[['1 semana', pc(a.w1, 1), a.w1], ['1 mes', pc(a.m1, 1), a.m1], ['3 meses', pc(a.m3, 1), a.m3], ['Año', pc(a.ytd, 1), a.ytd], ['12 meses', pc(a.y1, 1), a.y1]].map(([l, v, raw]) => `<div class="ro"><span>${l}</span><b class="${dir(raw)}">${v}</b></div>`).join('')}
    <div class="ro"><span>Rango 52 sem.</span><b>${nf(a.pos52, 0)} %</b><small>${px(a.lo52)} – ${px(a.hi52)}</small></div>
    <div class="ro"><span>ATR 14</span><b>${nf(a.atr, pxd(a.price))}</b></div>
    <div class="ro"><span>Vol. 20 d</span><b>${nf(a.vol20, 0)} %</b></div>
    <div class="ro"><span>RSI 14 · ADX</span><b>${nf(a.rsi, 0)} · ${nf(a.adx, 0)}</b></div>
    <div class="ro"><span>vs EMA 50 · 200</span><b>${pc(a.vsE50, 1)} · ${pc(a.vsE200, 1)}</b></div>
    <div class="ro"><span>Corr. con el oro</span><b>${a.corrGold60 == null ? '—' : nf(a.corrGold60, 2)}</b><small>60 d · ${a.corrGold250 == null ? '—' : nf(a.corrGold250, 2)} a 250 d</small></div>
  </div>`);
  const grid = $('.grid', view);
  if (a.season) {
    grid.insertAdjacentHTML('beforeend', panel('a-sea', 'Estacionalidad', 'rendimiento medio por mes', 'c6', '<div class="chart short" id="a-seac"></div>'));
    chart($('#a-seac'), { kind: 'bar', diverging: true, label: 'Estacionalidad mensual', data: a.season.map((m) => ({ x: MONTHS[m.month - 1], v: m.mean, up: m.upPct, n: m.n })), series: [{ key: 'v', label: 'Media', color: 'var(--s1)' }], fmtY: (v) => pc(v, 1), pr: 50, tip: (d) => `${d.x}: media <b>${pc(d.v, 2)}</b><br>subió ${nf(d.up, 0)} % de ${d.n} años` });
  }
  if (a.cot) {
    grid.insertAdjacentHTML('beforeend', panel('a-cot', `COT · ${esc(a.cot.kind)}`, `informe del ${dLabel(a.cot.d)}`, 'c6', `<div class="ros" style="margin-bottom:10px"><div class="ro"><span>Neto</span><b>${nf(a.cot.net, 0)}</b><small>${sgn(a.cot.change, 0)} en la semana</small></div><div class="ro"><span>COT Index 26 sem.</span><b>${nf(a.cot.idx26, 0)}</b></div><div class="ro"><span>COT Index 3 años</span><b>${nf(a.cot.idx156, 0)}</b></div></div><div class="chart short" id="a-cotc"></div>`));
    chart($('#a-cotc'), { label: 'Posición neta de los especuladores', data: a.cot.hist.map((p) => ({ x: p.d, v: p.v })), series: [{ key: 'v', label: 'Neto', color: 'var(--s1)' }], fmtY: (v) => nf(v / 1000, 0) + 'k', fmtX: dLabel });
  }
}

// =====================================================================
// AGENDA
// =====================================================================
async function pageAgenda(view) {
  let onlyHigh = store.get('agHigh', false), onlyUsd = store.get('agUsd', true);
  view.innerHTML = `<div class="page-head"><div><h1>Agenda</h1><p>Eventos de la semana en hora de Madrid y lo que suele mover el oro cada dato.</p></div><span class="meta" id="ag-next"></span></div>
    <div class="keyrow" style="margin-bottom:12px"><button class="key sm" type="button" id="ag-usd" aria-pressed="${onlyUsd}">Solo USD</button><button class="key sm" type="button" id="ag-high" aria-pressed="${onlyHigh}">Solo impacto alto</button></div>
    <div class="grid">${panel('ag', 'Semana', '', 'c6')}${panel('ag-r', 'Lo que más mueve al oro', '1 h después', 'c6')}</div>`;
  let ev, m10;
  try { [ev, m10] = await Promise.all([api('/api/calendar').then((j) => j.data), mod('m10').then((j) => j.data)]); } catch (e) { return fail('ag', e); }
  const kindOf = (title) => m10.matchers.find((m) => new RegExp(m.re, m.flags).test(title))?.kind;
  const draw = () => {
    const rows = ev.filter((e) => e.impact !== 'Holiday' && e.impact !== 'Low' && (!onlyHigh || e.impact === 'High') && (!onlyUsd || e.country === 'USD')).map((e) => ({ ...e, t: Date.parse(e.date) }));
    const days = [...new Set(rows.map((e) => dayKey(e.t)))];
    const next = rows.find((e) => e.impact === 'High' && e.t > Date.now());
    $('#ag-next').innerHTML = next ? `Próximo rojo: ${esc(evName(next.title))} en <span class="countdown" data-until="${next.t}">${until(next.t)}</span>` : '';
    fill('ag', days.length ? days.map((d) => `<h3 style="font-size:13px;margin:14px 0 4px">${cap(fDay.format(new Date(d + 'T12:00:00Z')))}</h3><div class="memo">${rows.filter((e) => dayKey(e.t) === d).map((e) => {
      const st = m10.stats[kindOf(e.title)]?.r60;
      const past = e.t < Date.now();
      return `<div class="mrow" style="${past ? 'opacity:.6' : ''}"><span class="t">${fTime.format(e.t)}</span><div><div class="ttl">${esc(evName(e.title))} <span class="dim">${esc(e.country)}</span></div><div class="sub">${e.actual ? `Dato <b>${esc(e.actual)}</b> · ` : ''}${e.forecast ? `previsión ${esc(e.forecast)} · ` : ''}${e.previous ? `anterior ${esc(e.previous)}` : ''}${st?.n ? ` · el oro ±${nf(st.absMedian, 2)} % en 1 h (${st.n} datos)` : ''}</div></div><span class="lvl ${e.impact === 'High' ? 'hi' : 'md'}">${e.impact === 'High' ? 'Alto' : 'Medio'}</span></div>`;
    }).join('')}</div>`).join('') : '<p class="empty">Nada con estos filtros.</p>');
  };
  const top = Object.entries(m10.stats).filter(([, s]) => s.r60.n >= 5).sort((a, b) => b[1].r60.absMedian - a[1].r60.absMedian);
  const side = (x) => (x?.n >= 5 ? `<span class="${dir(x.mean)}">${pc(x.mean, 2)}</span><div class="sub">${x.n} casos</div>` : `<span class="sub">${x?.n ?? 0} de 5</span>`);
  fill('ag-r', `${help('Movimiento típico (mediana, sin signo) del oro en la hora siguiente a cada publicación desde 2024, porcentaje de veces que subió y, cuando haya al menos 5 casos, la reacción media según el dato salga mejor o peor de lo esperado (mejor = economía más fuerte). Con unos 20 casos por dato el margen de error es amplio. Por encima de 0,5 % conviene no tener la orden puesta en el minuto del dato.')}<div class="scroll-x"><table class="tbl"><thead><tr><th>Dato</th><th class="num">±1 h</th><th class="num">Subió</th><th class="num">Casos</th><th class="num">Si sale mejor</th><th class="num">Si sale peor</th></tr></thead><tbody>${top.map(([, s]) => `<tr><td>${esc(s.name)}</td><td class="num">${nf(s.r60.absMedian, 2)} %</td><td class="num">${nf(s.r60.upPct, 0)} %</td><td class="num">${s.r60.n}</td><td class="num">${side(s.better)}</td><td class="num">${side(s.worse)}</td></tr>`).join('')}</tbody></table></div><p class="vq-sub" style="text-align:left;margin:8px 0 0">Las sorpresas se calculan con la previsión de Forex Factory y el dato oficial de FRED desde que la web está en marcha: el histórico no trae previsiones, así que estas dos columnas se llenan con cada publicación.</p>`);
  $('#ag-usd').onclick = (e) => { onlyUsd = !onlyUsd; store.set('agUsd', onlyUsd); e.currentTarget.setAttribute('aria-pressed', String(onlyUsd)); draw(); };
  $('#ag-high').onclick = (e) => { onlyHigh = !onlyHigh; store.set('agHigh', onlyHigh); e.currentTarget.setAttribute('aria-pressed', String(onlyHigh)); draw(); };
  draw();
}

// =====================================================================
// DIARIO
// =====================================================================
async function pageJournal(view) {
  view.innerHTML = `<div class="page-head"><div><h1>Diario</h1><p id="j-read">Tus planes y cuándo aciertas.</p></div></div><div class="grid">${panel('j-st', 'Tu acierto', '', 'c12')}${panel('j-list', 'Planes', 'el plan se escribe en Hoy', 'c12')}</div>`;
  const load = async () => {
    let j;
    try { j = await api('/api/m/journal'); } catch (e) { return fail('j-st', e); }
    const d = j.data;
    $('#j-read').textContent = j.reading;
    const rate = (r) => (r?.n ? `<b>${nf(r.pct, 0)} %</b><small>${r.n} planes</small>` : '<b>—</b><small>sin planes evaluados</small>');
    const T = d.trades;
    fill('j-st', `${help('Arriba, tus planes como operaciones: entrada cuando el precio la toca, stop en la invalidación (−1 R) y salida a +2 R, lo que llegue antes, en velas de 15 minutos; si sigue abierta al cierre de la sesión, cuenta el precio final. Es la cifra que dice si ganas dinero. Abajo, el acierto de dirección: el día cierra a favor de tu sesgo más de 0,25 ATR, o dentro de ese margen si fuiste neutral. Todo se evalúa solo cada noche, mientras Yahoo conserve las velas (5 días).')}
      <div class="ros" style="margin-bottom:16px">${ro('R medio por operación', T.avgR == null ? '—' : sgn(T.avgR, 2, ' R'), T.entered ? `${T.entered} operaciones activadas` : 'ninguna activada todavía', dir(T.avgR))}${ro('R acumulado', sgn(T.totalR, 1, ' R'), '', dir(T.totalR))}${ro('Llegan a +1 R', T.hit1 == null ? '—' : `${nf(T.hit1, 0)} %`, 'de las activadas')}${ro('Sin activar', nf(T.judged - T.entered, 0), `de ${T.judged} planes con entrada`)}</div>
      <div class="ros">
      <div class="ro"><span>Total</span>${rate(d.all)}</div><div class="ro"><span>Últimos 20</span>${rate(d.last20)}</div>
      ${d.byBias.map((b) => `<div class="ro"><span>${b.label}</span>${rate(b)}</div>`).join('')}
      ${d.byWeekday.map((b) => `<div class="ro"><span>${b.label}</span>${rate(b)}</div>`).join('')}</div>`);
    fill('j-list', d.rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Fecha</th><th>Sesgo</th><th class="num">Entrada</th><th class="num">Invalidación</th><th>Nota</th><th class="num">R</th><th>Dirección</th></tr></thead><tbody>${d.rows.map((r) => `<tr><td class="num">${dLabel(r.d)}</td><td class="${dir(r.bias)}">${['Vendedor', 'Neutral', 'Comprador'][r.bias + 1]}</td><td class="num">${r.entry == null ? '—' : nf(r.entry, 1)}</td><td class="num">${r.invalid == null ? '—' : nf(r.invalid, 1)}</td><td class="sub">${esc(r.note || r.levelsText || '')}</td><td class="num ${dir(r.trade?.r)}">${!r.trade ? '—' : r.trade.entered ? sgn(r.trade.r, 2) : '<span class="dim">no entró</span>'}</td><td style="white-space:nowrap">${r.hit == null ? '<span class="dim">Pendiente</span> ' : r.hit ? '<span class="up">Acertó</span> ' : '<span class="down">Falló</span> '}<button class="key sm" data-id="${r.id}" data-hit="1" type="button">Acertó</button> <button class="key sm" data-id="${r.id}" data-hit="0" type="button">Falló</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Aún no hay planes. Escribe el primero en Hoy.</p>');
  };
  $('#j-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-hit]');
    if (!b) return;
    try { await post(`/api/journal/${b.dataset.id}`, { hit: +b.dataset.hit }); load(); } catch (err) { alert(`No se guardó: ${err.message}`); }
  });
  load();
}

// =====================================================================
// MÉTODO
// =====================================================================
async function pageMethod(view) {
  view.innerHTML = `<div class="page-head"><div><h1>Método</h1><p>Cómo se calcula cada cosa y cuánto acierta. Sin cajas negras.</p></div></div>
    <div class="grid">${panel('me-bt', 'Acierto de cada factor', '', 'c12')}</div>
    <div class="prose" id="me-prose"></div>`;
  try {
    const { data: d } = await api('/api/m/today');
    const bt = d.backtest;
    if (!bt) fill('me-bt', '<p class="empty">Falta el backtest: ejecuta <code>npm run factors</code>.</p>');
    else {
      const row = (label, v) => `<tr><td>${label}</td><td class="num">${v.is?.n ?? 0}</td><td class="num ${dir(v.is?.edge1)}">${sgn(v.is?.edge1, 1, ' pp')}</td><td class="num ${dir(v.is?.edge20)}">${sgn(v.is?.edge20, 1, ' pp')}</td><td class="num">${v.oos?.n ?? 0}</td><td class="num ${dir(v.oos?.edge1)}">${sgn(v.oos?.edge1, 1, ' pp')}</td><td class="num ${dir(v.oos?.edge5)}">${sgn(v.oos?.edge5, 1, ' pp')}</td><td class="num">${v.oos?.n20 ?? 0}</td><td class="num ${dir(v.oos?.edge20)}">${sgn(v.oos?.edge20, 1, ' pp')}</td><td>${v.signal ? '<b>Señal</b>' : 'Contexto'}</td></tr>`;
      fill('me-bt', `<p class="reading">Backtest ${bt.period}, ${bt.days} sesiones, con el mismo código que la página Hoy. Ajuste y lectura hasta 2020; prueba de 2021 a hoy. Ventaja = acierto menos la base que tendría quien apuesta en la misma proporción sin mirar el factor. A 20 sesiones se toma un día de cada veinte para que las ventanas no se solapen. Un factor es señal si gana dentro y fuera de muestra: al menos +1 y +2 puntos a 1 día y +1 a 5 días, o +5 puntos a 20 sesiones en los dos periodos con 30 ventanas o más fuera de muestra.</p>
        <div class="scroll-x"><table class="tbl"><thead><tr><th>Factor</th><th class="num">Días 08–20</th><th class="num">Ventaja 1 d</th><th class="num">Ventaja 20 ses.</th><th class="num">Días 21–hoy</th><th class="num">Ventaja 1 d</th><th class="num">Ventaja 5 d</th><th class="num">Ventanas 20 ses.</th><th class="num">Ventaja 20 ses.</th><th>Veredicto</th></tr></thead><tbody>
        ${d.factors.list.map((f) => row(f.label, bt.factors[f.k])).join('')}${row(`<b>Total (desde ±${bt.totalMin})</b>`, bt.total)}</tbody></table></div>`);
    }
    $('#me-prose').innerHTML = `
      <h2>Los seis factores</h2>
      ${(d.factors?.list ?? []).map((f) => `<h3>${esc(f.label)}</h3><p>${esc(f.what)}</p>`).join('')}
      <p>Cada factor puntúa de −2 a +2 con umbrales fijos escritos en <code>factors.js</code>. No se ajustan para que el backtest salga mejor: si se tocaran mirando el resultado, la prueba fuera de muestra dejaría de valer.</p>
      <h2>Niveles y escenarios</h2>
      <p>Niveles: máximo, mínimo y cierre de la sesión anterior; máximo y mínimo de la semana y del mes anteriores; aperturas semanal y mensual; VWAP de la sesión y de la anterior; rango de Asia; zonas de giro de los últimos 180 días con al menos dos toques; números redondos (los de 100 $ pesan el doble que los de 50). Los que están a menos de 0,15 ATR se funden. Se calculan sobre el futuro GC y se trasladan a contado restando la base del momento. Para los máximos y mínimos de ayer y de la semana anterior se muestra, desde 2006, cuántos días se tocan y cuántos de esos cierran más allá.</p>
      <p>Escenarios: activación en el nivel más cercano con peso 3 o más y a más de 0,3 ATR del precio; invalidación a 0,25 ATR (1 R); objetivo en el siguiente nivel que pague al menos 1,5 R. La probabilidad de llegar a la activación usa el principio de reflexión de un paseo aleatorio con la volatilidad de lo que queda de sesión (GARCH o GVZ, la que mejor ha acertado en la Proyección): P = 2·(1 − Φ(distancia / σ)). Una vez activado, la de tocar el objetivo antes que el stop es (activación − stop) / (objetivo − stop), con la que la esperanza de un paseo aleatorio es cero: la ventaja tiene que venir de que el nivel aguante.</p>
      <h2>Volatilidad y régimen</h2>
      <p>GARCH(1,1) y GJR-GARCH(1,1) gaussianos con varianza objetivo, ajustados por máxima verosimilitud (Nelder-Mead) sobre 10 años de rendimientos diarios del futuro GC. En el GJR la asimetría puede salir de los dos signos: en el oro suelen ser las subidas las que más agitan. En Hoy la volatilidad se muestra como percentil del último año (GARCH y la implícita GVZ). El régimen es un modelo oculto de Markov de tres estados ajustado con Baum-Welch sobre 6 años; se muestra solo en la página de Volatilidad.</p>
      <h2>Riesgo y proyección</h2>
      <p>VaR y ES históricos sobre 1 y 4 años. El abanico de precios, sin tendencia, se dibuja con la volatilidad que mejor ha cumplido lo que promete en los 3 últimos años: la GARCH o la implícita de las opciones (GVZ). La dirección se prueba con un AR(1) fuera de muestra; si no mejora al paseo aleatorio, no se muestra ninguna previsión.</p><h2>Variación cuantitativa</h2><p>Regresión de los movimientos de 15 minutos del oro sobre los del índice dólar (DXY) y el futuro del bono a 10 años en los últimos 60 días. El movimiento de la sesión se reparte entre dólar, tipos y lo que queda, que es el movimiento propio del oro; la esfera muestra ese propio frente a una desviación diaria. Es atribución: dice quién ha empujado, no hacia dónde irá.</p><h2>Relaciones</h2><p>La sensibilidad a tipos reales y dólar es una regresión de rendimientos diarios en ventanas de 60 sesiones. Sustituye a un valor razonable que comparaba niveles de precio: con series con tendencia, esa regresión daba un R² inflado.</p>
      <h2>Datos</h2>
      <p>Velas: Yahoo Finance (no oficial, hasta 15 min de retraso en algunos mercados), con Stooq de respaldo. Contado del oro: gold-api, y si falla, XAUT/USDT de Bybit como aproximación. COT: CFTC. Macro: FRED. GLD: SPDR Gold Shares. Calendario: Forex Factory. Noticias: RSS. Comprobado el 14 de octubre de 2026: las opciones de GLD (Yahoo), la curva de futuros del VIX (CBOE) y el Fear &amp; Greed de CNN bloquean el acceso automático, así que no se usan.</p>
      <h2>Glosario</h2>
      <dl>${(window.GLOSARIO ?? []).map(([t, x]) => `<dt><b>${esc(t)}</b></dt><dd style="margin:0 0 8px">${esc(x)}</dd>`).join('')}</dl>
      <p class="disclaimer">Aureo es una herramienta personal de análisis. Nada de lo que muestra es asesoramiento financiero ni una recomendación de compra o venta.</p>`;
  } catch (e) { fail('me-bt', e); }
}

render();
