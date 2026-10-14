// Variación cuantitativa: what is moving gold right now. Over the last 60 days of 15-minute bars, gold's moves
// are regressed on the dollar index and on the 10-year note future; today's move is split into the dollar part,
// the rates part and what is left, gold's own move. Attribution, not a forecast: it says who pushed, not where next.
import { ols2 } from './analytics.js';

// Bars present in the three series, by timestamp. g/d/z: [{t, c}] oldest first.
export function align3(g, d, z) {
  const D = new Map(d.map((b) => [b.t, b.c])), Z = new Map(z.map((b) => [b.t, b.c]));
  return g.filter((b) => D.has(b.t) && Z.has(b.t)).map((b) => ({ t: b.t, g: b.c, d: D.get(b.t), z: Z.get(b.t) }));
}

// % moves between consecutive aligned bars no more than an hour apart (skips the daily pause and weekends).
export function moves(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (b.t - a.t > 3600) continue;
    out.push({ t: b.t, g: (b.g / a.g - 1) * 100, d: (b.d / a.d - 1) * 100, z: (b.z / a.z - 1) * 100 });
  }
  return out;
}

// Gold ~ dollar + note. bD < 0: a stronger dollar weighs on gold; bZ > 0: a rising note (falling yields) lifts it.
export function fitBetas(m) {
  const f = ols2(m.map((x) => x.g), m.map((x) => x.d), m.map((x) => x.z));
  return { bD: f.b, bZ: f.c, r2: f.r2, n: m.length };
}

// Split each move into the dollar, rates and own parts and accumulate them (in %).
export function attribute(m, fit) {
  let D = 0, Z = 0, G = 0;
  return m.map((x) => {
    D += fit.bD * x.d; Z += fit.bZ * x.z; G += x.g;
    return { t: x.t, total: G, dollar: D, rates: Z, own: G - D - Z };
  });
}

export const BANDS = [[5, 'Neutro'], [21, 'Leve'], [55, 'Moderado'], [80, 'Fuerte'], [Infinity, 'Extremo']];
export function vqBand(s) {
  const b = BANDS.find(([h]) => Math.abs(s) < h)[1];
  return b === 'Neutro' ? b : `${s > 0 ? 'Alcista' : 'Bajista'} ${b.toLowerCase()}`;
}
